import {
  formatOrderWhatsAppMessage,
  isValidWhatsAppNumber,
  replaceWhatsAppShareUrlPhone,
  sanitizeWhatsAppNumber,
} from '@/lib/services/order-notification';
import { Reseller } from '@/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value?: string | null): boolean {
  return Boolean(value && UUID_REGEX.test(value.trim()));
}

export function pickEffectiveWhatsApp(
  reseller?: { whatsapp?: string | null; phone?: string | null } | null,
  profilePhone?: string | null
): string {
  if (isValidWhatsAppNumber(reseller?.whatsapp)) {
    return reseller!.whatsapp!.replace(/\D/g, '');
  }
  if (isValidWhatsAppNumber(reseller?.phone)) {
    return reseller!.phone!.replace(/\D/g, '');
  }
  if (isValidWhatsAppNumber(profilePhone)) {
    return profilePhone!.replace(/\D/g, '');
  }
  return '';
}

/**
 * Resolve os dados atuais (ao vivo) do representante comercial a partir de qualquer identificador
 * (resellers.id, auth.users.id/user_id ou email), garantindo que o WhatsApp atualizado seja sempre usado.
 */
export async function resolveLiveReseller(
  dbClient: any,
  identifier?: string | null
): Promise<{
  reseller: Reseller | null;
  resellerId: string | null;
  representativeUserId: string | null;
}> {
  if (!dbClient || !identifier || !identifier.trim()) {
    return { reseller: null, resellerId: null, representativeUserId: null };
  }

  const cleanId = identifier.trim();

  try {
    let resData: any = null;

    if (isUuid(cleanId)) {
      const { data } = await dbClient
        .from('resellers')
        .select('*')
        .or(`id.eq.${cleanId},user_id.eq.${cleanId}`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      resData = data;
    } else if (cleanId.includes('@')) {
      const { data } = await dbClient
        .from('resellers')
        .select('*')
        .ilike('email', cleanId.toLowerCase())
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      resData = data;
    }

    if (resData) {
      let profilePhone: string | null = null;
      if (resData.user_id && !isValidWhatsAppNumber(resData.whatsapp)) {
        try {
          const { data: repProf } = await dbClient
            .from('profiles')
            .select('phone')
            .eq('id', resData.user_id)
            .maybeSingle();
          profilePhone = repProf?.phone || null;
        } catch {}
      }

      const effectiveWa = pickEffectiveWhatsApp(resData, profilePhone) || resData.whatsapp || '';
      const resolved: Reseller = {
        ...(resData as Reseller),
        whatsapp: effectiveWa,
        phone: resData.phone || effectiveWa || null,
      };

      return {
        reseller: resolved,
        resellerId: resData.id,
        representativeUserId: resData.user_id || null,
      };
    }

    // Fallback para tabela profiles (representantes legados)
    let legacyRep: any = null;
    if (isUuid(cleanId)) {
      const { data } = await dbClient
        .from('profiles')
        .select('*')
        .eq('id', cleanId)
        .maybeSingle();
      legacyRep = data;
    } else if (cleanId.includes('@')) {
      const { data } = await dbClient
        .from('profiles')
        .select('*')
        .ilike('email', cleanId.toLowerCase())
        .limit(1)
        .maybeSingle();
      legacyRep = data;
    }

    if (legacyRep) {
      let resByProf: any = null;
      const orParts = [`user_id.eq.${legacyRep.id}`];
      if (legacyRep.email) {
        orParts.push(`email.ilike.${legacyRep.email.trim().toLowerCase()}`);
      }
      const { data: foundByProf } = await dbClient
        .from('resellers')
        .select('*')
        .or(orParts.join(','))
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      resByProf = foundByProf;

      if (resByProf) {
        const effectiveWa = pickEffectiveWhatsApp(resByProf, legacyRep.phone) || resByProf.whatsapp || '';
        return {
          reseller: {
            ...(resByProf as Reseller),
            whatsapp: effectiveWa,
            phone: resByProf.phone || effectiveWa || null,
          },
          resellerId: resByProf.id,
          representativeUserId: resByProf.user_id || legacyRep.id,
        };
      }

      const fallbackWa = (legacyRep.phone || '').replace(/\D/g, '');
      return {
        reseller: {
          id: legacyRep.id,
          name: legacyRep.contact_name || legacyRep.store_name || legacyRep.email,
          email: legacyRep.email,
          phone: legacyRep.phone,
          whatsapp: fallbackWa,
          status: 'ativo',
          notification_preference: 'both',
          user_id: legacyRep.id,
        },
        resellerId: null,
        representativeUserId: legacyRep.id,
      };
    }
  } catch (err) {
    console.warn('Aviso ao resolver revendedor ao vivo:', err);
  }

  return { reseller: null, resellerId: null, representativeUserId: null };
}

/**
 * Atualiza todos os pedidos vinculados ao representante para que reseller_whatsapp,
 * whatsapp_share_url, reseller_name e reseller_email reflitam o cadastro atual.
 */
export async function syncOrdersForRepresentative(
  adminSupabase: any,
  params: {
    resellerId?: string | null;
    userId?: string | null;
    whatsapp?: string | null;
    name?: string | null;
    email?: string | null;
  }
): Promise<number> {
  if (!adminSupabase) return 0;

  const ids = Array.from(
    new Set([params.resellerId, params.userId].filter((v): v is string => isUuid(v)))
  );
  if (ids.length === 0) return 0;

  const cleanWa = isValidWhatsAppNumber(params.whatsapp) ? params.whatsapp!.replace(/\D/g, '') : '';
  const cleanName = params.name?.trim() || null;
  const cleanEmail = params.email?.trim().toLowerCase() || null;

  if (!cleanWa && !cleanName && !cleanEmail) return 0;

  try {
    const orFilters = ids.flatMap((id) => [`reseller_id.eq.${id}`, `representative_id.eq.${id}`]);
    const { data: orders, error } = await adminSupabase
      .from('orders')
      .select('id, order_number, buyer_name, buyer_company, buyer_phone, buyer_email, items, total_pieces, customer_notes, reseller_id, representative_id, reseller_name, reseller_whatsapp, reseller_email, whatsapp_share_url')
      .or(orFilters.join(','));

    if (error || !orders || orders.length === 0) {
      return 0;
    }

    const updatesToRun: Array<{ id: string; payload: Record<string, any> }> = [];

    for (const order of orders) {
      const payload: Record<string, any> = {};

      if (cleanWa) {
        const currentWa = (order.reseller_whatsapp || '').replace(/\D/g, '');
        if (currentWa !== cleanWa) {
          payload.reseller_whatsapp = cleanWa;
        }

        if (order.whatsapp_share_url) {
          const updatedUrl = replaceWhatsAppShareUrlPhone(order.whatsapp_share_url, cleanWa);
          if (updatedUrl && updatedUrl !== order.whatsapp_share_url) {
            payload.whatsapp_share_url = updatedUrl;
          }
        } else {
          const waPhone = sanitizeWhatsAppNumber(cleanWa);
          if (waPhone) {
            const msg = formatOrderWhatsAppMessage(order, {
              id: params.resellerId || params.userId || '',
              name: cleanName || order.reseller_name || 'Representante Comercial',
              email: cleanEmail || order.reseller_email || '',
              whatsapp: cleanWa,
              status: 'ativo',
              notification_preference: 'both',
            });
            payload.whatsapp_share_url = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
          }
        }
      }

      if (cleanName && order.reseller_name !== cleanName) {
        payload.reseller_name = cleanName;
      }

      if (cleanEmail && (order.reseller_email || '').toLowerCase() !== cleanEmail) {
        payload.reseller_email = cleanEmail;
      }

      if (Object.keys(payload).length > 0) {
        updatesToRun.push({ id: order.id, payload });
      }
    }

    if (updatesToRun.length === 0) return 0;

    // Atualiza em lotes para não sobrecarregar conexões
    const chunkSize = 20;
    for (let i = 0; i < updatesToRun.length; i += chunkSize) {
      const chunk = updatesToRun.slice(i, i + chunkSize);
      await Promise.allSettled(
        chunk.map((item) =>
          adminSupabase.from('orders').update(item.payload).eq('id', item.id)
        )
      );
    }

    return updatesToRun.length;
  } catch (err) {
    console.warn('Aviso ao sincronizar pedidos do representante:', err);
    return 0;
  }
}

/**
 * Sincroniza o registro na tabela resellers e todos os pedidos existentes quando
 * um representante tem seus dados (especialmente WhatsApp/telefone) criados ou alterados.
 */
export async function syncRepresentativeResellerAndOrders(
  adminSupabase: any,
  params: {
    userId?: string | null;
    resellerId?: string | null;
    email?: string | null;
    name?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    status?: 'ativo' | 'inativo';
    notificationPreference?: 'whatsapp_only' | 'email_only' | 'both';
    updateOrders?: boolean;
  }
): Promise<{ reseller: any | null; updatedOrdersCount: number }> {
  if (!adminSupabase) {
    return { reseller: null, updatedOrdersCount: 0 };
  }

  const cleanEmail = params.email?.trim().toLowerCase() || '';
  const cleanUserId = isUuid(params.userId) ? params.userId!.trim() : null;
  const cleanResellerId = isUuid(params.resellerId) ? params.resellerId!.trim() : null;

  let existing: any = null;
  try {
    const orFilters: string[] = [];
    if (cleanResellerId) orFilters.push(`id.eq.${cleanResellerId}`);
    if (cleanUserId) orFilters.push(`user_id.eq.${cleanUserId}`);
    if (cleanEmail) orFilters.push(`email.ilike.${cleanEmail}`);

    if (orFilters.length > 0) {
      const { data: matches } = await adminSupabase
        .from('resellers')
        .select('*')
        .or(orFilters.join(','))
        .order('updated_at', { ascending: false });

      if (Array.isArray(matches) && matches.length > 0) {
        existing =
          matches.find((m: any) => cleanResellerId && m.id === cleanResellerId) ||
          matches.find((m: any) => cleanUserId && m.user_id === cleanUserId) ||
          matches.find((m: any) => cleanEmail && m.email?.toLowerCase().trim() === cleanEmail) ||
          matches[0];
      }
    }
  } catch (err) {
    console.warn('Aviso ao localizar registro em resellers:', err);
  }

  const rawWaInput =
    params.whatsapp !== undefined
      ? params.whatsapp
      : params.phone !== undefined
      ? params.phone
      : existing?.whatsapp;

  const digitsWa = (rawWaInput || '').replace(/\D/g, '');
  const existingValidWa = isValidWhatsAppNumber(existing?.whatsapp)
    ? existing.whatsapp.replace(/\D/g, '')
    : '';
  const finalWhatsapp = isValidWhatsAppNumber(digitsWa)
    ? digitsWa
    : existingValidWa || '00000000000';

  let finalPhone: string | null = existing?.phone ?? null;
  if (params.phone !== undefined) {
    finalPhone = params.phone?.trim() || null;
  } else if (
    params.whatsapp !== undefined &&
    isValidWhatsAppNumber(finalWhatsapp) &&
    (!existing?.phone ||
      existing.phone.replace(/\D/g, '') === (existing?.whatsapp || '').replace(/\D/g, ''))
  ) {
    finalPhone = finalWhatsapp;
  }

  const finalName =
    params.name !== undefined && params.name?.trim()
      ? params.name.trim()
      : existing?.name || cleanEmail.split('@')[0] || 'Representante Comercial';

  const finalEmail = cleanEmail || existing?.email?.toLowerCase().trim() || '';
  const finalStatus = params.status || existing?.status || 'ativo';
  const finalPref = params.notificationPreference || existing?.notification_preference || 'both';
  const finalUserId = cleanUserId || existing?.user_id || null;

  let savedReseller = existing;

  try {
    if (existing?.id) {
      const updatePayload: Record<string, any> = {
        name: finalName,
        whatsapp: finalWhatsapp,
        phone: finalPhone,
        status: finalStatus,
        notification_preference: finalPref,
        updated_at: new Date().toISOString(),
      };
      if (finalEmail) updatePayload.email = finalEmail;
      if (finalUserId) updatePayload.user_id = finalUserId;

      const { data: updated, error: updErr } = await adminSupabase
        .from('resellers')
        .update(updatePayload)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (!updErr && updated) {
        savedReseller = updated;
      }
    } else if (finalEmail) {
      const { data: inserted, error: insErr } = await adminSupabase
        .from('resellers')
        .insert({
          name: finalName,
          email: finalEmail,
          whatsapp: finalWhatsapp,
          phone: finalPhone,
          status: finalStatus,
          notification_preference: finalPref,
          user_id: finalUserId,
        })
        .select('*')
        .single();

      if (!insErr && inserted) {
        savedReseller = inserted;
      }
    }
  } catch (err) {
    console.warn('Aviso ao persistir tabela resellers:', err);
  }

  let updatedOrdersCount = 0;
  if (params.updateOrders !== false && (savedReseller?.id || finalUserId)) {
    updatedOrdersCount = await syncOrdersForRepresentative(adminSupabase, {
      resellerId: savedReseller?.id || cleanResellerId,
      userId: finalUserId,
      whatsapp: isValidWhatsAppNumber(finalWhatsapp) ? finalWhatsapp : null,
      name: finalName,
      email: finalEmail || null,
    });
  }

  return {
    reseller: savedReseller,
    updatedOrdersCount,
  };
}

/**
 * Enriquece uma lista de pedidos com o WhatsApp e dados ATUAIS do representante
 * diretamente de resellers/profiles, garantindo que links de notificação nunca usem
 * números antigos salvos em pedidos anteriores.
 */
export async function enrichOrdersWithLiveResellers<T extends Record<string, any>>(
  dbClient: any,
  orders: T[]
): Promise<T[]> {
  if (!dbClient || !Array.isArray(orders) || orders.length === 0) {
    return orders || [];
  }

  const candidateIds = Array.from(
    new Set(
      orders
        .flatMap((o) => [o.reseller_id, o.representative_id])
        .filter((v): v is string => isUuid(v))
    )
  );

  if (candidateIds.length === 0) {
    return orders;
  }

  const byResellerId = new Map<string, any>();
  const byUserId = new Map<string, any>();
  const profileById = new Map<string, any>();

  try {
    const idList = candidateIds.join(',');
    const [{ data: resellersList }, { data: profilesList }] = await Promise.all([
      dbClient
        .from('resellers')
        .select('id, user_id, name, email, phone, whatsapp, status, notification_preference')
        .or(`id.in.(${idList}),user_id.in.(${idList})`),
      dbClient
        .from('profiles')
        .select('id, contact_name, store_name, email, phone')
        .in('id', candidateIds),
    ]);

    (resellersList || []).forEach((r: any) => {
      if (r.id) byResellerId.set(r.id, r);
      if (r.user_id) byUserId.set(r.user_id, r);
    });

    (profilesList || []).forEach((p: any) => {
      if (p.id) profileById.set(p.id, p);
    });
  } catch (err) {
    console.warn('Aviso ao enriquecer pedidos com revendedores ao vivo:', err);
    return orders;
  }

  return orders.map((order) => {
    const liveReseller =
      (order.reseller_id && (byResellerId.get(order.reseller_id) || byUserId.get(order.reseller_id))) ||
      (order.representative_id && (byUserId.get(order.representative_id) || byResellerId.get(order.representative_id))) ||
      null;

    const liveProfile =
      (liveReseller?.user_id && profileById.get(liveReseller.user_id)) ||
      (order.representative_id && profileById.get(order.representative_id)) ||
      (order.reseller_id && profileById.get(order.reseller_id)) ||
      null;

    const liveWa =
      pickEffectiveWhatsApp(liveReseller, liveProfile?.phone) ||
      order.reseller_whatsapp ||
      null;

    const liveName =
      liveReseller?.name ||
      liveProfile?.contact_name ||
      liveProfile?.store_name ||
      order.reseller_name ||
      null;

    const liveEmail =
      liveReseller?.email ||
      liveProfile?.email ||
      order.reseller_email ||
      null;

    let liveShareUrl = order.whatsapp_share_url || null;
    if (liveWa) {
      if (liveShareUrl) {
        liveShareUrl = replaceWhatsAppShareUrlPhone(liveShareUrl, liveWa);
      } else {
        const waFull = sanitizeWhatsAppNumber(liveWa);
        if (waFull) {
          const msg = formatOrderWhatsAppMessage(order as any, {
            id: liveReseller?.id || order.reseller_id || '',
            name: liveName || 'Representante Autorizado',
            email: liveEmail || '',
            whatsapp: liveWa,
            status: 'ativo',
            notification_preference: 'both',
          });
          liveShareUrl = `https://wa.me/${waFull}?text=${encodeURIComponent(msg)}`;
        }
      }
    }

    return {
      ...order,
      reseller_name: liveName,
      reseller_whatsapp: liveWa,
      reseller_email: liveEmail,
      whatsapp_share_url: liveShareUrl,
    };
  });
}
