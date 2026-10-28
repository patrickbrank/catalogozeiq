import { NextResponse } from 'next/server';
import { verifyReseller } from '@/lib/supabase/reseller-auth';
import { getAdminClient } from '@/lib/supabase/admin-auth';

export const dynamic = 'force-dynamic';

// GET: Retorna dados do perfil do revendedor logado e métricas da sua carteira
export async function GET() {
  try {
    const auth = await verifyReseller();
    if (!auth.isReseller || !auth.user) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a revendedores autorizados.' }, { status: 403 });
    }

    const adminSupabase = getAdminClient();
    const reseller = auth.reseller;
    const resellerId = reseller?.id;
    const resellerUserId = reseller?.user_id || auth.user.id;

    let totalCustomers = 0;
    let pendingCustomers = 0;
    let totalOrders = 0;
    let pendingOrders = 0;

    if (adminSupabase && resellerId) {
      // 1. Clientes vinculados
      const { data: clients } = await adminSupabase
        .from('profiles')
        .select('id, is_approved')
        .or(`reseller_id.eq.${resellerId},representative_id.eq.${resellerUserId}`);

      if (clients) {
        totalCustomers = clients.length;
        pendingCustomers = clients.filter((c: any) => c.is_approved === false).length;
      }

      // 2. Pedidos vinculados
      const { data: orders } = await adminSupabase
        .from('orders')
        .select('id, status')
        .or(`reseller_id.eq.${resellerId},representative_id.eq.${resellerUserId}`);

      if (orders) {
        totalOrders = orders.length;
        pendingOrders = orders.filter((o: any) => o.status === 'pending').length;
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: auth.user.id,
        email: auth.user.email,
        role: auth.role,
        is_master: auth.isMaster,
      },
      reseller: auth.reseller,
      stats: {
        totalCustomers,
        pendingCustomers,
        approvedCustomers: totalCustomers - pendingCustomers,
        totalOrders,
        pendingOrders,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
