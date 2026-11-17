import type { Product, ProductImage } from '@/types';

const OPT_WEBP_REGEX = /-opt\.webp(\?.*)?$/i;
const OPT_THUMB_REGEX = /-opt-thumb\.webp(\?.*)?$/i;

/**
 * Resolve a URL de miniatura otimizada (~480px WebP) a partir de um objeto ProductImage ou URL.
 * Mantém fallback seguro para public_url caso a imagem ainda não tenha versão -opt.webp.
 */
export function getThumbImageUrl(
  imgOrUrl?: Pick<ProductImage, 'public_url' | 'thumb_url'> | string | null
): string {
  if (!imgOrUrl) return '/placeholder-product.svg';

  if (typeof imgOrUrl === 'string') {
    const clean = imgOrUrl.trim();
    if (!clean) return '/placeholder-product.svg';
    if (OPT_THUMB_REGEX.test(clean)) return clean;
    if (OPT_WEBP_REGEX.test(clean)) {
      return clean.replace(OPT_WEBP_REGEX, '-opt-thumb.webp$1');
    }
    return clean;
  }

  if (imgOrUrl.thumb_url && imgOrUrl.thumb_url.trim()) {
    return imgOrUrl.thumb_url.trim();
  }

  const pub = imgOrUrl.public_url?.trim();
  if (!pub) return '/placeholder-product.svg';

  if (OPT_THUMB_REGEX.test(pub)) return pub;
  if (OPT_WEBP_REGEX.test(pub)) {
    return pub.replace(OPT_WEBP_REGEX, '-opt-thumb.webp$1');
  }

  return pub;
}

/**
 * Retorna a URL da miniatura da foto de capa de um produto.
 */
export function getProductCoverThumbUrl(product?: Pick<Product, 'images'> | null): string {
  const images = product?.images || [];
  if (images.length === 0) return '/placeholder-product.svg';
  const coverImg = images.find((img) => img.is_cover) || images[0];
  return getThumbImageUrl(coverImg);
}
