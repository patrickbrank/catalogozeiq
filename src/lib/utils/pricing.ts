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

  const regularPrice =
    typeof product.price === 'number' && !isNaN(product.price) && product.price > 0
      ? product.price
      : null;

  const originalPrice =
    typeof product.original_price === 'number' && !isNaN(product.original_price) && product.original_price > 0
      ? product.original_price
      : null;

  const promotionalPrice =
    typeof product.promotional_price === 'number' &&
    !isNaN(product.promotional_price) &&
    product.promotional_price > 0
      ? product.promotional_price
      : null;

  let isPromoActive = false;
  let promoStatus: 'active' | 'scheduled' | 'ended' | 'none' = 'none';
  let promoStartDate: Date | null = null;
  let promoEndDate: Date | null = null;

  // Checa se o modo de pré-visualização de administrador está ativado
  const isPreview =
    forcePromoPreview ||
    (typeof window !== 'undefined' &&
      (window.localStorage?.getItem('zeiq_admin_promo_preview') === 'true' ||
        new URLSearchParams(window.location.search).has('preview') ||
        new URLSearchParams(window.location.search).get('promo') === 'preview' ||
        new URLSearchParams(window.location.search).get('promo') === '1' ||
        new URLSearchParams(window.location.search).get('admin') === '1'));

  if (promotionalPrice != null && regularPrice != null && promotionalPrice < regularPrice) {
    promoStartDate = parseISODateSafe(product.promo_start_at);
    promoEndDate = parseISODateSafe(product.promo_end_at);

    const nowTime = referenceDate.getTime();

    if (isPreview) {
      promoStatus = 'active';
      isPromoActive = true;
    } else if (promoStartDate && nowTime < promoStartDate.getTime()) {
      promoStatus = 'scheduled';
      isPromoActive = false;
    } else if (promoEndDate && nowTime > promoEndDate.getTime()) {
      promoStatus = 'ended';
      isPromoActive = false;
    } else {
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
