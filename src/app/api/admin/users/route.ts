import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient, verifyAdmin, isMasterEmail } from '@/lib/supabase/admin-auth';
import { createClient as createServerClient } from '@/lib/supabase/server';

const VALID_ROLES = ['admin', 'representative', 'stock', 'reseller'] as const;
type UserRole = typeof VALID_ROLES[number];

export async function GET(request: NextRequest) {
  try {
    const { isAdmin, isMaster: callerIsMaster, role: callerRole, user: callerUser } = await verifyAdmin();
    if (!isAdmin || !callerUser) {
      return NextResponse.json({ success: false, error: 'Acesso restrito à administração.' }, { status: 403 });
    }

    // Regra: CONTROLE DE ESTOQUE não tem acesso a usuários
    if (callerRole === 'stock') {
      return NextResponse.json(
        { success: false, error: 'Acesso restrito: controle de estoque não visualiza cadastros de usuários.' },
        { status: 403 }
      );
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: true, users: [] });
    }

    // 1. Busca todos os usuários do Supabase Auth
    const { data: authData, error: authErr } = await adminSupabase.auth.admin.listUsers({
      perPage: 250,
    });

    if (authErr) {
      return NextResponse.json({ success: false, error: authErr.message }, { status: 500 });
    }

    // 2. Busca dados da tabela profiles
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

    // 2.1 Busca dados da tabela resellers para identificar representantes comerciais oficiais
    const resellersUserIds = new Set<string>();
    const resellersEmails = new Set<string>();
    try {
      const { data: resellersList } = await adminSupabase.from('resellers').select('id, user_id, email, name');
      if (resellersList) {
        resellersList.forEach((r: any) => {
          if (r.user_id) resellersUserIds.add(r.user_id);
          if (r.email) resellersEmails.add(r.email.toLowerCase().trim());
        });
      }
    } catch {
      // Ignora se tabela resellers ainda não existir
    }

    // 3. Monta lista unificada de usuários com seus dados e cargos
    let formattedUsers = authData.users.map((u) => {
      const p = profilesMap[u.id] || {};
      const meta = u.user_metadata || {};
      const appMeta = u.app_metadata || {};
      const isMaster = isMasterEmail(u.email);
      const authRole = appMeta.role || meta.role;
      let userRole = isMaster ? 'master' : (p.role || authRole || 'reseller');

      // Mapeamento de sinônimos legados
      if (userRole === 'marketing') userRole = 'admin';
      if (userRole === 'ROLE_RESELLER') userRole = 'representative';

      // Se o usuário está cadastrado na tabela oficial de representantes (resellers), garante o cargo de representative
      const isOfficialRep =
        resellersUserIds.has(u.id) ||
        (u.email && resellersEmails.has(u.email.toLowerCase().trim())) ||
        p.store_name === 'Representação Comercial Zeiq';

      if (!isMaster && userRole !== 'admin' && isOfficialRep) {
        userRole = 'representative';
      }

      const repId = p.representative_id || meta.representative_id || null;
      const repProfile = repId ? profilesMap[repId] : null;

      const defaultStore = isMaster
        ? 'Diretoria Zeiq (Master)'
        : userRole === 'admin'
        ? 'Administração Zeiq'
        : userRole === 'representative'
        ? 'Representação Comercial Zeiq'
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
        avatar_url: p.avatar_url || meta.avatar_url || null,
        role: userRole,
        is_master: isMaster,
        is_approved: p.is_approved ?? (appMeta.is_approved ?? meta.is_approved ?? true),
        representative_id: repId,
        representative_name: repProfile?.contact_name || repProfile?.store_name || null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed: !!u.email_confirmed_at,
      };
    });

    // Regra: REPRESENTANTE vê APENAS os lojistas da sua própria carteira
    if (callerRole === 'representative') {
      const { data: resRecord } = await adminSupabase
        .from('resellers')
        .select('id')
        .or(`user_id.eq.${callerUser.id},email.eq.${callerUser.email}`)
        .maybeSingle();

      const resId = resRecord?.id;

      formattedUsers = formattedUsers.filter((u) => {
        if (u.role !== 'reseller') return false;
        const uProfile = profilesMap[u.id] || {};
        return (
          u.representative_id === callerUser.id ||
          uProfile.representative_id === callerUser.id ||
          uProfile.reseller_id === callerUser.id ||
          (resId && (u.representative_id === resId || uProfile.representative_id === resId || uProfile.reseller_id === resId))
        );
      });
    }

    return NextResponse.json({
      success: true,
      users: formattedUsers,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Criação de novo usuário / lojista
export async function POST(request: NextRequest) {
  try {
    const { isAdmin, isMaster: callerIsMaster, role: callerRole, user: callerUser } = await verifyAdmin();
    if (!isAdmin || !callerUser) {
      return NextResponse.json({ success: false, error: 'Acesso restrito à administração.' }, { status: 403 });
    }

    // Regra: CONTROLE DE ESTOQUE não cria usuários
    if (callerRole === 'stock') {
      return NextResponse.json(
        { success: false, error: 'Acesso restrito: controle de estoque não cadastra usuários.' },
        { status: 403 }
      );
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
      representative_id,
    } = body;

    if (!email || !email.trim()) {
      return NextResponse.json({ success: false, error: 'E-mail é obrigatório.' }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ success: false, error: 'A senha inicial deve ter no mínimo 6 caracteres.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    let cleanRole: UserRole = role && (VALID_ROLES as readonly string[]).includes(role) ? role : 'reseller';

    // Regra: Representante só pode criar Lojistas na sua própria carteira
    let targetRepId = representative_id || null;
    if (callerRole === 'representative') {
      cleanRole = 'reseller';
      targetRepId = callerUser.id;
    }

    // Regra: Apenas Master pode criar admins
    if (cleanRole === 'admin' && !callerIsMaster) {
      return NextResponse.json(
        { success: false, error: 'Apenas usuários Master podem conceder permissão de Administrador.' },
        { status: 403 }
      );
    }

    const defaultStore = cleanRole === 'admin'
      ? 'Administração Zeiq'
      : cleanRole === 'representative'
      ? 'Representação Comercial'
      : cleanRole === 'stock'
      ? 'Estoque Zeiq'
      : 'Lojista B2B';

    // 1. Cria usuário autenticado no Supabase
    const { data: authUser, error: authError } = await adminSupabase.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true,
      app_metadata: {
        role: cleanRole,
        representative_id: targetRepId,
      },
      user_metadata: {
        role: cleanRole,
        contact_name: contact_name?.trim() || cleanEmail.split('@')[0],
        store_name: store_name?.trim() || defaultStore,
        phone: phone?.trim() || '',
        cnpj_cpf: cnpj_cpf?.trim() || '',
        city: city?.trim() || '',
        state: state?.trim() || '',
        representative_id: targetRepId,
        is_approved: true,
      },
    });

    if (authError) {
      return NextResponse.json({ success: false, error: authError.message }, { status: 400 });
    }

    const newUserId = authUser.user.id;

    // 2. Insere na tabela profiles
    try {
      const profilePayload: any = {
        id: newUserId,
        email: cleanEmail,
        role: cleanRole,
        contact_name: contact_name?.trim() || cleanEmail.split('@')[0],
        store_name: store_name?.trim() || defaultStore,
        phone: phone?.trim() || '',
        cnpj_cpf: cnpj_cpf?.trim() || '',
        city: city?.trim() || '',
        state: state?.trim() || '',
        representative_id: targetRepId,
        is_approved: true,
      };

      const serverSupabase = await createServerClient();
      const { error: srvErr } = await serverSupabase.from('profiles').upsert(profilePayload);
      if (srvErr) {
        await adminSupabase.from('profiles').upsert(profilePayload);
      }

      // Se for cadastrado com cargo de representante comercial, sincroniza na tabela resellers
      if (cleanRole === 'representative') {
        const cleanWhatsapp = (phone || '').replace(/\D/g, '');
        try {
          await adminSupabase.from('resellers').upsert({
            name: contact_name?.trim() || cleanEmail.split('@')[0],
            email: cleanEmail,
            whatsapp: cleanWhatsapp || '00000000000',
            phone: phone?.trim() || null,
            status: 'ativo',
            notification_preference: 'both',
            user_id: newUserId,
          }, { onConflict: 'email' });
        } catch (resErr) {
          console.warn('Aviso ao sincronizar tabela resellers:', resErr);
        }
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
        representative_id: targetRepId,
        is_approved: true,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Exclusão de usuário
export async function DELETE(request: NextRequest) {
  try {
    const { isAdmin, isMaster: callerIsMaster, role: callerRole, user: callerUser } = await verifyAdmin();
    if (!isAdmin || !callerUser) {
      return NextResponse.json({ success: false, error: 'Acesso restrito à administração.' }, { status: 403 });
    }

    // Regra: CONTROLE DE ESTOQUE não exclui usuários
    if (callerRole === 'stock') {
      return NextResponse.json(
        { success: false, error: 'Acesso restrito: controle de estoque não gerencia usuários.' },
        { status: 403 }
      );
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

    // Busca usuário alvo
    const { data: targetUserRes } = await adminSupabase.auth.admin.getUserById(userId);
    const targetUser = targetUserRes?.user;
    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'Usuário não localizado.' }, { status: 404 });
    }

    // Regra: Ninguém pode excluir conta Master
    if (isMasterEmail(targetUser.email)) {
      return NextResponse.json({ success: false, error: 'A conta administradora Master é protegida e não pode ser excluída.' }, { status: 400 });
    }

    // Busca profile do alvo para checar cargo
    let targetProfileRole = targetUser.app_metadata?.role || targetUser.user_metadata?.role || 'reseller';
    let targetRepId = targetUser.app_metadata?.representative_id || targetUser.user_metadata?.representative_id;
    let targetResellerId: string | null = null;
    try {
      const { data: prof } = await adminSupabase.from('profiles').select('role, representative_id, reseller_id').eq('id', userId).maybeSingle();
      if (prof) {
        if (prof.role) targetProfileRole = prof.role;
        if (prof.representative_id) targetRepId = prof.representative_id;
        if (prof.reseller_id) targetResellerId = prof.reseller_id;
      }
    } catch {}

    // Regra: REPRESENTANTE não pode excluir ADMINISTRADOR, ESTOQUE, REPRESENTANTE ou MASTER
    if (callerRole === 'representative') {
      const { data: resRecord } = await adminSupabase
        .from('resellers')
        .select('id')
        .or(`user_id.eq.${callerUser.id},email.eq.${callerUser.email}`)
        .maybeSingle();

      const resId = resRecord?.id;
      const isOwnedLojista =
        targetRepId === callerUser.id ||
        targetResellerId === callerUser.id ||
        (resId && (targetRepId === resId || targetResellerId === resId));

      if (targetProfileRole !== 'reseller') {
        return NextResponse.json(
          { success: false, error: 'Representantes não podem excluir membros da equipe ou administração.' },
          { status: 403 }
        );
      }
      if (!isOwnedLojista) {
        return NextResponse.json(
          { success: false, error: 'Você só pode excluir lojistas pertencentes à sua própria carteira.' },
          { status: 403 }
        );
      }
    }

    // Regra: ADMINISTRADOR comum não pode excluir MASTER
    if (!callerIsMaster && isMasterEmail(targetUser.email)) {
      return NextResponse.json({ success: false, error: 'Apenas a conta Master pode gerenciar contas Master.' }, { status: 403 });
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

// Atualização de usuário (dados, ativação/desativação, aprovação, cargo)
async function handleUpdateUser(request: NextRequest) {
  try {
    const { isAdmin, isMaster: callerIsMaster, role: callerRole, user: callerUser } = await verifyAdmin();
    if (!isAdmin || !callerUser) {
      return NextResponse.json({ success: false, error: 'Acesso restrito à administração.' }, { status: 403 });
    }

    // Regra: CONTROLE DE ESTOQUE não altera usuários
    if (callerRole === 'stock') {
      return NextResponse.json(
        { success: false, error: 'Acesso restrito: controle de estoque não gerencia usuários.' },
        { status: 403 }
      );
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
      representative_id,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID do usuário é obrigatório.' }, { status: 400 });
    }

    // Busca usuário alvo
    const { data: targetUserRes, error: fetchErr } = await adminSupabase.auth.admin.getUserById(id);
    if (fetchErr || !targetUserRes?.user) {
      return NextResponse.json({ success: false, error: 'Usuário não localizado.' }, { status: 404 });
    }

    const targetUser = targetUserRes.user;
    const targetIsMaster = isMasterEmail(targetUser.email);

    // Regra: Conta Master não pode ser alterada por administrador comum
    if (targetIsMaster && !callerIsMaster) {
      return NextResponse.json(
        { success: false, error: 'A conta Master é protegida e só pode ser alterada pela própria Master.' },
        { status: 403 }
      );
    }

    // Busca profile do alvo
    let targetProfileRole = targetUser.app_metadata?.role || targetUser.user_metadata?.role || 'reseller';
    let targetRepId = targetUser.app_metadata?.representative_id || targetUser.user_metadata?.representative_id;
    let targetResellerId: string | null = null;
    try {
      const { data: prof } = await adminSupabase.from('profiles').select('role, representative_id, reseller_id').eq('id', id).maybeSingle();
      if (prof) {
        if (prof.role) targetProfileRole = prof.role;
        if (prof.representative_id) targetRepId = prof.representative_id;
        if (prof.reseller_id) targetResellerId = prof.reseller_id;
      }
    } catch {}

    // Regra: REPRESENTANTE só pode gerenciar lojistas da sua carteira (aprovar, ativar/desativar)
    if (callerRole === 'representative') {
      const { data: resRecord } = await adminSupabase
        .from('resellers')
        .select('id')
        .or(`user_id.eq.${callerUser.id},email.eq.${callerUser.email}`)
        .maybeSingle();

      const resId = resRecord?.id;
      const isOwnedLojista =
        targetRepId === callerUser.id ||
        targetResellerId === callerUser.id ||
        (resId && (targetRepId === resId || targetResellerId === resId));

      if (targetProfileRole !== 'reseller') {
        return NextResponse.json(
          { success: false, error: 'Representantes não podem alterar membros da equipe ou administração.' },
          { status: 403 }
        );
      }
      if (!isOwnedLojista) {
        return NextResponse.json(
          { success: false, error: 'Você só tem permissão para gerenciar lojistas da sua própria carteira.' },
          { status: 403 }
        );
      }
      // Representante NÃO pode alterar o cargo do lojista
      if (role && role !== 'reseller') {
        return NextResponse.json(
          { success: false, error: 'Representantes não têm permissão para alterar cargos.' },
          { status: 403 }
        );
      }
    }

    // Determina cargo final
    let targetRole = targetIsMaster
      ? 'master'
      : (role && (VALID_ROLES as readonly string[]).includes(role) ? role : undefined);

    // Bloqueia atribuição de admin por não-master
    if (targetRole === 'admin' && !callerIsMaster && targetProfileRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Apenas a conta Master pode promover usuários para Administrador.' },
        { status: 403 }
      );
    }

    let targetApproved = targetIsMaster ? true : is_approved;

    // Atualiza auth
    const authUpdates: any = {};
    if (password && password.trim()) {
      if (password.length < 6) {
        return NextResponse.json({ success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' }, { status: 400 });
      }
      authUpdates.password = password;
    }

    authUpdates.app_metadata = {
      ...(targetUser.app_metadata || {}),
      ...(targetRole ? { role: targetRole } : {}),
      ...(targetApproved !== undefined ? { is_approved: targetApproved } : {}),
      ...(representative_id !== undefined ? { representative_id } : {}),
    };

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
      ...(representative_id !== undefined ? { representative_id } : {}),
    };
    authUpdates.user_metadata = updatedUserMeta;

    const { error: updateAuthErr } = await adminSupabase.auth.admin.updateUserById(id, authUpdates);
    if (updateAuthErr) {
      return NextResponse.json({ success: false, error: updateAuthErr.message }, { status: 400 });
    }

    // Atualiza profiles
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
      if (representative_id !== undefined) profileData.representative_id = representative_id;

      const serverSupabase = await createServerClient();
      const { error: srvErr } = await serverSupabase.from('profiles').upsert(profileData);
      if (srvErr) {
        await adminSupabase.from('profiles').upsert(profileData);
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
        representative_id: representative_id !== undefined ? representative_id : targetRepId,
        is_approved: targetApproved ?? true,
        is_master: targetIsMaster,
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
