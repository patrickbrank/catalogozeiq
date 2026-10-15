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
