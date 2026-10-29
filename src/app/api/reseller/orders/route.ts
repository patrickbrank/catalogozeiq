import { NextResponse, type NextRequest } from 'next/server';
import { verifyReseller } from '@/lib/supabase/reseller-auth';
import { getAdminClient } from '@/lib/supabase/admin-auth';
import { formatOrderWhatsAppMessage, sanitizeWhatsAppNumber } from '@/lib/services/order-notification';

export const dynamic = 'force-dynamic';

// GET: Retorna APENAS os pedidos pertencentes à carteira do revendedor logado
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyReseller();
    if (!auth.isReseller || !auth.user) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a revendedores autorizados.' }, { status: 403 });
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: true, orders: [] });
    }

    const resellerId = auth.reseller?.id;
    const resellerUserId = auth.reseller?.user_id || auth.user.id;

    // Blindagem de segurança: Se não for Master e não possuir resellerId válido, encerra com lista vazia
    if (!auth.isMaster && !resellerId) {
      return NextResponse.json({ success: true, orders: [] });
    }

    // Se for Master, pode ver todos ou filtrar por revendedor se passar query param
    let query = adminSupabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!auth.isMaster) {
      // Cláusula abrangente com todas as combinações de identificadores (tabela resellers e auth users)
      const repFilters = [
        resellerId ? `reseller_id.eq.${resellerId}` : null,
        resellerId ? `representative_id.eq.${resellerId}` : null,
        resellerUserId ? `reseller_id.eq.${resellerUserId}` : null,
        resellerUserId ? `representative_id.eq.${resellerUserId}` : null,
      ].filter(Boolean).join(',');

      // 1. Busca todos os lojistas vinculados a este representante
      const { data: clients } = await adminSupabase
        .from('profiles')
        .select('id')
        .or(repFilters);

      const clientIds = (clients || []).map((c: any) => c.id);

      if (clientIds.length > 0) {
        query = query.or(`${repFilters},customer_id.in.(${clientIds.join(',')}),user_id.in.(${clientIds.join(',')})`);
      } else {
        query = query.or(repFilters);
      }
    }

    const { data: orders, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message, orders: [] }, { status: 500 });
    }

    // Enriquece pedidos com dados cadastrais complementares do cliente (endereço, CNPJ) para exibição ao revendedor
    const userIds = Array.from(new Set((orders || []).map((o: any) => o.customer_id || o.user_id).filter(Boolean)));
    let customerProfilesMap: Record<string, any> = {};

    if (userIds.length > 0) {
      try {
        const { data: profiles } = await adminSupabase
          .from('profiles')
          .select('id, contact_name, store_name, phone, cnpj_cpf, city, state, address, cep')
          .in('id', userIds);

        (profiles || []).forEach((p: any) => {
          customerProfilesMap[p.id] = p;
        });
      } catch {}
    }

    const enrichedOrders = (orders || []).map((order) => {
      const custId = order.customer_id || order.user_id;
      const custProfile = custId ? customerProfilesMap[custId] : null;

      // Gera mensagem de WhatsApp pré-formatada para o revendedor acionar o cliente
      const clientPhoneClean = sanitizeWhatsAppNumber(order.buyer_phone || custProfile?.phone);
      const prefilledClientMsg = encodeURIComponent(
        `Olá ${order.buyer_name}! Aqui é ${auth.reseller?.name || 'seu representante Zeiq'}. Recebi seu pedido #${order.order_number} e já estou dando andamento. Qualquer dúvida estou à disposição!`
      );
      const clientWhatsAppUrl = clientPhoneClean ? `https://wa.me/${clientPhoneClean}?text=${prefilledClientMsg}` : null;

      // Gera mensagem do pedido formatada para o próprio revendedor reenviar se precisar
      const formattedOrderMsg = formatOrderWhatsAppMessage(order, auth.reseller, custProfile);
      const resellerWhatsAppUrl = auth.reseller?.whatsapp
        ? `https://wa.me/${sanitizeWhatsAppNumber(auth.reseller.whatsapp)}?text=${encodeURIComponent(formattedOrderMsg)}`
        : null;

      return {
        ...order,
        customer_profile: custProfile || null,
        client_whatsapp_url: clientWhatsAppUrl,
        reseller_whatsapp_url: resellerWhatsAppUrl,
      };
    });

    return NextResponse.json({
      success: true,
      orders: enrichedOrders,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH: Revendedor atualiza status do pedido ou anotações comerciais
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyReseller();
    if (!auth.isReseller || !auth.user) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a revendedores autorizados.' }, { status: 403 });
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: false, error: 'Chave administrativa não configurada.' }, { status: 500 });
    }

    const body = await request.json();
    const { id, status, commercial_notes, customer_notes } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID do pedido é obrigatório.' }, { status: 400 });
    }

    // 1. Busca o pedido e valida posse estrita (order.reseller_id == reseller.id)
    const { data: order, error: fetchErr } = await adminSupabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !order) {
      return NextResponse.json({ success: false, error: 'Pedido não localizado.' }, { status: 404 });
    }

    if (!auth.isMaster) {
      const resellerId = auth.reseller?.id;
      const resellerUserId = auth.reseller?.user_id || auth.user.id;
      let isOwner =
        order.reseller_id === resellerId ||
        order.representative_id === resellerUserId ||
        order.reseller_id === resellerUserId ||
        order.representative_id === resellerId;

      if (!isOwner && (order.customer_id || order.user_id)) {
        const targetCustId = order.customer_id || order.user_id;
        const { data: clientProf } = await adminSupabase
          .from('profiles')
          .select('reseller_id, representative_id')
          .eq('id', targetCustId)
          .maybeSingle();

        if (
          clientProf &&
          (clientProf.reseller_id === resellerId ||
            clientProf.representative_id === resellerUserId ||
            clientProf.reseller_id === resellerUserId ||
            clientProf.representative_id === resellerId)
        ) {
          isOwner = true;
        }
      }

      if (!isOwner) {
        return NextResponse.json(
          { success: false, error: 'Você só pode gerenciar pedidos da sua própria carteira de clientes.' },
          { status: 403 }
        );
      }
    }

    // 2. Aplica atualizações permitidas ao revendedor
    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      const validStatuses = ['pending', 'approved', 'processing', 'shipped', 'delivered', 'cancelled'];
      if (validStatuses.includes(status)) {
        updates.status = status;
      }
    }

    if (commercial_notes !== undefined) {
      updates.commercial_notes = commercial_notes?.trim() || null;
    }
    if (customer_notes !== undefined) {
      updates.customer_notes = customer_notes?.trim() || null;
    }

    const { data: updatedOrder, error: updateErr } = await adminSupabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: 'Pedido atualizado com sucesso!',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
