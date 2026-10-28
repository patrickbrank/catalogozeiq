import { Order, Reseller, Profile } from '@/types';

export interface NotificationResult {
  success: boolean;
  whatsappLink?: string;
  whatsappApiSent?: boolean;
  emailSent?: boolean;
  emailSubject?: string;
  emailHtml?: string;
  emailMailtoLink?: string;
  messageText?: string;
  error?: string;
}

/**
 * Normaliza o número de telefone/WhatsApp para formato com DDI (55 para Brasil)
 * e apenas dígitos.
 */
export function sanitizeWhatsAppNumber(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  // Se já começar com 55 e tiver tamanho de DDD+Número brasileiro (12 ou 13 dígitos)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  // Se tiver 10 ou 11 dígitos (DDD + 8 ou 9 dígitos), adiciona 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

/**
 * Formata o conteúdo textual da mensagem de pedido conforme especificação exata:
 * 
 * Novo Pedido Recebido - [NOME DO SITE]
 * Cliente: [nome]
 * Representante: [nome do reseller]
 * Pedido: #ID
 * ---
 * Produtos:
 * - Produto X - Qtd Y - R$ Z
 * Total: R$ XXX
 * ---
 * Dados do Cliente: [endereço, telefone, CNPJ/CPF]
 */
export function formatOrderWhatsAppMessage(
  order: Order,
  reseller?: Reseller | null,
  customerProfile?: Partial<Profile> | null
): string {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Zeiq Sports';
  const clientName = customerProfile?.store_name
    ? `${customerProfile.store_name} (${order.buyer_name})`
    : (order.buyer_company ? `${order.buyer_company} (${order.buyer_name})` : order.buyer_name);
  const resellerName = reseller?.name || order.reseller_name || order.representative_name || 'Representante Autorizado';
  const orderId = order.order_number?.replace(/^#/, '') || order.id?.slice(0, 8);

  // Formata lista de produtos
  const productLines = (order.items || []).map((item) => {
    const qty = item.quantity || 1;
    const unitPrice = item.price != null && item.price > 0 ? item.price : null;
    const priceStr = unitPrice
      ? `R$ ${(unitPrice * qty).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : 'A consultar';

    let detailStr = '';
    if (item.sizeBreakdown && Object.keys(item.sizeBreakdown).length > 0) {
      const breakdown = Object.entries(item.sizeBreakdown)
        .map(([sz, q]) => `${q} ${sz}`)
        .join(', ');
      detailStr = ` (Grade: ${breakdown})`;
    } else if (item.selectedSize) {
      detailStr = ` (Tam: ${item.selectedSize})`;
    }

    const skuStr = item.sku ? ` [${item.sku}]` : '';
    return `- ${item.productName}${skuStr}${detailStr} - Qtd ${qty} - ${priceStr}`;
  });

  // Calcula total
  const hasPrices = (order.items || []).some((it) => it.price != null && it.price > 0);
  let totalStr = 'Sob Consulta Comercial';
  if (hasPrices) {
    const totalVal = (order.items || []).reduce((acc, it) => acc + ((it.price || 0) * (it.quantity || 1)), 0);
    totalStr = `R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Dados do cliente
  const phone = order.buyer_phone || customerProfile?.phone || 'Não informado';
  const cnpjCpf = customerProfile?.cnpj_cpf || 'Não informado';
  const addressParts = [
    customerProfile?.address,
    customerProfile?.city,
    customerProfile?.state,
    customerProfile?.cep ? `CEP: ${customerProfile.cep}` : null,
  ].filter(Boolean);
  const addressStr = addressParts.length > 0 ? addressParts.join(' - ') : (customerProfile?.city ? `${customerProfile.city}/${customerProfile.state}` : 'Endereço a confirmar');

  const customerDataStr = `${addressStr} | Tel: ${phone} | Doc: ${cnpjCpf}`;

  const message = [
    `Novo Pedido Recebido - ${siteName}`,
    `Cliente: ${clientName}`,
    `Representante: ${resellerName}`,
    `Pedido: #${orderId}`,
    `---`,
    `Produtos:`,
    productLines.join('\n'),
    `Total: ${totalStr}`,
    `---`,
    `Dados do Cliente: ${customerDataStr}`,
  ].join('\n');

  return message;
}

/**
 * Gera o template HTML do e-mail com a identidade visual da Zeiq (Dark & Laranja)
 */
export function formatOrderEmailHtml(
  order: Order,
  reseller?: Reseller | null,
  customerProfile?: Partial<Profile> | null
): string {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Zeiq Sports';
  const clientName = customerProfile?.store_name
    ? `${customerProfile.store_name} (${order.buyer_name})`
    : (order.buyer_company ? `${order.buyer_company} (${order.buyer_name})` : order.buyer_name);
  const resellerName = reseller?.name || order.reseller_name || 'Representante Autorizado';
  const orderId = order.order_number?.replace(/^#/, '') || order.id?.slice(0, 8);

  const productRows = (order.items || []).map((item, idx) => {
    const qty = item.quantity || 1;
    const unitPrice = item.price != null && item.price > 0 ? item.price : 0;
    const subtotal = unitPrice * qty;

    let sizes = '';
    if (item.sizeBreakdown && Object.keys(item.sizeBreakdown).length > 0) {
      sizes = Object.entries(item.sizeBreakdown).map(([sz, q]) => `${q}x ${sz}`).join(', ');
    } else if (item.selectedSize) {
      sizes = item.selectedSize;
    }

    return `
      <tr style="border-bottom: 1px solid #22252a;">
        <td style="padding: 12px 16px; color: #ffffff; font-size: 14px;">
          <strong>${item.productName}</strong>
          ${item.sku ? `<div style="font-size: 11px; color: #8c9099;">SKU: ${item.sku}</div>` : ''}
          ${sizes ? `<div style="font-size: 11px; color: #ff5500;">Grade: ${sizes}</div>` : ''}
        </td>
        <td style="padding: 12px 16px; text-align: center; color: #ffffff; font-size: 14px; font-weight: bold;">
          ${qty}
        </td>
        <td style="padding: 12px 16px; text-align: right; color: #ffffff; font-size: 14px;">
          ${unitPrice > 0 ? `R$ ${unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
        </td>
        <td style="padding: 12px 16px; text-align: right; color: #ff5500; font-size: 14px; font-weight: bold;">
          ${subtotal > 0 ? `R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Sob Consulta'}
        </td>
      </tr>
    `;
  }).join('');

  const totalPieces = order.total_pieces || (order.items || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
  const totalVal = (order.items || []).reduce((acc, it) => acc + ((it.price || 0) * (it.quantity || 1)), 0);
  const totalStr = totalVal > 0
    ? `R$ ${totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'Sob Consulta Comercial';

  const phone = order.buyer_phone || customerProfile?.phone || 'Não informado';
  const cnpjCpf = customerProfile?.cnpj_cpf || 'Não informado';
  const email = order.buyer_email || customerProfile?.email || 'Não informado';
  const address = [customerProfile?.address, customerProfile?.city, customerProfile?.state, customerProfile?.cep].filter(Boolean).join(' - ') || 'Não informado';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Novo Pedido #${orderId} - ${siteName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0c0d0e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e1e4ea;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0c0d0e; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 640px; background-color: #141619; border: 1px solid #22252a; border-radius: 16px; overflow: hidden;" cellspacing="0" cellpadding="0">
          <!-- Header -->
          <tr>
            <td style="background-color: #1a1d21; padding: 28px 32px; border-bottom: 2px solid #ff5500;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; text-transform: uppercase;">
                      ${siteName}
                    </div>
                    <div style="font-size: 11px; font-weight: 700; color: #ff5500; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px;">
                      Notificação de Novo Pedido
                    </div>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background-color: rgba(255, 85, 0, 0.15); border: 1px solid rgba(255, 85, 0, 0.3); color: #ff5500; padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 800; font-family: monospace;">
                      #${orderId}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Resumo de Partes -->
          <tr>
            <td style="padding: 24px 32px 16px 32px;">
              <table width="100%" cellspacing="0" cellpadding="0" style="background-color: #0c0d0e; border: 1px solid #22252a; border-radius: 12px; padding: 16px;">
                <tr>
                  <td width="50%" style="vertical-align: top; padding: 8px 12px;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #8c9099; font-weight: 700;">Cliente / Lojista</div>
                    <div style="font-size: 15px; font-weight: 800; color: #ffffff; margin-top: 4px;">${clientName}</div>
                    <div style="font-size: 12px; color: #a1a7b4; margin-top: 2px;">Doc: ${cnpjCpf}</div>
                    <div style="font-size: 12px; color: #a1a7b4;">Tel: ${phone}</div>
                    <div style="font-size: 12px; color: #a1a7b4;">E-mail: ${email}</div>
                  </td>
                  <td width="50%" style="vertical-align: top; padding: 8px 12px; border-left: 1px solid #22252a;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #8c9099; font-weight: 700;">Representante Responsável</div>
                    <div style="font-size: 15px; font-weight: 800; color: #ff5500; margin-top: 4px;">${resellerName}</div>
                    <div style="font-size: 12px; color: #a1a7b4; margin-top: 2px;">Endereço de Entrega:</div>
                    <div style="font-size: 12px; color: #ffffff; margin-top: 2px;">${address}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tabela de Produtos -->
          <tr>
            <td style="padding: 16px 32px;">
              <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #22252a; border-radius: 12px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #1a1d21; text-align: left;">
                    <th style="padding: 12px 16px; color: #8c9099; font-size: 11px; text-transform: uppercase; font-weight: 700;">Produto</th>
                    <th style="padding: 12px 16px; color: #8c9099; font-size: 11px; text-transform: uppercase; font-weight: 700; text-align: center;">Qtd</th>
                    <th style="padding: 12px 16px; color: #8c9099; font-size: 11px; text-transform: uppercase; font-weight: 700; text-align: right;">Unit.</th>
                    <th style="padding: 12px 16px; color: #8c9099; font-size: 11px; text-transform: uppercase; font-weight: 700; text-align: right;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${productRows}
                </tbody>
                <tfoot>
                  <tr style="background-color: #1a1d21;">
                    <td colspan="2" style="padding: 14px 16px; color: #ffffff; font-weight: 700; font-size: 13px;">
                      Total de Peças: <span style="color: #ff5500;">${totalPieces} un.</span>
                    </td>
                    <td colspan="2" style="padding: 14px 16px; text-align: right; color: #ffffff; font-weight: 800; font-size: 16px;">
                      Total: <span style="color: #ff5500;">${totalStr}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </td>
          </tr>

          <!-- Observações do Pedido -->
          ${order.customer_notes ? `
          <tr>
            <td style="padding: 8px 32px 16px 32px;">
              <div style="background-color: #1a1d21; border-left: 3px solid #ff5500; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 12px; color: #cbd5e1;">
                <strong>Observações do Cliente:</strong> ${order.customer_notes}
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px 32px 32px; text-align: center; border-top: 1px solid #22252a;">
              <p style="margin: 0; font-size: 12px; color: #8c9099;">
                Este pedido foi atribuído exclusivamente ao representante comercial <strong>${resellerName}</strong>.
              </p>
              <p style="margin: 8px 0 0 0; font-size: 11px; color: #64748b;">
                ${siteName} &bull; Catálogo Exclusivo B2B
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Envia notificação por WhatsApp para o revendedor
 * 6.3 - A) Para WhatsApp: Criar função sendOrderToResellerWhatsapp(order, reseller)
 * - Gerar link https://wa.me/55[whatsapp]?text=[mensagem url_encoded]
 * - Se tiver integração com API (Evolution / Z-API / Twilio), disparar automaticamente via API.
 * - Se não tiver API, gerar o link clicável no painel do Admin e logar no sistema que o pedido foi notificado.
 */
export async function sendOrderToResellerWhatsapp(
  order: Order,
  reseller: Reseller,
  customerProfile?: Partial<Profile> | null
): Promise<{ success: boolean; url: string; apiSent: boolean; message: string }> {
  const cleanNumber = sanitizeWhatsAppNumber(reseller.whatsapp || reseller.phone);
  const messageText = formatOrderWhatsAppMessage(order, reseller, customerProfile);
  const encoded = encodeURIComponent(messageText);
  const waUrl = cleanNumber ? `https://wa.me/${cleanNumber}?text=${encoded}` : '';

  let apiSent = false;

  // 1. Suporte a Evolution API se configurado
  const evoUrl = process.env.EVOLUTION_API_URL;
  const evoKey = process.env.EVOLUTION_API_KEY;
  const evoInstance = process.env.EVOLUTION_INSTANCE || 'zeiq';

  if (evoUrl && evoKey && cleanNumber) {
    try {
      const response = await fetch(`${evoUrl.replace(/\/$/, '')}/message/sendText/${evoInstance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evoKey,
        },
        body: JSON.stringify({
          number: cleanNumber,
          options: { delay: 1200, presence: 'composing' },
          textMessage: { text: messageText },
        }),
      });
      if (response.ok) {
        apiSent = true;
      }
    } catch (evoErr) {
      console.warn('Falha no envio automático via Evolution API:', evoErr);
    }
  }

  // 2. Suporte a Z-API se configurado
  const zapiInstance = process.env.ZAPI_INSTANCE_ID;
  const zapiToken = process.env.ZAPI_TOKEN;
  const zapiClientToken = process.env.ZAPI_CLIENT_TOKEN;

  if (!apiSent && zapiInstance && zapiToken && cleanNumber) {
    try {
      const response = await fetch(`https://api.z-api.io/instances/${zapiInstance}/token/${zapiToken}/send-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(zapiClientToken ? { 'Client-Token': zapiClientToken } : {}),
        },
        body: JSON.stringify({
          phone: cleanNumber,
          message: messageText,
        }),
      });
      if (response.ok) {
        apiSent = true;
      }
    } catch (zapiErr) {
      console.warn('Falha no envio automático via Z-API:', zapiErr);
    }
  }

  return {
    success: true,
    url: waUrl,
    apiSent,
    message: messageText,
  };
}

/**
 * Envia notificação por E-mail para o revendedor
 * 6.3 - B) Para E-mail: Criar função sendOrderToResellerEmail(order, reseller)
 * - Usar o mesmo template HTML que já usamos hoje para envio de pedido.
 * - Assunto: Novo Pedido #ID - Cliente [nome]
 */
export async function sendOrderToResellerEmail(
  order: Order,
  reseller: Reseller,
  customerProfile?: Partial<Profile> | null
): Promise<{ success: boolean; emailSent: boolean; mailtoLink: string; subject: string; html: string }> {
  const clientName = customerProfile?.store_name || order.buyer_company || order.buyer_name;
  const orderId = order.order_number?.replace(/^#/, '') || order.id?.slice(0, 8);
  const subject = `Novo Pedido #${orderId} - Cliente ${clientName}`;
  const html = formatOrderEmailHtml(order, reseller, customerProfile);
  const plainText = formatOrderWhatsAppMessage(order, reseller, customerProfile);

  const targetEmail = reseller.email;
  const mailtoLink = targetEmail
    ? `mailto:${targetEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainText)}`
    : '';

  let emailSent = false;

  // 1. Suporte a Resend API se chave configurada
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || 'pedidos@zeiq.com.br';

  if (resendApiKey && targetEmail) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: `${process.env.NEXT_PUBLIC_SITE_NAME || 'Zeiq Sports'} <${resendFrom}>`,
          to: [targetEmail],
          subject,
          html,
          text: plainText,
        }),
      });
      if (response.ok) {
        emailSent = true;
      }
    } catch (resendErr) {
      console.warn('Falha no envio de e-mail via Resend:', resendErr);
    }
  }

  return {
    success: true,
    emailSent,
    mailtoLink,
    subject,
    html,
  };
}

/**
 * Orquestrador principal de notificações do pedido para o revendedor
 * Executa as regras de envio conforme a preferência de notificação (whatsapp_only, email_only, both)
 * REGRA DE OURO: Vai APENAS para o representante dono daquele cliente. NUNCA para o Admin Master.
 */
export async function notifyResellerForOrder(
  order: Order,
  reseller: Reseller,
  customerProfile?: Partial<Profile> | null
): Promise<NotificationResult> {
  const pref = reseller.notification_preference || 'both';

  let waResult: { url: string; apiSent: boolean; message: string } | null = null;
  let emailResult: { emailSent: boolean; mailtoLink: string; subject: string; html: string } | null = null;

  // Envio WhatsApp
  if (pref === 'whatsapp_only' || pref === 'both') {
    waResult = await sendOrderToResellerWhatsapp(order, reseller, customerProfile);
  }

  // Envio E-mail
  if (pref === 'email_only' || pref === 'both') {
    emailResult = await sendOrderToResellerEmail(order, reseller, customerProfile);
  }

  return {
    success: true,
    whatsappLink: waResult?.url,
    whatsappApiSent: waResult?.apiSent ?? false,
    messageText: waResult?.message,
    emailSent: emailResult?.emailSent ?? false,
    emailSubject: emailResult?.subject,
    emailHtml: emailResult?.html,
    emailMailtoLink: emailResult?.mailtoLink,
  };
}
