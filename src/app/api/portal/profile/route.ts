import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

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
    const resellerId = profile?.reseller_id || meta.reseller_id || profile?.representative_id || meta.representative_id || null;

    let resellerData = null;
    if (resellerId) {
      try {
        // Tenta buscar na tabela resellers
        const { data: resTable } = await admin
          .from('resellers')
          .select('id, name, email, phone, whatsapp, status, notification_preference')
          .eq('id', resellerId)
          .maybeSingle();

        if (resTable) {
          resellerData = {
            id: resTable.id,
            name: resTable.name,
            contact_name: resTable.name,
            store_name: resTable.name,
            email: resTable.email,
            phone: resTable.phone || resTable.whatsapp,
            whatsapp: resTable.whatsapp,
            notification_preference: resTable.notification_preference,
            status: resTable.status,
          };
        } else {
          // Fallback para tabela profiles
          const { data: rep } = await admin
            .from('profiles')
            .select('id, contact_name, store_name, phone, email')
            .eq('id', resellerId)
            .maybeSingle();

          if (rep) {
            resellerData = {
              id: rep.id,
              name: rep.contact_name || rep.store_name || rep.email,
              contact_name: rep.contact_name,
              store_name: rep.store_name,
              phone: rep.phone,
              whatsapp: (rep.phone || '').replace(/\D/g, ''),
              email: rep.email,
              notification_preference: 'both' as const,
              status: 'ativo' as const,
            };
          }
        }
      } catch {}
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

    const payload: any = {
      id: user.id,
      email: user.email,
      contact_name: contact_name?.trim() || null,
      store_name: store_name?.trim() || null,
      phone: phone?.trim() || null,
      cnpj_cpf: cnpj_cpf?.trim() || null,
      city: city?.trim() || null,
      state: state?.trim() || null,
      address: address?.trim() || null,
      cep: cep?.trim() || null,
      avatar_url: avatar_url || null,
      updated_at: new Date().toISOString(),
    };

    // Tenta gravar na tabela profiles
    try {
      await admin.from('profiles').upsert(payload);
    } catch (e: any) {
      // Se colunas address, cep ou avatar_url ainda não foram criadas no banco
      if (e.message?.includes('address') || e.message?.includes('avatar_url') || e.message?.includes('cep')) {
        delete payload.address;
        delete payload.cep;
        delete payload.avatar_url;
        await admin.from('profiles').upsert(payload);
      }
    }

    // Sincroniza também nos metadados do Auth para disponibilidade instantânea em qualquer sessão
    try {
      const updateData: any = {
        contact_name: contact_name?.trim(),
        store_name: store_name?.trim(),
        phone: phone?.trim(),
        cnpj_cpf: cnpj_cpf?.trim(),
        city: city?.trim(),
        state: state?.trim(),
        address: address?.trim(),
        cep: cep?.trim(),
      };
      if (avatar_url) updateData.avatar_url = avatar_url;

      await serverSupabase.auth.updateUser({
        data: updateData,
      });
    } catch (e) {
      console.warn('Aviso ao sincronizar user_metadata:', e);
    }

    return NextResponse.json({
      success: true,
      profile: {
        ...payload,
        address: address?.trim() || null,
        cep: cep?.trim() || null,
        avatar_url: avatar_url || null,
      },
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
    const buffer = Buffer.from(bytes);

    const ext = file.name.split('.').pop() || 'png';
    const filePath = `profiles/${user.id}-${Date.now()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from('produtos')
      .upload(filePath, buffer, {
        contentType: file.type || 'image/png',
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
