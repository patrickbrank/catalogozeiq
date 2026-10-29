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

    if (adminSupabase && (resellerId || resellerUserId)) {
      const repFilters = [
        resellerId ? `reseller_id.eq.${resellerId}` : null,
        resellerId ? `representative_id.eq.${resellerId}` : null,
        resellerUserId ? `reseller_id.eq.${resellerUserId}` : null,
        resellerUserId ? `representative_id.eq.${resellerUserId}` : null,
      ].filter(Boolean).join(',');

      // 1. Clientes vinculados
      const { data: clients } = await adminSupabase
        .from('profiles')
        .select('id, is_approved')
        .or(repFilters);

      const clientIds = (clients || []).map((c: any) => c.id);

      if (clients) {
        totalCustomers = clients.length;
        pendingCustomers = clients.filter((c: any) => c.is_approved === false).length;
      }

      // 2. Pedidos vinculados
      let ordersQuery = adminSupabase.from('orders').select('id, status');
      if (clientIds.length > 0) {
        ordersQuery = ordersQuery.or(`${repFilters},customer_id.in.(${clientIds.join(',')}),user_id.in.(${clientIds.join(',')})`);
      } else {
        ordersQuery = ordersQuery.or(repFilters);
      }

      const { data: orders } = await ordersQuery;

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
