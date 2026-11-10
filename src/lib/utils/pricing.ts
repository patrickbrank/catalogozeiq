import type { Product } from '@/types';

export interface ProductPricingInfo {
  effectivePrice: number | null;
  regularPrice: number | null;
  originalPrice: number | null;
  promotionalPrice: number | null;
  campaignName?: string | null;
  campaignEmoji?: string | null;
  isPromoActive: boolean;
  promoStatus: 'active' | 'scheduled' | 'ended' | 'none';
  promoStartDate?: Date | null;
  promoEndDate?: Date | null;
  discountPercentage?: number | null;
  savingsAmount?: number | null;
  resellerMarginPercentage?: number | null;
}

export function parseISODateSafe(val?: string | null): Date | null {
  if (!val) return null;
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function formatISODateToYMD(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatCurrencyBRL(val?: number | null): string {
  if (val == null || isNaN(val)) return 'R$ 0,00';
  return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function parseNumberSafe(val: any): number | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const str = String(val).trim().replace(/R\$|\$/g, '').trim();
  const num = str.includes(',')
    ? parseFloat(str.replace(/\./g, '').replace(',', '.'))
    : parseFloat(str);
  return isNaN(num) || num <= 0 ? null : num;
}

export function cleanSkuKey(sku?: string | null): string {
  if (!sku) return '';
  return sku.trim().toLowerCase().replace(/^mg/i, '');
}

export function getProductEffectivePrice(
  product?: Product | null,
  referenceDate: Date = new Date(),
  forcePromoPreview: boolean = false
): ProductPricingInfo {
  if (!product) {
    return {
      effectivePrice: null,
      regularPrice: null,
      originalPrice: null,
      promotionalPrice: null,
      isPromoActive: false,
      promoStatus: 'none',
    };
  }

  const regularPrice = parseNumberSafe(product.price);
  const originalPrice = parseNumberSafe(product.original_price);
  const promotionalPrice = parseNumberSafe(product.promotional_price);

  let isPromoActive = false;
  let promoStatus: 'active' | 'scheduled' | 'ended' | 'none' = 'none';
  let promoStartDate: Date | null = null;
  let promoEndDate: Date | null = null;

  // Checa se o modo de pré-visualização forçado foi explicitamente solicitado
  const isPreview =
    forcePromoPreview === true ||
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('preview') === 'promo');

  if (promotionalPrice != null && regularPrice != null && promotionalPrice < regularPrice) {
    // Se não houver data de início específica definida no produto, adota a data oficial da campanha (13/11/2026 00:00:00 BRT)
    promoStartDate = parseISODateSafe(product.promo_start_at) || new Date('2026-11-13T03:00:00.000Z');
    promoEndDate = parseISODateSafe(product.promo_end_at) || new Date('2026-12-01T02:59:59.000Z');

    const nowTime = referenceDate.getTime();

    if (isPreview) {
      promoStatus = 'active';
      isPromoActive = true;
    } else if (promoStartDate && nowTime < promoStartDate.getTime()) {
      // ANTES DA DATA DE INÍCIO (ex: antes do dia 13/11)
      promoStatus = 'scheduled';
      isPromoActive = false;
    } else if (promoEndDate && nowTime > promoEndDate.getTime()) {
      // APÓS O TÉRMINO DA CAMPANHA
      promoStatus = 'ended';
      isPromoActive = false;
    } else {
      // DENTRO DO PERÍODO VIGENTE DA PROMOÇÃO (a partir de 13/11)
      promoStatus = 'active';
      isPromoActive = true;
    }
  }

  const effectivePrice = isPromoActive && promotionalPrice != null ? promotionalPrice : regularPrice;

  let discountPercentage: number | null = null;
  let savingsAmount: number | null = null;
  if (isPromoActive && promotionalPrice != null && regularPrice != null) {
    savingsAmount = Math.max(0, regularPrice - promotionalPrice);
    discountPercentage = Math.round((savingsAmount / regularPrice) * 100);
  }

  let resellerMarginPercentage: number | null = null;
  if (effectivePrice != null && originalPrice != null && originalPrice > effectivePrice) {
    resellerMarginPercentage = Math.round(((originalPrice - effectivePrice) / effectivePrice) * 100);
  }

  return {
    effectivePrice,
    regularPrice,
    originalPrice,
    promotionalPrice,
    campaignName: product.campaign_name || null,
    campaignEmoji: product.campaign_emoji || '🔥',
    isPromoActive,
    promoStatus,
    promoStartDate,
    promoEndDate,
    discountPercentage,
    savingsAmount,
    resellerMarginPercentage,
  };
}
