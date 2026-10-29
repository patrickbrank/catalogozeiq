import { NextResponse, type NextRequest } from 'next/server';
import { verifyReseller } from '@/lib/supabase/reseller-auth';
import { getAdminClient } from '@/lib/supabase/admin-auth';
import { sanitizeWhatsAppNumber } from '@/lib/services/order-notification';

export const dynamic = 'force-dynamic';

// GET: Retorna APENAS os lojistas/clientes onde customer.reseller_id == reseller.id
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyReseller();
    if (!auth.isReseller || !auth.user) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a revendedores autorizados.' }, { status: 403 });
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: true, customers: [] });
    }

    const resellerId = auth.reseller?.id;
    const resellerUserId = auth.reseller?.user_id || auth.user.id;

    // Blindagem de segurança: Se não for Master e não possuir resellerId válido, encerra com lista vazia
    if (!auth.isMaster && !resellerId) {
      return NextResponse.json({ success: true, customers: [] });
    }

    // Busca clientes vinculados a este revendedor
    let query = adminSupabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!auth.isMaster) {
      const repFilters = [
        resellerId ? `reseller_id.eq.${resellerId}` : null,
        resellerId ? `representative_id.eq.${resellerId}` : null,
        resellerUserId ? `reseller_id.eq.${resellerUserId}` : null,
        resellerUserId ? `representative_id.eq.${resellerUserId}` : null,
      ].filter(Boolean).join(',');

      query = query.or(repFilters);
    }

    const { data: clients, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message, customers: [] }, { status: 500 });
    }

    // Busca pedidos recentes para contar quantos pedidos cada cliente fez com este revendedor
    const clientIds = (clients || []).map((c: any) => c.id);
    let ordersCountMap: Record<string, number> = {};

    if (clientIds.length > 0) {
      try {
        const { data: orders } = await adminSupabase
          .from('orders')
          .select('id, customer_id, user_id')
          .in('customer_id', clientIds);

        (orders || []).forEach((o: any) => {
          const cid = o.customer_id || o.user_id;
          if (cid) ordersCountMap[cid] = (ordersCountMap[cid] || 0) + 1;
        });
      } catch {}
    }

    // Busca revendedores cadastrados para nunca listar membros da equipe como lojistas/clientes
    const { data: allResellers } = await adminSupabase.from('resellers').select('email, user_id');
    const resellerEmails = new Set((allResellers || []).map((r: any) => r.email?.toLowerCase().trim()).filter(Boolean));
    const resellerUserIds = new Set((allResellers || []).map((r: any) => r.user_id).filter(Boolean));

    const formattedCustomers = (clients || [])
      .filter((c: any) => {
        const email = c.email?.toLowerCase().trim();
        if (resellerEmails.has(email) || resellerUserIds.has(c.id)) return false;
        if (['admin', 'master', 'stock', 'ROLE_RESELLER'].includes(c.role)) return false;
        if (c.store_name === 'Representação Comercial Zeiq') return false;
        return c.role === 'reseller' || !c.role;
      })
      .map((c: any) => {
        const cleanPhone = sanitizeWhatsAppNumber(c.phone);
        const prefilledMsg = encodeURIComponent(
          `Olá ${c.contact_name || c.store_name}! Aqui é ${auth.reseller?.name || 'seu representante Zeiq'}. Estou à disposição para ajudar com pedidos e dúvidas sobre o catálogo de atacado.`
        );
        const directWhatsAppUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${prefilledMsg}` : null;

        return {
          id: c.id,
          email: c.email,
          contact_name: c.contact_name || c.email?.split('@')[0],
          store_name: c.store_name || 'Lojista B2B',
          phone: c.phone || '',
          cnpj_cpf: c.cnpj_cpf || '',
          city: c.city || '',
          state: c.state || '',
          address: c.address || '',
          cep: c.cep || '',
          is_approved: c.is_approved ?? false,
          created_at: c.created_at,
          orders_count: ordersCountMap[c.id] || 0,
          whatsapp_url: directWhatsAppUrl,
        };
      });

    return NextResponse.json({
      success: true,
      customers: formattedCustomers,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH: Revendedor aprova ou suspende o cadastro de um lojista de sua carteira
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
    const { id, is_approved } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID do cliente é obrigatório.' }, { status: 400 });
    }

    if (typeof is_approved !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Status de aprovação inválido.' }, { status: 400 });
    }

    // 1. Busca perfil do lojista e verifica posse estrita
    const { data: customer, error: fetchErr } = await adminSupabase
      .from('profiles')
      .select('id, reseller_id, representative_id, email, contact_name')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !customer) {
      return NextResponse.json({ success: false, error: 'Cliente não localizado.' }, { status: 404 });
    }

    if (!auth.isMaster) {
      const resellerId = auth.reseller?.id;
      const resellerUserId = auth.reseller?.user_id || auth.user.id;
      const isOwner =
        customer.reseller_id === resellerId ||
        customer.representative_id === resellerUserId ||
        customer.reseller_id === resellerUserId ||
        customer.representative_id === resellerId;

      if (!isOwner) {
        return NextResponse.json(
          { success: false, error: 'Você só pode gerenciar clientes pertencentes à sua própria carteira.' },
          { status: 403 }
        );
      }
    }

    // 2. Atualiza perfil
    const { data: updatedProfile, error: updateErr } = await adminSupabase
      .from('profiles')
      .update({
        is_approved,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 400 });
    }

    // 3. Sincroniza também no Supabase Auth para liberar acesso imediato
    try {
      await adminSupabase.auth.admin.updateUserById(id, {
        app_metadata: { is_approved },
        user_metadata: { is_approved },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      customer: updatedProfile,
      message: is_approved ? 'Cliente aprovado com sucesso!' : 'Acesso do cliente suspenso.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
