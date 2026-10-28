import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient, verifyAdmin, isMasterEmail } from '@/lib/supabase/admin-auth';
import { createClient as createServerClient } from '@/lib/supabase/server';

const VALID_ROLES = ['admin', 'marketing', 'stock', 'reseller'] as const;
type UserRole = typeof VALID_ROLES[number];

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

    // 3. Monta lista unificada e limpa de clientes e membros da equipe
    const formattedUsers = authData.users.map((u) => {
      const p = profilesMap[u.id] || {};
      const meta = u.user_metadata || {};
      const appMeta = u.app_metadata || {};
      const isMaster = isMasterEmail(u.email);
      const authRole = appMeta.role || meta.role;
      const userRole = isMaster ? 'admin' : (authRole || p.role || 'reseller');

      const defaultStore = isMaster
        ? 'Diretoria Zeiq (Master)'
        : userRole === 'admin'
        ? 'Administração Zeiq'
        : userRole === 'marketing'
        ? 'Marketing Zeiq'
        : userRole === 'stock'
        ? 'Estoque Zeiq'
        : 'Lojista B2B';

      return {
        id: u.id,
        email: u.email,
        contact_name: p.contact_name || meta.contact_name || u.email?.split('@')[0],
        store_name: p.store_name || meta.store_name || defaultStore,
        phone: p.phone || meta.phone || '',
        cnpj_cpf: p.cnpj_cpf || meta.cnpj_cpf || '',
        city: p.city || meta.city || '',
        state: p.state || meta.state || '',
        role: userRole,
        is_master: isMaster,
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
    const cleanRole = role && (VALID_ROLES as readonly string[]).includes(role) ? role : 'reseller';
    const defaultStore = cleanRole === 'admin'
      ? 'Administração Zeiq'
      : cleanRole === 'marketing'
      ? 'Marketing Zeiq'
      : cleanRole === 'stock'
      ? 'Estoque Zeiq'
      : 'Lojista B2B';

    // 1. Cria usuário autenticado no Supabase com confirmação imediata
    const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      app_metadata: {
        role: cleanRole,
      },
      user_metadata: {
        role: cleanRole,
        contact_name: contact_name?.trim() || cleanEmail.split('@')[0],
        store_name: store_name?.trim() || defaultStore,
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
      const profilePayload = {
        id: newUserId,
        email: cleanEmail,
        role: cleanRole,
        contact_name: contact_name?.trim() || cleanEmail.split('@')[0],
        store_name: store_name?.trim() || defaultStore,
        phone: phone?.trim() || '',
        cnpj_cpf: cnpj_cpf?.trim() || '',
        city: city?.trim() || '',
        state: state?.trim() || '',
        is_approved: true,
      };

      const serverSupabase = await createServerClient();
      const { error: srvErr } = await serverSupabase.from('profiles').upsert(profilePayload);
      if (srvErr) {
        await adminSupabase.from('profiles').upsert(profilePayload);
      }
    } catch (e) {
      console.warn('Aviso ao sincronizar profile do usuário:', e);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUserId,
        email: cleanEmail,
        contact_name: contact_name?.trim() || cleanEmail.split('@')[0],
        store_name: store_name?.trim() || defaultStore,
        phone: phone?.trim() || '',
        cnpj_cpf: cnpj_cpf?.trim() || '',
        city: city?.trim() || '',
        state: state?.trim() || '',
        role: cleanRole,
        is_approved: true,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Administrador exclui conta de lojista ou membro administrativo
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

    // Impede exclusão da conta master principal
    const { data: targetUser } = await adminSupabase.auth.admin.getUserById(userId);
    if (isMasterEmail(targetUser?.user?.email)) {
      return NextResponse.json({ success: false, error: 'A conta administradora master não pode ser excluída.' }, { status: 400 });
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

// Atualização de dados cadastrais, cargo, senha ou status pelo administrador
async function handleUpdateUser(request: NextRequest) {
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
    const {
      id,
      contact_name,
      store_name,
      phone,
      cnpj_cpf,
      city,
      state,
      role,
      password,
      is_approved,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID do usuário é obrigatório.' }, { status: 400 });
    }

    // Busca usuário atual para validar restrições da conta master
    const { data: targetUserRes, error: fetchErr } = await adminSupabase.auth.admin.getUserById(id);
    if (fetchErr || !targetUserRes?.user) {
      return NextResponse.json({ success: false, error: 'Usuário não localizado.' }, { status: 404 });
    }

    const targetUser = targetUserRes.user;
    const isMaster = isMasterEmail(targetUser.email);

    // A conta master nunca pode perder o papel de admin nem ser inativada
    let targetRole = isMaster ? 'admin' : (role && (VALID_ROLES as readonly string[]).includes(role) ? role : undefined);
    let targetApproved = isMaster ? true : is_approved;

    // 1. Atualiza dados de autenticação no Supabase Auth
    const authUpdates: any = {};

    if (password && password.trim()) {
      if (password.length < 6) {
        return NextResponse.json({ success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' }, { status: 400 });
      }
      authUpdates.password = password;
    }

    if (targetRole || targetApproved !== undefined) {
      authUpdates.app_metadata = {
        ...(targetUser.app_metadata || {}),
        ...(targetRole ? { role: targetRole } : {}),
        ...(targetApproved !== undefined ? { is_approved: targetApproved } : {}),
      };
    }

    const updatedUserMeta = {
      ...(targetUser.user_metadata || {}),
      ...(targetRole ? { role: targetRole } : {}),
      ...(contact_name !== undefined ? { contact_name: contact_name.trim() } : {}),
      ...(store_name !== undefined ? { store_name: store_name.trim() } : {}),
      ...(phone !== undefined ? { phone: phone.trim() } : {}),
      ...(cnpj_cpf !== undefined ? { cnpj_cpf: cnpj_cpf.trim() } : {}),
      ...(city !== undefined ? { city: city.trim() } : {}),
      ...(state !== undefined ? { state: state.trim() } : {}),
      ...(targetApproved !== undefined ? { is_approved: targetApproved } : {}),
    };
    authUpdates.user_metadata = updatedUserMeta;

    const { error: updateAuthErr } = await adminSupabase.auth.admin.updateUserById(id, authUpdates);
    if (updateAuthErr) {
      return NextResponse.json({ success: false, error: updateAuthErr.message }, { status: 400 });
    }

    // 2. Atualiza ou insere na tabela profiles
    try {
      const profileData: any = {
        id,
        email: targetUser.email,
        updated_at: new Date().toISOString(),
      };

      if (targetRole) profileData.role = targetRole;
      if (contact_name !== undefined) profileData.contact_name = contact_name.trim();
      if (store_name !== undefined) profileData.store_name = store_name.trim();
      if (phone !== undefined) profileData.phone = phone.trim();
      if (cnpj_cpf !== undefined) profileData.cnpj_cpf = cnpj_cpf.trim();
      if (city !== undefined) profileData.city = city.trim();
      if (state !== undefined) profileData.state = state.trim();
      if (targetApproved !== undefined) profileData.is_approved = targetApproved;

      // Gravação direta com privilégios de service_role
      const { error: adminUpsertErr } = await adminSupabase.from('profiles').upsert(profileData);
      if (adminUpsertErr) {
        const serverSupabase = await createServerClient();
        await serverSupabase.from('profiles').upsert(profileData);
      }
    } catch (profileErr) {
      console.warn('Aviso ao atualizar profiles:', profileErr);
    }

    return NextResponse.json({
      success: true,
      user: {
        id,
        email: targetUser.email,
        contact_name: updatedUserMeta.contact_name,
        store_name: updatedUserMeta.store_name,
        phone: updatedUserMeta.phone,
        cnpj_cpf: updatedUserMeta.cnpj_cpf,
        city: updatedUserMeta.city,
        state: updatedUserMeta.state,
        role: targetRole || targetUser.user_metadata?.role || 'reseller',
        is_approved: targetApproved ?? true,
        is_master: isMaster,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  return handleUpdateUser(request);
}

export async function PUT(request: NextRequest) {
  return handleUpdateUser(request);
}
