import { createClient as createServerClient } from '@/lib/supabase/server';
import { getAdminClient, isMasterEmail } from '@/lib/supabase/admin-auth';
import { Reseller } from '@/types';

export interface ResellerAuthResult {
  isReseller: boolean;
  isMaster: boolean;
  isAdmin: boolean;
  user: any | null;
  reseller: Reseller | null;
  role: string;
}

/**
 * Valida se o usuário atualmente autenticado possui perfil de Revendedor Comercial
 * ou privilégios de Master/Administrador.
 */
export async function verifyReseller(): Promise<ResellerAuthResult> {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user }, error } = await serverSupabase.auth.getUser();

    if (error || !user) {
      return {
        isReseller: false,
        isMaster: false,
        isAdmin: false,
        user: null,
        reseller: null,
        role: 'guest',
      };
    }

    const email = user.email?.toLowerCase().trim();
    const isMaster = isMasterEmail(email);

    const adminClient = getAdminClient();
    const dbClient = adminClient || serverSupabase;

    // 1. Busca perfil do usuário
    let role = user.app_metadata?.role || user.user_metadata?.role;
    let userProfile: any = null;

    try {
      const { data: prof } = await dbClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (prof) {
        userProfile = prof;
        if (prof.role) role = prof.role;
      }
    } catch {}

    const isAdmin = isMaster || role === 'admin' || role === 'master';

    // 2. Busca o registro correspondente na tabela resellers
    let resellerRecord: Reseller | null = null;
    try {
      // Tenta por user_id primeiro, depois por e-mail
      const { data: resByUserId } = await dbClient
        .from('resellers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (resByUserId) {
        resellerRecord = resByUserId as Reseller;
      } else if (email) {
        const { data: resByEmail } = await dbClient
          .from('resellers')
          .select('*')
          .ilike('email', email)
          .maybeSingle();

        if (resByEmail) {
          resellerRecord = resByEmail as Reseller;
          // Se encontrou por e-mail mas user_id estava vazio, vincula agora
          if (!resByEmail.user_id && adminClient) {
            try {
              await adminClient
                .from('resellers')
                .update({ user_id: user.id })
                .eq('id', resByEmail.id);
            } catch {}
          }
        }
      }
    } catch (e) {
      console.warn('Aviso ao consultar tabela resellers:', e);
    }

    // Se for Master/Admin, pode visualizar o painel do revendedor se desejar
    if (isAdmin) {
      return {
        isReseller: true,
        isMaster,
        isAdmin: true,
        user,
        reseller: resellerRecord || {
          id: 'admin-preview',
          name: userProfile?.contact_name || user.email?.split('@')[0] || 'Administrador',
          email: user.email || '',
          whatsapp: '00000000000',
          status: 'ativo',
          notification_preference: 'both',
        },
        role: role || (isMaster ? 'master' : 'admin'),
      };
    }

    // Valida se o usuário é um Representante Comercial ou Revendedor cadastrado
    const isRepRole = role === 'representative' || role === 'ROLE_RESELLER';
    const isResellerActive = !!resellerRecord && resellerRecord.status === 'ativo';

    if (isRepRole || isResellerActive) {
      const finalReseller: Reseller = resellerRecord || {
        id: user.id,
        name: userProfile?.contact_name || user.user_metadata?.contact_name || user.email?.split('@')[0] || 'Representante Comercial',
        email: user.email || '',
        whatsapp: userProfile?.phone || user.user_metadata?.phone || '00000000000',
        phone: userProfile?.phone || user.user_metadata?.phone || null,
        status: 'ativo',
        notification_preference: 'both',
        user_id: user.id,
      };

      return {
        isReseller: true,
        isMaster: false,
        isAdmin: false,
        user,
        reseller: finalReseller,
        role: 'representative',
      };
    }

    return {
      isReseller: false,
      isMaster: false,
      isAdmin: false,
      user,
      reseller: null,
      role: role || 'reseller',
    };
  } catch (err) {
    return {
      isReseller: false,
      isMaster: false,
      isAdmin: false,
      user: null,
      reseller: null,
      role: 'guest',
    };
  }
}
