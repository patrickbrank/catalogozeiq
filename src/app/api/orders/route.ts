import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('order_number')?.trim();
    const phone = searchParams.get('phone')?.trim();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const adminSupabase = serviceRoleKey ? createAdminClient(supabaseUrl, serviceRoleKey) : null;

    // Caso 1: Consulta Rápida por Número de Pedido (com ou sem telefone)
    if (orderNumber) {
      const client = adminSupabase || (await createServerClient());

      const { data, error } = await client
        .from('orders')
        .select('*')
        .ilike('order_number', orderNumber);

      if (error) {
        const isTableMissing =
          error.message?.includes('schema cache') ||
          error.code === '42P01' ||
          error.message?.includes('does not exist');

        return NextResponse.json({
          success: false,
          tableMissing: isTableMissing,
          error: isTableMissing
            ? `Pedido "${orderNumber}" não localizado na base online.`
            : 'Erro ao consultar pedido no banco de dados.',
        });
      }

      if (!data || data.length === 0) {
        return NextResponse.json({
          success: false,
          error: `Nenhum pedido encontrado com o número "${orderNumber}".`,
        });
      }

      const order = data[0];

      // Se informou telefone, valida dígitos para maior segurança
      if (phone) {
        const cleanPhoneInput = phone.replace(/\D/g, '');
        const cleanOrderPhone = (order.buyer_phone || '').replace(/\D/g, '');
        if (cleanPhoneInput && cleanOrderPhone && !cleanOrderPhone.includes(cleanPhoneInput) && !cleanPhoneInput.includes(cleanOrderPhone)) {
          return NextResponse.json({
            success: false,
            error: 'O número de telefone informado não coincide com os dados do pedido.',
          });
        }
      }

      return NextResponse.json({
        success: true,
        order,
      });
    }

    // Caso 2: Listagem de Pedidos do Usuário Autenticado
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        success: false,
        authenticated: false,
        orders: [],
        message: 'Usuário não autenticado.',
      });
    }

    if (!adminSupabase) {
      // Tenta consultar via client comum
      const { data, error } = await serverSupabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ success: true, authenticated: true, orders: [] });
      }

      return NextResponse.json({
        success: true,
        authenticated: true,
        orders: data || [],
      });
    }

    // Busca pedidos vinculados ao user_id OU ao e-mail cadastrado
    const { data, error } = await adminSupabase
      .from('orders')
      .select('*')
      .or(`user_id.eq.${user.id},buyer_email.eq.${user.email}`)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({
        success: true,
        authenticated: true,
        orders: [],
      });
    }

    // Busca dados do perfil do revendedor se existir
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        profile: profile || null,
      },
      orders: data || [],
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: 'Não foi possível consultar pedidos no momento.',
      orders: [],
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      buyer_name,
      buyer_company,
      buyer_phone,
      buyer_email,
      items,
      total_pieces,
      customer_notes,
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Nenhum item informado.' }, { status: 400 });
    }

    // Tenta identificar se o usuário está logado
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    // Usa a chave service role se disponível, ou client do servidor
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const client = serviceRoleKey ? createAdminClient(supabaseUrl, serviceRoleKey) : serverSupabase;

    const generatedNumber = `ZEIQ-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data, error } = await client
      .from('orders')
      .insert({
        order_number: generatedNumber,
        user_id: user?.id || null,
        buyer_name: buyer_name?.trim() || 'Revendedor Zeiq',
        buyer_company: buyer_company?.trim() || null,
        buyer_phone: buyer_phone?.trim() || '',
        buyer_email: buyer_email?.trim() || user?.email || null,
        items: items,
        total_pieces: total_pieces || items.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0),
        status: 'pending',
        customer_notes: customer_notes?.trim() || null,
      })
      .select('*')
      .single();

    if (error) {
      // Se a tabela ainda não tiver sido criada no Supabase pelo usuário
      return NextResponse.json({
        success: true,
        savedToDb: false,
        orderNumber: generatedNumber,
        message: 'Pedido processado e direcionado para WhatsApp.',
      });
    }

    return NextResponse.json({
      success: true,
      savedToDb: true,
      order: data,
      orderNumber: data.order_number,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: true,
      savedToDb: false,
      message: 'Redirecionando para WhatsApp comercial.',
    });
  }
}
