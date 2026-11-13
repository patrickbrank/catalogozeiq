import type { Product } from '../../types';
import { getProductEffectivePrice } from './pricing';

export const COMMON_SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'G1', 'G2', 'Único'];

// Normaliza um SKU para formato compacto sem pontuações, traços, barras, espaços ou prefixo MG
export function compactSku(s?: string | null): string {
  if (!s) return '';
  return s
    .toString()
    .trim()
    .toUpperCase()
    .replace(/^MG/i, '')
    .replace(/[\.\/\-_\s]/g, '');
}

// Normaliza qualquer representação de tamanho para o padrão canônico do catálogo Zeiq
export function normalizeCanonicalSize(rawSize?: string | null): string {
  if (!rawSize) return '';
  let clean = rawSize.trim().toUpperCase();

  // Remove prefixos comuns gerados por planilhas, ERPs e Shopify:
  // "tam: M", "tam. M", "tam M", "tamanho: M", "nr.M", "nr. M", "nº M", etc.
  clean = clean.replace(/^(?:TAM(?:\.|\:|\s+|-|_)*|TAMANHO(?:\.|\:|\s+|-|_)*|NR(?:\.|\:|\s+|-|_)*|NUM(?:\.|\:|\s+|-|_)*|Nº(?:\.|\:|\s+|-|_)*)+/i, '').trim();

  // 1. Chinelos e calçados com numeração dupla delimitada (ex: 33/34, 39-40, 39_40, 39 40, 27/28, etc.)
  const matchDouble = clean.match(/\b([0-9]{2})[\s\/\-_]+([0-9]{2})\b/);
  if (matchDouble) {
    return `${matchDouble[1]}/${matchDouble[2]}`;
  }

  // Numerações compactas de 4 dígitos para calçados (ex: 3334 -> 33/34, 3940 -> 39/40, 2728 -> 27/28)
  const matchCompact4 = clean.match(/^([0-9]{2})([0-9]{2})$/);
  if (matchCompact4) {
    const n1 = parseInt(matchCompact4[1], 10);
    const n2 = parseInt(matchCompact4[2], 10);
    if (n1 >= 20 && n1 <= 50 && n2 >= n1 && n2 <= n1 + 2) {
      return `${matchCompact4[1]}/${matchCompact4[2]}`;
    }
  }

  // Mapeamentos para tamanhos isolados que correspondem a faixas tradicionais de calçados
  if (clean === '25' || clean === '26') return '25/26';
  if (clean === '27' || clean === '28') return '27/28';
  if (clean === '29' || clean === '30') return '29/30';
  if (clean === '31' || clean === '32') return '31/32';
  if (clean === '33' || clean === '34') return '33/34';
  if (clean === '35' || clean === '36') return '35/36';
  if (clean === '37' || clean === '38') return '37/38';
  if (clean === '39' || clean === '40') return '39/40';
  if (clean === '41' || clean === '42') return '41/42';
  if (clean === '43' || clean === '44') return '43/44';
  if (clean === '45' || clean === '46') return '45/46';

  // 2. Sapatilhas e combinações alfanuméricas
  if (clean === 'P34/6' || clean === 'P33/6' || clean === 'P 33-36' || clean === 'P3336') return 'P 33/36';
  if (clean === 'M37/9' || clean === 'M37/4' || clean === 'M 37-40' || clean === 'M3740') return 'M 37/40';
  if (clean === 'G40/2' || clean === 'G40/4' || clean === 'G 40-44' || clean === 'G4044') return 'G 40/44';

  // 3. Tamanho único
  if (clean === 'UNICO' || clean === 'ÚNICO' || clean === 'TAMANHO UNICO' || clean === 'TAMANHO ÚNICO' || clean === 'TU' || clean === 'U') return 'Único';

  // Ignora termos que indicam produto simples sem tamanho
  if (clean === 'SIMPLES' || clean === 'SIMPLE' || clean === 'PADRAO' || clean === 'PADRÃO' || clean === 'DEFAULT' || clean === '-') return '';

  // 4. Vestuário canônico comum (PP, P, M, G, GG, XG, G1, G2, etc.)
  if (COMMON_SIZES.includes(clean)) {
    return clean;
  }

  return clean;
}

// Localiza de forma resiliente o saldo de estoque para determinado tamanho
export function findStockForSize(
  stockBySize?: Record<string, number> | null,
  targetSize?: string | null
): number | undefined {
  if (!stockBySize || !targetSize) return undefined;

  // 1. Match exato direto
  if (typeof stockBySize[targetSize] === 'number') {
    return stockBySize[targetSize];
  }

  // 2. Match canônico normalizado (ex: '33-34' <-> '33/34' ou '33 / 34' <-> '33/34')
  const normTarget = normalizeCanonicalSize(targetSize);
  for (const [k, v] of Object.entries(stockBySize)) {
    if (typeof v === 'number' && normalizeCanonicalSize(k) === normTarget) {
      return v;
    }
  }

  return undefined;
}

// Localiza de forma resiliente o SKU de determinada variação/tamanho
export function findSkuForSize(
  skuBySize?: Record<string, string> | null,
  targetSize?: string | null,
  parentSku?: string | null
): string | undefined {
  if (!targetSize) return parentSku || undefined;

  if (skuBySize && typeof skuBySize === 'object') {
    // 1. Match direto
    if (skuBySize[targetSize]?.trim()) {
      return skuBySize[targetSize].trim();
    }
    // 2. Match canônico normalizado (ex: '33/34' <-> '33-34')
    const normTarget = normalizeCanonicalSize(targetSize);
    if (normTarget && skuBySize[normTarget]?.trim()) {
      return skuBySize[normTarget].trim();
    }
    const hyphenTarget = targetSize.includes('/') ? targetSize.replace('/', '-') : targetSize;
    if (skuBySize[hyphenTarget]?.trim()) {
      return skuBySize[hyphenTarget].trim();
    }
    for (const [k, v] of Object.entries(skuBySize)) {
      if (typeof v === 'string' && v.trim() && normalizeCanonicalSize(k) === normTarget) {
        return v.trim();
      }
    }
    // 3. Match compacto tolerante a delimitadores
    const compTarget = compactSku(targetSize);
    for (const [k, v] of Object.entries(skuBySize)) {
      if (typeof v === 'string' && v.trim() && compactSku(k) === compTarget) {
        return v.trim();
      }
    }
  }

  // 4. Fallback dinâmico com base no SKU pai
  if (parentSku?.trim()) {
    const cleanParent = parentSku.trim();
    const cleanSz = normalizeCanonicalSize(targetSize) || targetSize.trim();
    return `${cleanParent}/${cleanSz}`;
  }

  return undefined;
}

// Extrai tamanhos que foram marcados com <del> ou <s> na descrição do produto
export function getDescriptionOutOfStockSizes(description?: string | null): Set<string> {
  const result = new Set<string>();
  if (!description) return result;

  const match = description.match(/Tamanhos?:\s*([^\n\r]+)/i);
  if (!match) return result;

  const rawSizesStr = match[1];
  let rawList: string[] = [];
  if (rawSizesStr.includes('|')) {
    rawList = rawSizesStr.split('|');
  } else if (rawSizesStr.includes(',')) {
    rawList = rawSizesStr.split(',');
  } else {
    rawList = rawSizesStr.split(/\s+/);
  }

  rawList.forEach((token) => {
    const isDel = /<del|<strike|<s\b|line-through/i.test(token);
    if (!isDel) return;

    const clean = token.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim();
    if (!clean) return;

    const upper = clean.toUpperCase();
    if (upper === 'UNICO' || upper === 'ÚNICO') {
      result.add('Único');
    } else {
      result.add(upper);
      result.add(clean);
    }
  });

  return result;
}

export function parseProductSizes(
  description?: string | null,
  explicitSizes?: string[],
  productName?: string,
  stockBySize?: Record<string, any> | null,
  skuBySize?: Record<string, any> | null
): {
  sizes: string[];
  outOfStockSizes: string[];
  cleanDescription: string;
} {
  const descOutOfStock = getDescriptionOutOfStockSizes(description);

  if (explicitSizes && explicitSizes.length > 0) {
    // Se o produto já possui tamanhos explícitos cadastrados no admin
    let cleanDesc = description || '';
    cleanDesc = cleanDesc.replace(/Tamanhos?:\s*[^\n\r]+/gi, '').trim();
    return {
      sizes: explicitSizes,
      outOfStockSizes: explicitSizes.filter(
        (sz) => descOutOfStock.has(sz) || descOutOfStock.has(sz.toUpperCase())
      ),
      cleanDescription: cleanDesc,
    };
  }

  // Coleta tamanhos estruturados existentes em sku_by_size e stock_by_size
  const structuredSizes: string[] = [];
  if (skuBySize && typeof skuBySize === 'object') {
    Object.keys(skuBySize).forEach((k) => {
      const cleanK = k.trim();
      if (cleanK && cleanK !== '_padrao') {
        const canonical = normalizeCanonicalSize(cleanK) || cleanK;
        if (canonical && !structuredSizes.includes(canonical)) {
          structuredSizes.push(canonical);
        }
      }
    });
  }
  if (stockBySize && typeof stockBySize === 'object') {
    Object.keys(stockBySize).forEach((k) => {
      const cleanK = k.trim();
      if (cleanK && cleanK !== '_padrao') {
        const canonical = normalizeCanonicalSize(cleanK) || cleanK;
        if (canonical && !structuredSizes.includes(canonical)) {
          structuredSizes.push(canonical);
        }
      }
    });
  }

  const fullText = `${productName ? `${productName} ` : ''}${description || ''}`;

  if (!description) {
    if (structuredSizes.length > 0) {
      return { sizes: structuredSizes, outOfStockSizes: [], cleanDescription: '' };
    }
    if (/tamanho\s*[uú]nico/i.test(fullText)) {
      return { sizes: ['Único'], outOfStockSizes: [], cleanDescription: '' };
    }
    return { sizes: [], outOfStockSizes: [], cleanDescription: '' };
  }

  // Procura padrão "Tamanhos: PP | P | M | G..." ou "Tamanho: 33/34 | 35/36..."
  const match = description.match(/Tamanhos?:\s*([^\n\r]+)/i);
  if (!match) {
    if (structuredSizes.length > 0) {
      return { sizes: structuredSizes, outOfStockSizes: [], cleanDescription: description };
    }
    if (/tamanho\s*[uú]nico/i.test(fullText)) {
      return { sizes: ['Único'], outOfStockSizes: [], cleanDescription: description };
    }
    return { sizes: [], outOfStockSizes: [], cleanDescription: description };
  }

  const rawSizesStr = match[1];
  // Remove tags HTML como <del>, <span> etc e espaços especiais
  const cleanStr = rawSizesStr.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim();

  // Divide preferencialmente por | se existir, ou por vírgula, ou espaços
  let rawList: string[] = [];
  if (cleanStr.includes('|')) {
    rawList = cleanStr.split('|').map((s) => s.trim()).filter(Boolean);
  } else if (cleanStr.includes(',')) {
    rawList = cleanStr.split(',').map((s) => s.trim()).filter(Boolean);
  } else {
    rawList = cleanStr.split(/\s+/).map((s) => s.trim()).filter(Boolean);
  }

  const validStandard = new Set([
    'PP', 'P', 'M', 'G', 'GG', 'XG', 'G1', 'G2', 'G3', '2G', '3G',
    'ÚNICO', 'UNICO', 'INFANTIL', '34', '36', '38', '40', '42', '44', '46',
  ]);

  const extracted: string[] = [];

  rawList.forEach((token) => {
    const s = token.trim();
    if (!s) return;
    const upper = s.toUpperCase();

    const canonical = normalizeCanonicalSize(s);

    if (upper === 'UNICO' || upper === 'ÚNICO') {
      extracted.push('Único');
    } else if (validStandard.has(upper)) {
      extracted.push(upper);
    } else if (canonical && /^[0-9]{2}\/[0-9]{2}$/.test(canonical)) {
      // Calçados e Chinelos canônicos duplos (33/34, 39/40, 27/28, etc.)
      extracted.push(canonical);
    } else if (/^[0-9]{2}\/[0-9]{2}$/.test(s)) {
      // Calçados e Chinelos com barra
      extracted.push(s);
    } else if (/^[0-9]{2}$/.test(s)) {
      // Numeração individual: 34, 36, 38, etc.
      extracted.push(s);
    } else if (/^[A-Za-z0-9\s\/\-\(\)]+$/.test(s) && s.length <= 12) {
      // Sapatilhas ou combinações alfanuméricas: P 33/36, M 37/40
      extracted.push(canonical || s);
    }
  });

  // Remove a linha "Tamanhos: ..." da descrição
  const cleanDescription = description.replace(/Tamanhos?:\s*[^\n\r]+/gi, '').trim();
  const uniqueSizes = Array.from(new Set([...extracted, ...structuredSizes]));

  return {
    sizes: uniqueSizes,
    outOfStockSizes: uniqueSizes.filter(
      (sz) => descOutOfStock.has(sz) || descOutOfStock.has(sz.toUpperCase())
    ),
    cleanDescription,
  };
}

export function isSizeOutOfStock(product?: Product | null, size?: string): boolean {
  if (!product || !size) return false;

  // 1. Se o produto possui grade de estoque por tamanho detalhada
  if (product.stock_by_size && Object.keys(product.stock_by_size).length > 0) {
    const stock = findStockForSize(product.stock_by_size, size);
    if (typeof stock === 'number') {
      return stock <= 0;
    }
    // Grade cadastrada, mas este tamanho específico não consta ou não tem estoque
    return true;
  }

  // 2. Se a descrição do produto marca o tamanho como indisponível via <del> ou <s>
  if (product.description) {
    const descOutOfStock = getDescriptionOutOfStockSizes(product.description);
    const norm = normalizeCanonicalSize(size);
    if (
      descOutOfStock.has(size) ||
      descOutOfStock.has(size.toUpperCase()) ||
      descOutOfStock.has(size.trim()) ||
      descOutOfStock.has(norm)
    ) {
      return true;
    }
  }

  // 3. Se não há grade por tamanho, verifica o estoque total do produto
  if (typeof product.total_stock === 'number') {
    return product.total_stock <= 0;
  }

  return false;
}

export function isProductOutOfStock(product?: Product | null): boolean {
  if (!product) return false;
  const { sizes } = parseProductSizes(product.description, product.sizes, product.name);
  const hasSizes = sizes && sizes.length > 0;

  if (hasSizes) {
    if (product.stock_by_size && Object.keys(product.stock_by_size).length > 0) {
      return sizes.every((sz) => isSizeOutOfStock(product, sz));
    }
    return typeof product.total_stock === 'number' && product.total_stock <= 0;
  } else {
    if (typeof product.total_stock === 'number' && product.total_stock <= 0) return true;
    if (product.stock_by_size && typeof product.stock_by_size['_padrao'] === 'number' && product.stock_by_size['_padrao'] <= 0) return true;
    return false;
  }
}

export interface CanonicalVariant {
  id: string;
  product_id: string;
  sku: string;
  sku_alt: string;
  parent_sku: string;
  product_sku: string;
  code_sku: string;
  sku_pai: string;
  barcode: string | null;
  ean: string | null;
  size: string | null;
  tamanho: string | null;
  tam: string | null;
  title: string;
  name: string;
  option1: string | null;
  option1_alt: string | null;
  option_value: string | null;
  options: string[];
  display_title: string;
  shopify_title: string;
  shopify_title_alt?: string | null;
  shopify_option1: string;
  shopify_option1_alt?: string | null;
  alt_size: string | null;
  type?: string;
  product_type?: string;
  tipo?: string;
  position: number;
  inventory_quantity: number;
  stock: number;
  price: number | null;
  regular_price: number | null;
  promotional_price: number | null;
  is_promo: boolean;
}

export interface ProductOption {
  id: string;
  product_id: string;
  name: string;
  position: number;
  values: string[];
}

export function buildProductVariants(product: {
  id: string;
  name?: string | null;
  code_sku?: string | null;
  ean?: string | null;
  price?: number | null;
  original_price?: number | null;
  promotional_price?: number | null;
  promo_start_at?: string | null;
  promo_end_at?: string | null;
  stock_by_size?: Record<string, any> | null;
  sku_by_size?: Record<string, string> | null;
  total_stock?: number | null;
  sizes?: string[] | null;
}): {
  variants: CanonicalVariant[];
  hasSizes: boolean;
  options: ProductOption[];
} {
  let sizesList = product.sizes || [];
  if (sizesList.length === 0) {
    const fallbackSizes = new Set<string>();
    if (product.sku_by_size && typeof product.sku_by_size === 'object') {
      Object.keys(product.sku_by_size).forEach((k) => {
        const cleanK = k.trim();
        if (cleanK && cleanK !== '_padrao') {
          fallbackSizes.add(normalizeCanonicalSize(cleanK) || cleanK);
        }
      });
    }
    if (product.stock_by_size && typeof product.stock_by_size === 'object') {
      Object.keys(product.stock_by_size).forEach((k) => {
        const cleanK = k.trim();
        if (cleanK && cleanK !== '_padrao') {
          fallbackSizes.add(normalizeCanonicalSize(cleanK) || cleanK);
        }
      });
    }
    if (fallbackSizes.size > 0) {
      sizesList = Array.from(fallbackSizes);
    }
  }
  const hasSizes = sizesList.length > 0;
  const parentSku = (product.code_sku || '').trim();
  const prodName = (product.name || '').trim();

  const pricing = getProductEffectivePrice({
    id: product.id,
    name: prodName,
    slug: '',
    code_sku: parentSku,
    price: product.price ?? null,
    original_price: product.original_price ?? null,
    promotional_price: product.promotional_price ?? null,
    promo_start_at: product.promo_start_at ?? null,
    promo_end_at: product.promo_end_at ?? null,
    is_published: true,
    is_featured: false,
    display_order: 0,
    tags: [],
  });

  const effectivePrice = pricing.effectivePrice ?? product.price ?? null;

  if (hasSizes) {
    const variants: CanonicalVariant[] = sizesList.map((sz: string, vIdx: number) => {
      const canonicalSz = normalizeCanonicalSize(sz) || sz.trim();
      const stockQty = findStockForSize(product.stock_by_size, canonicalSz) ?? 0;
      const hyphenSz = canonicalSz.includes('/') ? canonicalSz.replace('/', '-') : canonicalSz;
      
      const explicitSku = findSkuForSize(product.sku_by_size, canonicalSz, null) || findSkuForSize(product.sku_by_size, sz, null);
      const fallbackSku = parentSku ? `${parentSku}/${canonicalSz}` : canonicalSz;
      const variantSku = explicitSku || fallbackSku;
      const altSku = explicitSku || (parentSku ? `${parentSku}/${hyphenSz}` : hyphenSz);

      return {
        id: `${product.id}-${canonicalSz}`,
        product_id: product.id,
        sku: variantSku,
        sku_alt: altSku,
        parent_sku: parentSku,
        product_sku: parentSku,
        code_sku: parentSku,
        sku_pai: parentSku,
        barcode: product.ean || null,
        ean: product.ean || null,
        size: canonicalSz,
        tamanho: canonicalSz,
        tam: canonicalSz,
        title: canonicalSz,
        name: `${prodName} - ${canonicalSz}`,
        option1: canonicalSz,
        option1_alt: hyphenSz,
        option_value: canonicalSz,
        options: [canonicalSz],
        display_title: canonicalSz,
        shopify_title: canonicalSz,
        shopify_title_alt: hyphenSz,
        shopify_option1: canonicalSz,
        shopify_option1_alt: hyphenSz,
        alt_size: hyphenSz,
        type: 'variation',
        product_type: 'variation',
        tipo: 'variacao',
        position: vIdx + 1,
        inventory_quantity: stockQty,
        stock: stockQty,
        price: effectivePrice,
        regular_price: pricing.regularPrice ?? product.price ?? null,
        promotional_price: pricing.promotionalPrice ?? null,
        is_promo: pricing.isPromoActive,
      };
    });

    const options: ProductOption[] = [
      {
        id: `opt-${product.id}-tamanho`,
        product_id: product.id,
        name: 'Tamanho',
        position: 1,
        values: sizesList,
      },
    ];

    return { variants, hasSizes: true, options };
  }

  const defaultVariant: CanonicalVariant = {
    id: `${product.id}-default`,
    product_id: product.id,
    sku: parentSku,
    sku_alt: parentSku,
    parent_sku: parentSku,
    product_sku: parentSku,
    code_sku: parentSku,
    sku_pai: parentSku,
    barcode: product.ean || null,
    ean: product.ean || null,
    size: null,
    tamanho: null,
    tam: null,
    title: 'Padrão',
    name: prodName,
    option1: null,
    option1_alt: null,
    option_value: null,
    options: [],
    display_title: 'Padrão',
    shopify_title: 'Default Title',
    shopify_title_alt: null,
    shopify_option1: 'Default Title',
    shopify_option1_alt: null,
    alt_size: null,
    type: 'simple',
    product_type: 'simple',
    tipo: 'simples',
    position: 1,
    inventory_quantity: product.total_stock ?? 0,
    stock: product.total_stock ?? 0,
    price: effectivePrice,
    regular_price: pricing.regularPrice ?? product.price ?? null,
    promotional_price: pricing.promotionalPrice ?? null,
    is_promo: pricing.isPromoActive,
  };

  return { variants: [defaultVariant], hasSizes: false, options: [] };
}
