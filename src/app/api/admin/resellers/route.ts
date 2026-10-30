import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient, verifyAdmin } from '@/lib/supabase/admin-auth';
import { sanitizeWhatsAppNumber } from '@/lib/services/order-notification';

export const dynamic = 'force-dynamic';

// GET: Lista todos os revendedores cadastrados (Admin Master)
export async function GET() {
  try {
    const { isAdmin, isMaster, role } = await verifyAdmin();
    if (!isAdmin || (!isMaster && role !== 'admin')) {
      return NextResponse.json({ success: false, error: 'Acesso restrito à administração.' }, { status: 403 });
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: true, resellers: [] });
    }

    // Busca revendedores
    const { data: resellers, error: resErr } = await adminSupabase
      .from('resellers')
      .select('*')
      .order('created_at', { ascending: false });

    if (resErr) {
      // Se tabela ainda não foi criada, retorna lista vazia amigável
      return NextResponse.json({
        success: true,
        resellers: [],
        tableMissing: resErr.message?.includes('does not exist') || resErr.code === '42P01',
      });
    }

    // Busca contagem de clientes e pedidos vinculados a cada revendedor, e mapeia avatar/mood
    const { data: profiles } = await adminSupabase
      .from('profiles')
      .select('id, email, reseller_id, representative_id, avatar_url');

    const { data: orders } = await adminSupabase
      .from('orders')
      .select('id, reseller_id, representative_id');

    const avatarMap: Record<string, string> = {};
    const clientCounts: Record<string, number> = {};
    (profiles || []).forEach((p: any) => {
      if (p.avatar_url) {
        if (p.id) avatarMap[p.id] = p.avatar_url;
        if (p.email) avatarMap[p.email.toLowerCase().trim()] = p.avatar_url;
      }

      const rid = p.reseller_id || p.representative_id;
      if (rid) {
        clientCounts[rid] = (clientCounts[rid] || 0) + 1;
      }
    });

    const orderCounts: Record<string, number> = {};
    (orders || []).forEach((o: any) => {
      const rid = o.reseller_id || o.representative_id;
      if (rid) {
        orderCounts[rid] = (orderCounts[rid] || 0) + 1;
      }
    });

    const formatted = (resellers || []).map((r) => ({
      ...r,
      avatar_url: avatarMap[r.user_id] || (r.email ? avatarMap[r.email.toLowerCase().trim()] : null) || null,
      customers_count: clientCounts[r.id] || (r.user_id ? clientCounts[r.user_id] : 0) || 0,
      orders_count: orderCounts[r.id] || (r.user_id ? orderCounts[r.user_id] : 0) || 0,
    }));

    return NextResponse.json({
      success: true,
      resellers: formatted,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Cadastra novo revendedor (Admin Master)
export async function POST(request: NextRequest) {
  try {
    const { isAdmin, isMaster, role } = await verifyAdmin();
    if (!isAdmin || (!isMaster && role !== 'admin')) {
      return NextResponse.json({ success: false, error: 'Acesso restrito à administração.' }, { status: 403 });
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: false, error: 'Chave administrativa não configurada.' }, { status: 500 });
    }

    const body = await request.json();
    const {
      name,
      email,
      whatsapp,
      phone,
      status = 'ativo',
      notification_preference = 'both',
      password,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'Nome do revendedor é obrigatório.' }, { status: 400 });
    }
    if (!email?.trim()) {
      return NextResponse.json({ success: false, error: 'E-mail do revendedor é obrigatório.' }, { status: 400 });
    }
    if (!whatsapp?.trim()) {
      return NextResponse.json({ success: false, error: 'WhatsApp do revendedor é obrigatório (apenas números).' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanWhatsapp = whatsapp.replace(/\D/g, '');

    if (cleanWhatsapp.length < 10) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp inválido. Informe o DDD e o número completo (ex: 62999999999).' },
        { status: 400 }
      );
    }

    // 1. Cria ou localiza conta de acesso no Supabase Auth para o Revendedor
    let authUserId: string | null = null;
    const initialPassword = password?.trim() || 'Zeiq@123456';

    try {
      const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
        email: cleanEmail,
        password: initialPassword,
        email_confirm: true,
        app_metadata: {
          role: 'representative',
        },
        user_metadata: {
          role: 'representative',
          contact_name: name.trim(),
          store_name: 'Representação Comercial Zeiq',
          phone: cleanWhatsapp,
          is_approved: true,
        },
      });

      if (!authError && authUser?.user) {
        authUserId = authUser.user.id;
      } else if (authError?.message?.includes('already registered') || authError?.message?.includes('exists')) {
        // Se usuário já existe no auth, busca o ID dele e atualiza role para representative
        const { data: usersList } = await adminSupabase.auth.admin.listUsers();
        const existing = usersList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
        if (existing) {
          authUserId = existing.id;
          await adminSupabase.auth.admin.updateUserById(existing.id, {
            app_metadata: { role: 'representative' },
            user_metadata: { role: 'representative', contact_name: name.trim(), store_name: 'Representação Comercial Zeiq' },
          });
        }
      }
    } catch (authErr) {
      console.warn('Aviso ao sincronizar usuário no Supabase Auth:', authErr);
    }

    // 2. Insere na tabela 'resellers'
    const insertPayload: any = {
      name: name.trim(),
      email: cleanEmail,
      whatsapp: cleanWhatsapp,
      phone: phone?.trim() || null,
      status: status === 'inativo' ? 'inativo' : 'ativo',
      notification_preference: ['whatsapp_only', 'email_only', 'both'].includes(notification_preference)
        ? notification_preference
        : 'both',
      user_id: authUserId,
    };

    const { data: newReseller, error: insertErr } = await adminSupabase
      .from('resellers')
      .insert(insertPayload)
      .select('*')
      .single();

    if (insertErr) {
      return NextResponse.json({ success: false, error: insertErr.message }, { status: 400 });
    }

    // 3. Também sincroniza ou insere na tabela profiles se authUserId existir com cargo representative
    if (authUserId) {
      try {
        await adminSupabase.from('profiles').upsert({
          id: authUserId,
          email: cleanEmail,
          contact_name: name.trim(),
          store_name: 'Representação Comercial Zeiq',
          phone: cleanWhatsapp,
          role: 'representative',
          is_approved: true,
        });
      } catch {}
    }

    return NextResponse.json({
      success: true,
      reseller: newReseller,
      message: 'Revendedor cadastrado com sucesso!',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT: Atualiza revendedor existente (Admin Master)
export async function PUT(request: NextRequest) {
  try {
    const { isAdmin, isMaster, role } = await verifyAdmin();
    if (!isAdmin || (!isMaster && role !== 'admin')) {
      return NextResponse.json({ success: false, error: 'Acesso restrito à administração.' }, { status: 403 });
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: false, error: 'Chave administrativa não configurada.' }, { status: 500 });
    }

    const body = await request.json();
    const {
      id,
      name,
      email,
      whatsapp,
      phone,
      status,
      notification_preference,
      password,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID do revendedor é obrigatório.' }, { status: 400 });
    }

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (name?.trim()) updatePayload.name = name.trim();
    if (email?.trim()) updatePayload.email = email.trim().toLowerCase();
    if (whatsapp?.trim()) updatePayload.whatsapp = whatsapp.replace(/\D/g, '');
    if (phone !== undefined) updatePayload.phone = phone ? phone.trim() : null;
    if (status) updatePayload.status = status === 'inativo' ? 'inativo' : 'ativo';
    if (notification_preference) {
      updatePayload.notification_preference = ['whatsapp_only', 'email_only', 'both'].includes(notification_preference)
        ? notification_preference
        : 'both';
    }

    // Atualiza tabela resellers
    const { data: updatedReseller, error: updateErr } = await adminSupabase
      .from('resellers')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 400 });
    }

    // Se houver alteração de senha ou user_id vinculado, atualiza no Supabase Auth e Profiles
    const targetUserId = updatedReseller.user_id;
    if (targetUserId) {
      try {
        const authUpdates: any = {
          app_metadata: {
            role: 'representative',
          },
          user_metadata: {
            role: 'representative',
            contact_name: updatePayload.name || updatedReseller.name,
            store_name: 'Representação Comercial Zeiq',
            phone: updatePayload.whatsapp || updatedReseller.whatsapp,
          },
        };
        if (updatePayload.email) authUpdates.email = updatePayload.email;
        if (password?.trim() && password.trim().length >= 6) {
          authUpdates.password = password.trim();
        }

        await adminSupabase.auth.admin.updateUserById(targetUserId, authUpdates);

        // Sincroniza tabela profiles
        await adminSupabase.from('profiles').update({
          role: 'representative',
          contact_name: updatePayload.name || updatedReseller.name,
          store_name: 'Representação Comercial Zeiq',
          phone: updatePayload.whatsapp || updatedReseller.whatsapp,
        }).eq('id', targetUserId);
      } catch (authUpdateErr) {
        console.warn('Aviso ao sincronizar credenciais no auth:', authUpdateErr);
      }
    } else if (password?.trim() && password.trim().length >= 6 && updatedReseller.email) {
      // Se não tinha user_id mas informou senha agora, cria o usuário auth
      try {
        const { data: newAuth } = await adminSupabase.auth.admin.createUser({
          email: updatedReseller.email,
          password: password.trim(),
          email_confirm: true,
          app_metadata: { role: 'representative' },
          user_metadata: {
            role: 'representative',
            contact_name: updatedReseller.name,
            store_name: 'Representação Comercial Zeiq',
            phone: updatedReseller.whatsapp,
            is_approved: true,
          },
        });
        if (newAuth?.user) {
          await adminSupabase
            .from('resellers')
            .update({ user_id: newAuth.user.id })
            .eq('id', id);

          await adminSupabase.from('profiles').upsert({
            id: newAuth.user.id,
            email: updatedReseller.email,
            contact_name: updatedReseller.name,
            store_name: 'Representação Comercial Zeiq',
            phone: updatedReseller.whatsapp,
            role: 'representative',
            is_approved: true,
          });
        }
      } catch {}
    }

    return NextResponse.json({
      success: true,
      reseller: updatedReseller,
      message: 'Revendedor atualizado com sucesso!',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Remove revendedor (Admin Master)
export async function DELETE(request: NextRequest) {
  try {
    const { isAdmin, isMaster, role } = await verifyAdmin();
    if (!isAdmin || (!isMaster && role !== 'admin')) {
      return NextResponse.json({ success: false, error: 'Acesso restrito à administração.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID do revendedor é obrigatório.' }, { status: 400 });
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: false, error: 'Chave administrativa não configurada.' }, { status: 500 });
    }

    // Busca dados do revendedor antes de remover
    const { data: reseller } = await adminSupabase
      .from('resellers')
      .select('id, user_id, email')
      .eq('id', id)
      .maybeSingle();

    // Desvincula clientes associados em reseller_id e representative_id para não quebrar integridade
    try {
      await adminSupabase
        .from('profiles')
        .update({ reseller_id: null })
        .eq('reseller_id', id);

      await adminSupabase
        .from('profiles')
        .update({ representative_id: null })
        .eq('representative_id', id);

      if (reseller?.user_id) {
        await adminSupabase
          .from('profiles')
          .update({ representative_id: null })
          .eq('representative_id', reseller.user_id);
      }
    } catch {}

    // Exclui da tabela resellers
    const { error: delErr } = await adminSupabase
      .from('resellers')
      .delete()
      .eq('id', id);

    if (delErr) {
      return NextResponse.json({ success: false, error: delErr.message }, { status: 400 });
    }

    // Remove conta do Supabase Auth se existir
    if (reseller?.user_id) {
      try {
        await adminSupabase.auth.admin.deleteUser(reseller.user_id);
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: 'Revendedor excluído com sucesso.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
