import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient, verifyAdmin } from '@/lib/supabase/admin-auth';

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
        .or(`user_id.eq.${callerUser.id},email.eq.${callerUser.email}`)
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

    return NextResponse.json({
      success: true,
      orders: data || [],
    });
  } catch (err: any) {
    return NextResponse.json({
      success: true,
      orders: [],
      error: err.message,
    });
  }
}

// Função auxiliar para baixar ou estornar itens do estoque dos produtos
async function processStockMovement(adminSupabase: any, items: any[], isDeduction: boolean) {
  if (!items || !Array.isArray(items)) return;

  for (const item of items) {
    const prodId = item.productId;
    if (!prodId) continue;

    try {
      const { data: prod } = await adminSupabase
        .from('products')
        .select('id, stock_by_size, total_stock')
        .eq('id', prodId)
        .maybeSingle();

      if (!prod) continue;

      const currentStock: Record<string, number> = { ...(prod.stock_by_size || {}) };
      const multiplier = isDeduction ? -1 : 1;

      if (item.sizeBreakdown && Object.keys(item.sizeBreakdown).length > 0) {
        Object.entries(item.sizeBreakdown).forEach(([sz, qty]) => {
          const numQty = Number(qty) || 0;
          const prevQty = currentStock[sz] ?? 0;
          currentStock[sz] = Math.max(0, prevQty + (numQty * multiplier));
        });
      } else if (item.selectedSize) {
        const numQty = Number(item.quantity) || 1;
        const prevQty = currentStock[item.selectedSize] ?? 0;
        currentStock[item.selectedSize] = Math.max(0, prevQty + (numQty * multiplier));
      } else {
        const numQty = Number(item.quantity) || 1;
        const prevQty = currentStock['_padrao'] ?? (prod.total_stock ?? 0);
        currentStock['_padrao'] = Math.max(0, prevQty + (numQty * multiplier));
      }

      const newTotal = Object.values(currentStock).reduce((sum, val) => sum + (Number(val) || 0), 0);

      await adminSupabase
        .from('products')
        .update({
          stock_by_size: currentStock,
          total_stock: newTotal,
        })
        .eq('id', prodId);
    } catch (e) {
      console.warn(`Erro ao processar estoque do produto ${prodId}:`, e);
    }
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
        .or(`user_id.eq.${callerUser.id},email.eq.${callerUser.email}`)
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

    if (status) updates.status = status;
    if (tracking_code !== undefined) updates.tracking_code = tracking_code?.trim() || null;
    if (tracking_url !== undefined) updates.tracking_url = tracking_url?.trim() || null;
    if (commercial_notes !== undefined) updates.commercial_notes = commercial_notes?.trim() || null;

    // Se mudou status, atualiza estoque se necessário
    if (status) {
      const isCurrentlyDeducted = !!existingOrder.stock_deducted;
      const isMovingToApproved = status === 'approved' || status === 'processing';
      const isMovingToCancelled = status === 'cancelled';

      if (!isCurrentlyDeducted && isMovingToApproved) {
        await processStockMovement(adminSupabase, existingOrder.items, true);
        updates.stock_deducted = true;
      } else if (isCurrentlyDeducted && isMovingToCancelled) {
        await processStockMovement(adminSupabase, existingOrder.items, false);
        updates.stock_deducted = false;
      }
    }

    let { data, error } = await adminSupabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error && error.message?.includes('stock_deducted')) {
      delete updates.stock_deducted;
      const retry = await adminSupabase
        .from('orders')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      order: data,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
