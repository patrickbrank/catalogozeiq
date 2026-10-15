import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return serviceRoleKey ? createAdminClient(supabaseUrl, serviceRoleKey) : null;
}

export async function verifyAdmin(): Promise<{ isAdmin: boolean; user: any | null }> {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user }, error } = await serverSupabase.auth.getUser();

    if (error || !user) {
      return { isAdmin: false, user: null };
    }

    // Valida e-mail master ou app_metadata (protegido pelo servidor, não manipulável pelo cliente)
    const email = user.email?.toLowerCase();
    if (email === 'patrickbrank@outlook.com' || user.app_metadata?.role === 'admin') {
      return { isAdmin: true, user };
    }

    // Checa na tabela profiles usando o client administrativo
    const adminClient = getAdminClient();
    if (adminClient) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.role === 'admin') {
        return { isAdmin: true, user };
      }
    }

    return { isAdmin: false, user };
  } catch {
    return { isAdmin: false, user: null };
  }
}
