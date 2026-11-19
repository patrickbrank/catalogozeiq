import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { notifyResellerForOrder } from '@/lib/services/order-notification';
import {
  enrichOrdersWithLiveResellers,
  resolveLiveReseller,
} from '@/lib/services/reseller-sync';
import { Reseller } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('order_number')?.trim();
    const orderNumbersParam = searchParams.get('order_numbers')?.trim();
    const phone = searchParams.get('phone')?.trim();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const adminSupabase = serviceRoleKey ? createAdminClient(supabaseUrl, serviceRoleKey) : null;

    // Caso 1A: Consulta em Lote por Números de Pedido (para sincronizar pedidos recentes do cliente)
    if (orderNumbersParam) {
      const numbers = orderNumbersParam
        .split(',')
        .map((n) => n.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 50);

      if (numbers.length > 0) {
        const client = adminSupabase || (await createServerClient());
        const { data, error } = await client
          .from('orders')
          .select('*')
          .in('order_number', numbers)
          .order('created_at', { ascending: false });

        if (error) {
          return NextResponse.json({ success: false, error: error.message, orders: [] });
        }

        const serverSupabase = await createServerClient();
        const { data: { user: currentUser } } = await serverSupabase.auth.getUser();

        const liveBatchOrders = adminSupabase
          ? await enrichOrdersWithLiveResellers(adminSupabase, data || [])
          : (data || []);

        // Proteção Anti-IDOR se for visitante anônimo
        const safeOrders = liveBatchOrders.map((order: any) => {
          const isOwner =
            currentUser &&
            (currentUser.id === order.user_id ||
              currentUser.id === order.customer_id ||
              currentUser.email?.toLowerCase() === order.buyer_email?.toLowerCase());
          const isMasterAdmin =
            currentUser &&
            (currentUser.email?.toLowerCase() === 'marketing@zeiq.com.br' ||
              currentUser.email?.toLowerCase() === 'patrickbrank@outlook.com');

          if (isOwner || isMasterAdmin) {
            return order;
          }

          const maskedPhone =
            order.buyer_phone && order.buyer_phone.length >= 8
              ? order.buyer_phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) •••••-$3')
              : order.buyer_phone
              ? '••••••••'
              : 'Não informado';
          const maskedEmail = order.buyer_email
            ? order.buyer_email.replace(/^(.{2})(.*)(@.*)$/, '$1••••$3')
            : null;

          return {
            ...order,
            buyer_phone: maskedPhone,
            buyer_email: maskedEmail,
            commercial_notes: null,
            whatsapp_share_url: null,
          };
        });

        return NextResponse.json({
          success: true,
          orders: safeOrders,
        });
      }
    }

    // Caso 1B: Consulta Rápida por Número de Pedido Único (com ou sem telefone)
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

      const [enrichedSingle] = adminSupabase
        ? await enrichOrdersWithLiveResellers(adminSupabase, [data[0]])
        : [data[0]];
      const order = enrichedSingle || data[0];

      // Checa se o usuário atual é dono do pedido ou admin
      const serverSupabase = await createServerClient();
      const { data: { user: currentUser } } = await serverSupabase.auth.getUser();
      const isOwner =
        currentUser &&
        (currentUser.id === order.user_id ||
          currentUser.id === order.customer_id ||
          currentUser.email?.toLowerCase() === order.buyer_email?.toLowerCase());
      const isMasterAdmin =
        currentUser &&
        (currentUser.email?.toLowerCase() === 'marketing@zeiq.com.br' ||
          currentUser.email?.toLowerCase() === 'patrickbrank@outlook.com');

      // Validação de telefone para visualização completa
      let phoneMatched = false;
      if (phone) {
        const cleanPhoneInput = phone.replace(/\D/g, '');
        const cleanOrderPhone = (order.buyer_phone || '').replace(/\D/g, '');
        if (cleanPhoneInput && cleanOrderPhone) {
          if (cleanOrderPhone.endsWith(cleanPhoneInput) || cleanPhoneInput.endsWith(cleanOrderPhone) || cleanOrderPhone === cleanPhoneInput) {
            phoneMatched = true;
          } else {
            return NextResponse.json({
              success: false,
              error: 'O número de telefone informado não coincide com os dados do pedido.',
            });
          }
        }
      }

      // Proteção Anti-IDOR: Se for consulta pública anônima sem confirmação de telefone, mascara dados sensíveis
      if (!isOwner && !isMasterAdmin && !phoneMatched) {
        const maskedPhone = order.buyer_phone && order.buyer_phone.length >= 8
          ? order.buyer_phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) •••••-$3')
          : (order.buyer_phone ? '••••••••' : 'Não informado');
        const maskedEmail = order.buyer_email
          ? order.buyer_email.replace(/^(.{2})(.*)(@.*)$/, '$1••••$3')
          : null;

        const safeOrder = {
          ...order,
          buyer_phone: maskedPhone,
          buyer_email: maskedEmail,
          commercial_notes: null, // Protege anotações comerciais internas contra scraping
          whatsapp_share_url: null,
        };

        return NextResponse.json({
          success: true,
          order: safeOrder,
          partial: true,
        });
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

    // Busca dados do perfil do lojista se existir e enriquece com dados do revendedor
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    let enrichedProfile = profile;
    const targetResellerId =
      profile?.reseller_id ||
      profile?.representative_id ||
      user.app_metadata?.representative_id ||
      user.user_metadata?.reseller_id ||
      user.user_metadata?.representative_id ||
      null;

    if (profile && targetResellerId) {
      const resolved = await resolveLiveReseller(adminSupabase, targetResellerId);
      if (resolved.reseller) {
        enrichedProfile = {
          ...profile,
          reseller: {
            id: resolved.reseller.id,
            name: resolved.reseller.name,
            email: resolved.reseller.email,
            phone: resolved.reseller.whatsapp || resolved.reseller.phone,
            whatsapp: resolved.reseller.whatsapp,
          },
        };
      }
    }

    // Monta filtros abrangentes para encontrar pedidos do cliente
    const orFilters: string[] = [
      `user_id.eq.${user.id}`,
      `customer_id.eq.${user.id}`,
    ];
    if (user.email) {
      orFilters.push(`buyer_email.ilike.${user.email}`);
    }
    if (profile?.phone) {
      const cleanPhone = profile.phone.replace(/\D/g, '');
      if (cleanPhone.length >= 8) {
        orFilters.push(`buyer_phone.ilike.%${cleanPhone.slice(-8)}%`);
      }
    }

    const { data, error } = await adminSupabase
      .from('orders')
      .select('*')
      .or(orFilters.join(','))
      .order('created_at', { ascending: false });

    // Enriquecimento retrocompatível dos pedidos com dados ATUAIS do revendedor
    const formatOrdersWithReseller = async (ordersList: any[]) => {
      const liveList = await enrichOrdersWithLiveResellers(adminSupabase, ordersList);
      return liveList.map((o) => ({
        ...o,
        reseller_name: o.reseller_name || enrichedProfile?.reseller?.name || null,
        reseller_whatsapp:
          o.reseller_whatsapp ||
          enrichedProfile?.reseller?.whatsapp ||
          enrichedProfile?.reseller?.phone ||
          null,
      }));
    };

    if (error) {
      // Fallback para consulta básica se colunas opcionais variarem
      const { data: fallbackData } = await adminSupabase
        .from('orders')
        .select('*')
        .or(`user_id.eq.${user.id},buyer_email.eq.${user.email}`)
        .order('created_at', { ascending: false });

      return NextResponse.json({
        success: true,
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          profile: enrichedProfile || null,
        },
        orders: await formatOrdersWithReseller(fallbackData || []),
      });
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        profile: enrichedProfile || null,
      },
      orders: await formatOrdersWithReseller(data || []),
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
      reseller_id: clientSentResellerId,
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

    // 1. Busca perfil do lojista para obter o vínculo PERMANENTE com o revendedor
    let userProf: any = null;
    let targetResellerId: string | null = clientSentResellerId || null;

    if (user?.id) {
      try {
        const { data: prof } = await client
          .from('profiles')
          .select('id, reseller_id, representative_id, contact_name, store_name, phone, cnpj_cpf, city, state, address, cep')
          .eq('id', user.id)
          .maybeSingle();

        if (prof) {
          userProf = prof;
          // O vínculo no perfil do cliente é soberano e permanente
          if (prof.reseller_id) {
            targetResellerId = prof.reseller_id;
          } else if (prof.representative_id) {
            targetResellerId = prof.representative_id;
          }
        }
      } catch {}

      if (!targetResellerId) {
        targetResellerId =
          user.app_metadata?.representative_id ||
          user.user_metadata?.reseller_id ||
          user.user_metadata?.representative_id ||
          clientSentResellerId ||
          null;
      }
    }

    // Fallback: Se não estava logado via sessão de cookie, busca por e-mail ou telefone para resgatar o representante do lojista
    if (!userProf && (buyer_email || buyer_phone)) {
      try {
        const cleanPhone = (buyer_phone || '').replace(/\D/g, '');
        const cleanMail = buyer_email ? buyer_email.trim().toLowerCase() : '';
        let profQuery = client.from('profiles').select('id, reseller_id, representative_id, contact_name, store_name, phone, cnpj_cpf, city, state, address, cep');
        if (cleanMail && cleanPhone) {
          profQuery = profQuery.or(`email.ilike.${cleanMail},phone.eq.${cleanPhone}`);
        } else if (cleanMail) {
          profQuery = profQuery.ilike('email', cleanMail);
        } else if (cleanPhone) {
          profQuery = profQuery.eq('phone', cleanPhone);
        }

        const { data: profFound } = await profQuery.limit(1).maybeSingle();
        if (profFound) {
          userProf = profFound;
          if (profFound.reseller_id) {
            targetResellerId = profFound.reseller_id;
          } else if (profFound.representative_id) {
            targetResellerId = profFound.representative_id;
          }
        }
      } catch {}
    }

    // 2. Busca dados atuais do revendedor vinculado e resolve chaves estrangeiras
    let resellerRecord: Reseller | null = null;
    let resolvedResellerId: string | null = null;
    let resolvedRepresentativeUserId: string | null = null;

    if (targetResellerId) {
      const resolved = await resolveLiveReseller(client, targetResellerId);
      resellerRecord = resolved.reseller;
      resolvedResellerId = resolved.resellerId;
      resolvedRepresentativeUserId = resolved.representativeUserId;
    }

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const generatedNumber = `ZEIQ-${randomSuffix}`;

    const insertPayload: any = {
      order_number: generatedNumber,
      customer_id: user?.id || null,
      user_id: user?.id || null,
      reseller_id: resolvedResellerId,
      reseller_name: resellerRecord?.name || null,
      reseller_whatsapp: resellerRecord?.whatsapp || null,
      reseller_email: resellerRecord?.email || null,
      representative_id: resolvedRepresentativeUserId,
      buyer_name: buyer_name?.trim() || userProf?.contact_name || 'Lojista Zeiq',
      buyer_company: buyer_company?.trim() || userProf?.store_name || null,
      buyer_phone: buyer_phone?.trim() || userProf?.phone || '',
      buyer_email: buyer_email?.trim() || user?.email || null,
      items: items,
      total_pieces: total_pieces || items.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0),
      status: 'pending',
      customer_notes: customer_notes?.trim() || null,
    };

    let { data, error } = await client
      .from('orders')
      .insert(insertPayload)
      .select('*')
      .single();

    // Se as novas colunas opcionais ainda não tiverem sido migradas no banco, realiza retentativa compatível
    if (error && (error.message?.includes('customer_id') || error.message?.includes('reseller_id') || error.message?.includes('reseller_name'))) {
      delete insertPayload.customer_id;
      delete insertPayload.reseller_id;
      delete insertPayload.reseller_name;
      delete insertPayload.reseller_whatsapp;
      delete insertPayload.reseller_email;
      delete insertPayload.representative_id;

      const retry = await client
        .from('orders')
        .insert(insertPayload)
        .select('*')
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      console.error('❌ Falha ao salvar pedido no Supabase:', error);
      return NextResponse.json(
        {
          success: false,
          savedToDb: false,
          error: error?.message || 'Falha ao gravar pedido no banco de dados.',
        },
        { status: 400 }
      );
    }

    const finalOrder = data;

    // 3. REGRA DE OURO: Notificação do pedido vai APENAS para o Revendedor dono daquele cliente
    // O envio do pedido NÃO vai para o Admin Master (Admin apenas visualiza se quiser).
    let notificationResult: any = null;
    let notifStatus: string = 'pending';
    let notifErrorMsg: string | null = null;

    if (resellerRecord) {
      try {
        notificationResult = await notifyResellerForOrder(finalOrder, resellerRecord, userProf);

        if (notificationResult?.whatsappApiSent || notificationResult?.emailSent) {
          notifStatus = 'sent';
        } else if (notificationResult?.whatsappLink) {
          notifStatus = 'fallback_ready';
        }

        // Se o pedido foi salvo no banco, atualiza os campos de auditoria de notificação
        if (data?.id) {
          await client
            .from('orders')
            .update({
              whatsapp_share_url: notificationResult?.whatsappLink || null,
              whatsapp_notified_at: notificationResult?.whatsappApiSent ? new Date().toISOString() : null,
              email_notified_at: notificationResult?.emailSent ? new Date().toISOString() : null,
              notification_status: notifStatus,
              notification_error: null,
            })
            .eq('id', data.id);
        }
      } catch (notifErr: any) {
        notifStatus = 'failed';
        notifErrorMsg = notifErr?.message || 'Falha na comunicação de notificação';
        console.warn('Aviso no disparo de notificação para o revendedor (pedido mantido salvo):', notifErr);

        if (data?.id) {
          try {
            await client
              .from('orders')
              .update({
                notification_status: 'failed',
                notification_error: notifErrorMsg,
              })
              .eq('id', data.id);
          } catch {}
        }
      }
    }

    return NextResponse.json({
      success: true,
      savedToDb: true,
      order: finalOrder,
      orderNumber: finalOrder.order_number,
      whatsappUrl: notificationResult?.whatsappLink || null,
      reseller: resellerRecord ? {
        id: resellerRecord.id,
        name: resellerRecord.name,
        whatsapp: resellerRecord.whatsapp,
        email: resellerRecord.email,
        notification_preference: resellerRecord.notification_preference,
      } : null,
      message: 'Pedido registrado com sucesso para atendimento do seu revendedor.',
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Erro ao processar e salvar pedido.',
    }, { status: 500 });
  }
}
