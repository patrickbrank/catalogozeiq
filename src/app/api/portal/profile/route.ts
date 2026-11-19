import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import {
  optimizeAvatarImageBuffer,
  STORAGE_CACHE_CONTROL,
} from '@/lib/utils/server-image-optimizer';
import {
  resolveLiveReseller,
  syncRepresentativeResellerAndOrders,
} from '@/lib/services/reseller-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) return null;
  return createAdminClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}

// GET: Retorna dados cadastrais do cliente autenticado
export async function GET() {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Não autenticado.' }, { status: 401 });
    }

    const admin = getAdminClient() || serverSupabase;
    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    const meta = user.user_metadata || {};
    const appMeta = user.app_metadata || {};
    const resellerId =
      profile?.reseller_id ||
      profile?.representative_id ||
      appMeta.representative_id ||
      meta.reseller_id ||
      meta.representative_id ||
      null;

    let resellerData = null;
    if (resellerId) {
      const resolved = await resolveLiveReseller(admin, resellerId);
      if (resolved.reseller) {
        resellerData = {
          id: resolved.reseller.id,
          name: resolved.reseller.name,
          contact_name: resolved.reseller.name,
          store_name: resolved.reseller.name,
          email: resolved.reseller.email,
          phone: resolved.reseller.whatsapp || resolved.reseller.phone,
          whatsapp: resolved.reseller.whatsapp,
          notification_preference: resolved.reseller.notification_preference,
          status: resolved.reseller.status,
        };
      }
    }

    const merged = {
      id: user.id,
      email: user.email,
      contact_name: profile?.contact_name || meta.contact_name || user.email?.split('@')[0],
      store_name: profile?.store_name || meta.store_name || 'Lojista B2B',
      phone: profile?.phone || meta.phone || '',
      cnpj_cpf: profile?.cnpj_cpf || meta.cnpj_cpf || '',
      city: profile?.city || meta.city || '',
      state: profile?.state || meta.state || '',
      address: profile?.address || meta.address || '',
      cep: profile?.cep || meta.cep || '',
      avatar_url: profile?.avatar_url || meta.avatar_url || null,
      role: profile?.role || meta.role || 'reseller',
      reseller_id: resellerId,
      reseller: resellerData,
      representative_id: resellerId,
      representative: resellerData,
    };

    return NextResponse.json({ success: true, profile: merged });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT: Atualiza dados cadastrais, endereço e dados comerciais do cliente
export async function PUT(request: NextRequest) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Não autenticado.' }, { status: 401 });
    }

    const body = await request.json();
    const {
      contact_name,
      store_name,
      phone,
      cnpj_cpf,
      city,
      state,
      address,
      cep,
      avatar_url,
    } = body;

    const admin = getAdminClient() || serverSupabase;

    // Monta payload parcial seguro atualizando apenas os campos informados
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (contact_name !== undefined) updatePayload.contact_name = contact_name?.trim() || null;
    if (store_name !== undefined) updatePayload.store_name = store_name?.trim() || null;
    if (phone !== undefined) updatePayload.phone = phone?.trim() || null;
    if (cnpj_cpf !== undefined) updatePayload.cnpj_cpf = cnpj_cpf?.trim() || null;
    if (city !== undefined) updatePayload.city = city?.trim() || null;
    if (state !== undefined) updatePayload.state = state?.trim() || null;
    if (address !== undefined) updatePayload.address = address?.trim() || null;
    if (cep !== undefined) updatePayload.cep = cep?.trim() || null;
    if (avatar_url !== undefined) updatePayload.avatar_url = avatar_url || null;

    // 1. Tenta atualizar perfil existente de forma atômica
    let finalProfile: any = null;
    try {
      const { data: updatedProf, error: updateErr } = await admin
        .from('profiles')
        .update(updatePayload)
        .eq('id', user.id)
        .select('*')
        .maybeSingle();

      if (!updateErr && updatedProf) {
        finalProfile = updatedProf;
      } else {
        // Se ainda não existir registro em profiles, faz upsert completo com email
        const fullPayload = {
          id: user.id,
          email: user.email,
          ...updatePayload,
        };
        const { data: upsertedProf } = await admin
          .from('profiles')
          .upsert(fullPayload)
          .select('*')
          .maybeSingle();
        finalProfile = upsertedProf;
      }
    } catch (e: any) {
      console.warn('Aviso ao salvar profile:', e.message);
    }

    // 2. Sincroniza metadados do Auth para disponibilidade instantânea em qualquer sessão
    try {
      const authUpdate: any = {};
      if (contact_name !== undefined) authUpdate.contact_name = contact_name?.trim() || '';
      if (store_name !== undefined) authUpdate.store_name = store_name?.trim() || '';
      if (phone !== undefined) authUpdate.phone = phone?.trim() || '';
      if (avatar_url !== undefined) authUpdate.avatar_url = avatar_url || '';

      if (Object.keys(authUpdate).length > 0) {
        await serverSupabase.auth.updateUser({
          data: authUpdate,
        });
      }
    } catch (e) {
      console.warn('Aviso ao sincronizar user_metadata:', e);
    }

    // 3. Se o próprio representante alterar seu telefone/nome pelo perfil, sincroniza resellers e pedidos
    const effectiveRole = finalProfile?.role || user.app_metadata?.role || user.user_metadata?.role;
    const serviceAdmin = getAdminClient();
    if (
      serviceAdmin &&
      effectiveRole === 'representative' &&
      (phone !== undefined || contact_name !== undefined)
    ) {
      try {
        await syncRepresentativeResellerAndOrders(serviceAdmin, {
          userId: user.id,
          email: user.email,
          name: contact_name !== undefined ? contact_name?.trim() : finalProfile?.contact_name,
          phone: phone !== undefined ? phone?.trim() : finalProfile?.phone,
          whatsapp: phone !== undefined ? (phone || '').replace(/\D/g, '') : undefined,
          updateOrders: true,
        });
      } catch (repSyncErr) {
        console.warn('Aviso ao sincronizar representante após edição de perfil:', repSyncErr);
      }
    }

    return NextResponse.json({
      success: true,
      profile: finalProfile || {
        id: user.id,
        email: user.email,
        ...updatePayload,
      },
      message: 'Perfil atualizado com sucesso.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Upload de logo da loja ou foto do cliente para o Storage
export async function POST(request: NextRequest) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Não autenticado.' }, { status: 401 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Chave administrativa não configurada.' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const inputBuffer = Buffer.from(bytes);

    let finalBuffer: Buffer;
    let filePath = `profiles/${user.id}-${Date.now()}-opt.webp`;
    let contentType = 'image/webp';

    try {
      finalBuffer = await optimizeAvatarImageBuffer(inputBuffer);
    } catch {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      filePath = `profiles/${user.id}-${Date.now()}.${ext}`;
      finalBuffer = inputBuffer;
      contentType = file.type || 'image/png';
    }

    const { error: uploadError } = await admin.storage
      .from('produtos')
      .upload(filePath, finalBuffer, {
        contentType,
        cacheControl: STORAGE_CACHE_CONTROL,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = admin.storage.from('produtos').getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    // Atualiza avatar_url no profile
    try {
      await admin.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
    } catch {}

    try {
      await serverSupabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      avatarUrl: publicUrl,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
