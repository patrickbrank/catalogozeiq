import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient, verifyAdmin } from '@/lib/supabase/admin-auth';
import { enrichOrdersWithLiveResellers } from '@/lib/services/reseller-sync';
import { updateOrderWithStockSync } from '@/lib/services/order-stock';
import { OrderStatus } from '@/types';

export const dynamic = 'force-dynamic';

// GET: Lista pedidos para o painel administrativo conforme o cargo do usuário
export async function GET(request: NextRequest) {
  try {
    const { isAdmin, role: callerRole, user: callerUser } = await verifyAdmin();
    if (!isAdmin || !callerUser) {
      return NextResponse.json({ success: false, error: 'Acesso restrito à administração.' }, { status: 403 });
    }

    // Regra: CONTROLE DE ESTOQUE não visualiza pedidos
    if (callerRole === 'stock') {
      return NextResponse.json(
        { success: false, error: 'Acesso restrito: controle de estoque não visualiza pedidos de clientes.' },
        { status: 403 }
      );
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: true, orders: [], tableMissing: false });
    }

    let query = adminSupabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    // Regra: REPRESENTANTE vê apenas pedidos da sua carteira de lojistas
    if (callerRole === 'representative') {
      const { data: resRecord } = await adminSupabase
        .from('resellers')
        .select('id')
        .or(`user_id.eq.${callerUser.id},email.ilike.${callerUser.email}`)
        .limit(1)
        .maybeSingle();

      const resId = resRecord?.id;
      const repFilter = resId
        ? `representative_id.eq.${callerUser.id},reseller_id.eq.${resId},representative_id.eq.${resId},reseller_id.eq.${callerUser.id}`
        : `representative_id.eq.${callerUser.id}`;

      // Busca os IDs dos lojistas da carteira deste representante
      const { data: lojistas } = await adminSupabase
        .from('profiles')
        .select('id')
        .or(repFilter);

      const lojistaIds = (lojistas || []).map((l: any) => l.id);

      if (lojistaIds.length > 0) {
        query = query.or(`${repFilter},user_id.in.(${lojistaIds.join(',')}),customer_id.in.(${lojistaIds.join(',')})`);
      } else {
        query = query.or(repFilter);
      }
    }

    const { data, error } = await query;

    if (error) {
      const isMissing = error.message?.includes('schema cache') || error.code === '42P01';
      return NextResponse.json({
        success: true,
        orders: [],
        tableMissing: isMissing,
        error: isMissing ? 'Tabela orders ainda não criada no Supabase.' : error.message,
      });
    }

    const liveOrders = await enrichOrdersWithLiveResellers(adminSupabase, data || []);

    return NextResponse.json({
      success: true,
      orders: liveOrders,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: true,
      orders: [],
      error: err.message,
    });
  }
}

// PATCH: Atualiza status, rastreio ou notas comerciais de um pedido
export async function PATCH(request: NextRequest) {
  try {
    const { isAdmin, role: callerRole, user: callerUser } = await verifyAdmin();
    if (!isAdmin || !callerUser) {
      return NextResponse.json({ success: false, error: 'Acesso restrito à administração.' }, { status: 403 });
    }

    // Regra: CONTROLE DE ESTOQUE não altera pedidos
    if (callerRole === 'stock') {
      return NextResponse.json(
        { success: false, error: 'Acesso restrito: controle de estoque não gerencia pedidos de clientes.' },
        { status: 403 }
      );
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: false, error: 'Chave administrativa não configurada.' }, { status: 500 });
    }

    const body = await request.json();
    const { id, status, tracking_code, tracking_url, commercial_notes } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID do pedido é obrigatório.' }, { status: 400 });
    }

    // Busca pedido atual
    const { data: existingOrder } = await adminSupabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!existingOrder) {
      return NextResponse.json({ success: false, error: 'Pedido não localizado.' }, { status: 404 });
    }

    // Regra: REPRESENTANTE só pode alterar pedidos da sua carteira
    if (callerRole === 'representative') {
      const { data: resRecord } = await adminSupabase
        .from('resellers')
        .select('id')
        .or(`user_id.eq.${callerUser.id},email.ilike.${callerUser.email}`)
        .limit(1)
        .maybeSingle();

      const resId = resRecord?.id;
      let isAllowed =
        existingOrder.representative_id === callerUser.id ||
        existingOrder.reseller_id === callerUser.id ||
        (resId && (existingOrder.representative_id === resId || existingOrder.reseller_id === resId));

      if (!isAllowed && (existingOrder.user_id || existingOrder.customer_id)) {
        const custId = existingOrder.customer_id || existingOrder.user_id;
        const { data: buyerProfile } = await adminSupabase
          .from('profiles')
          .select('representative_id, reseller_id')
          .eq('id', custId)
          .maybeSingle();

        if (
          buyerProfile &&
          (buyerProfile.representative_id === callerUser.id ||
            buyerProfile.reseller_id === callerUser.id ||
            (resId && (buyerProfile.representative_id === resId || buyerProfile.reseller_id === resId)))
        ) {
          isAllowed = true;
        }
      }

      if (!isAllowed) {
        return NextResponse.json(
          { success: false, error: 'Você só tem permissão para alterar pedidos dos seus lojistas.' },
          { status: 403 }
        );
      }
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    const validStatuses: OrderStatus[] = ['pending', 'approved', 'processing', 'shipped', 'delivered', 'cancelled'];
    const validatedStatus = status && validStatuses.includes(status) ? (status as OrderStatus) : undefined;
    if (validatedStatus) updates.status = validatedStatus;
    if (tracking_code !== undefined) updates.tracking_code = tracking_code?.trim() || null;
    if (tracking_url !== undefined) updates.tracking_url = tracking_url?.trim() || null;
    if (commercial_notes !== undefined) updates.commercial_notes = commercial_notes?.trim() || null;

    const { order: data, error, stockAction } = await updateOrderWithStockSync(
      adminSupabase,
      existingOrder,
      updates,
      validatedStatus
    );

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const [enrichedOrder] = await enrichOrdersWithLiveResellers(adminSupabase, data ? [data] : []);

    return NextResponse.json({
      success: true,
      order: enrichedOrder || data,
      stockAction,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
