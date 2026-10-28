import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const MASTER_EMAILS = [
  'marketing@zeiq.com.br',
  'patrickbrank@outlook.com',
];

export function isMasterEmail(email?: string | null): boolean {
  if (!email) return false;
  return MASTER_EMAILS.includes(email.toLowerCase().trim());
}

export function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return serviceRoleKey ? createAdminClient(supabaseUrl, serviceRoleKey) : null;
}

export async function verifyAdmin(): Promise<{ isAdmin: boolean; isMaster: boolean; user: any | null; role: string }> {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user }, error } = await serverSupabase.auth.getUser();

    if (error || !user) {
      return { isAdmin: false, isMaster: false, user: null, role: 'guest' };
    }

    const email = user.email?.toLowerCase().trim();
    const isMaster = isMasterEmail(email);

    if (isMaster) {
      return { isAdmin: true, isMaster: true, user, role: 'master' };
    }

    let role = user.app_metadata?.role || user.user_metadata?.role;

    // Checa na tabela profiles usando o client administrativo
    const adminClient = getAdminClient();
    if (adminClient) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('role, representative_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.role) {
        role = profile.role;
      }
    }

    // Cargos com acesso ao painel administrativo: master, admin, representative e stock (marketing excluído)
    const isStaff = ['master', 'admin', 'representative', 'stock'].includes(role);
    return { isAdmin: isStaff, isMaster: false, user, role: role || 'reseller' };
  } catch {
    return { isAdmin: false, isMaster: false, user: null, role: 'guest' };
  }
}
