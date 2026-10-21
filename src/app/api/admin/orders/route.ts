import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient, verifyAdmin } from '@/lib/supabase/admin-auth';

// GET: Lista todos os pedidos para o painel administrativo
export async function GET(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: true, orders: [], tableMissing: false });
    }

    const { data, error } = await adminSupabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

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
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a administradores.' }, { status: 403 });
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

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (status) updates.status = status;
    if (tracking_code !== undefined) updates.tracking_code = tracking_code?.trim() || null;
    if (tracking_url !== undefined) updates.tracking_url = tracking_url?.trim() || null;
    if (commercial_notes !== undefined) updates.commercial_notes = commercial_notes?.trim() || null;

    // Busca pedido atual para verificar e processar baixa/estorno de estoque
    const { data: existingOrder } = await adminSupabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (existingOrder && status) {
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
