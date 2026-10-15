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

    const { data, error } = await adminSupabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

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
