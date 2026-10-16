import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient, verifyAdmin } from '@/lib/supabase/admin-auth';

export async function GET(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: true, users: [] });
    }

    // 1. Busca todos os usuários do Supabase Auth
    const { data: authData, error: authErr } = await adminSupabase.auth.admin.listUsers({
      perPage: 100,
    });

    if (authErr) {
      return NextResponse.json({ success: false, error: authErr.message }, { status: 500 });
    }

    // 2. Tenta buscar dados da tabela profiles se existir
    let profilesMap: Record<string, any> = {};
    try {
      const { data: profilesData } = await adminSupabase.from('profiles').select('*');
      if (profilesData) {
        profilesData.forEach((p: any) => {
          profilesMap[p.id] = p;
        });
      }
    } catch {
      // Ignora se tabela profiles ainda não foi migrada
    }

    // 3. Monta lista unificada e limpa de clientes e revendedores
    const formattedUsers = authData.users.map((u) => {
      const p = profilesMap[u.id] || {};
      const meta = u.user_metadata || {};

      return {
        id: u.id,
        email: u.email,
        contact_name: p.contact_name || meta.contact_name || u.email?.split('@')[0],
        store_name: p.store_name || meta.store_name || 'Lojista B2B',
        phone: p.phone || meta.phone || '',
        cnpj_cpf: p.cnpj_cpf || meta.cnpj_cpf || '',
        city: p.city || meta.city || '',
        state: p.state || meta.state || '',
        role: p.role || meta.role || (u.email === 'patrickbrank@outlook.com' ? 'admin' : 'reseller'),
        is_approved: p.is_approved ?? true,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed: !!u.email_confirmed_at,
      };
    });

    return NextResponse.json({
      success: true,
      users: formattedUsers,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Administrador cria conta de acesso direta para novo lojista / revendedor
export async function POST(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: false, error: 'Chave de administração Supabase não configurada.' }, { status: 500 });
    }

    const body = await request.json();
    const {
      email,
      password,
      contact_name,
      store_name,
      phone,
      cnpj_cpf,
      city,
      state,
      role = 'reseller',
    } = body;

    if (!email || !email.trim()) {
      return NextResponse.json({ success: false, error: 'E-mail é obrigatório.' }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ success: false, error: 'A senha inicial deve ter no mínimo 6 caracteres.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Cria usuário autenticado no Supabase com confirmação imediata
    const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        role: role === 'admin' ? 'admin' : 'reseller',
        contact_name: contact_name?.trim() || cleanEmail.split('@')[0],
        store_name: store_name?.trim() || 'Lojista B2B',
        phone: phone?.trim() || '',
        cnpj_cpf: cnpj_cpf?.trim() || '',
        city: city?.trim() || '',
        state: state?.trim() || '',
      },
    });

    if (authError) {
      return NextResponse.json({ success: false, error: authError.message }, { status: 400 });
    }

    const newUserId = authUser.user.id;

    // 2. Insere ou atualiza dados complementares na tabela profiles
    try {
      await adminSupabase.from('profiles').upsert({
        id: newUserId,
        email: cleanEmail,
        role: role === 'admin' ? 'admin' : 'reseller',
        contact_name: contact_name?.trim() || cleanEmail.split('@')[0],
        store_name: store_name?.trim() || 'Lojista B2B',
        phone: phone?.trim() || '',
        cnpj_cpf: cnpj_cpf?.trim() || '',
        city: city?.trim() || '',
        state: state?.trim() || '',
        is_approved: true,
      });
    } catch (e) {
      console.warn('Aviso ao sincronizar profile do lojista:', e);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUserId,
        email: cleanEmail,
        contact_name: contact_name?.trim() || cleanEmail.split('@')[0],
        store_name: store_name?.trim() || 'Lojista B2B',
        phone: phone?.trim() || '',
        cnpj_cpf: cnpj_cpf?.trim() || '',
        city: city?.trim() || '',
        state: state?.trim() || '',
        role: role === 'admin' ? 'admin' : 'reseller',
        is_approved: true,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Administrador exclui conta de lojista
export async function DELETE(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'ID do usuário é obrigatório.' }, { status: 400 });
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: false, error: 'Chave administrativa indisponível.' }, { status: 500 });
    }

    // Impede exclusão da conta master
    const { data: targetUser } = await adminSupabase.auth.admin.getUserById(userId);
    if (targetUser?.user?.email?.toLowerCase() === 'patrickbrank@outlook.com') {
      return NextResponse.json({ success: false, error: 'A conta administradora principal não pode ser excluída.' }, { status: 400 });
    }

    // Exclui no auth e no profiles
    const { error: delError } = await adminSupabase.auth.admin.deleteUser(userId);
    if (delError) {
      return NextResponse.json({ success: false, error: delError.message }, { status: 400 });
    }

    try {
      await adminSupabase.from('profiles').delete().eq('id', userId);
    } catch {}

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH: Atualização de senha ou status do lojista pelo administrador
export async function PATCH(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: false, error: 'Chave administrativa indisponível.' }, { status: 500 });
    }

    const body = await request.json();
    const { id, password, is_approved } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID do usuário é obrigatório.' }, { status: 400 });
    }

    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' }, { status: 400 });
      }
      const { error: pwdErr } = await adminSupabase.auth.admin.updateUserById(id, { password });
      if (pwdErr) throw pwdErr;
    }

    if (is_approved !== undefined) {
      await adminSupabase.from('profiles').update({ is_approved }).eq('id', id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
