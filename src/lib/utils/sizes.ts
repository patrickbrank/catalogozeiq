import { Product } from '@/types';

export const COMMON_SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'G1', 'G2', 'Único'];

// Normaliza qualquer representação de tamanho para o padrão canônico do catálogo Zeiq
export function normalizeCanonicalSize(rawSize?: string | null): string {
  if (!rawSize) return '';
  const clean = rawSize.trim().toUpperCase();

  // 1. Chinelos e calçados com numeração dupla (33/34, 35/36, 37/38, 39/40, 41/42, 43/44)
  // Aceita variações: 33/34, 33-34, 33_34, 33 34, 33 / 34, 3334
  const matchDouble = clean.match(/\b(33|35|37|39|41|43)[\s\/\-_]*(34|36|38|40|42|44)\b/);
  if (matchDouble) {
    const s1 = matchDouble[1];
    const s2 = matchDouble[2];
    if (
      (s1 === '33' && s2 === '34') ||
      (s1 === '35' && s2 === '36') ||
      (s1 === '37' && s2 === '38') ||
      (s1 === '39' && s2 === '40') ||
      (s1 === '41' && s2 === '42') ||
      (s1 === '43' && s2 === '44')
    ) {
      return `${s1}/${s2}`;
    }
  }

  // Numerações compactas de chinelos (ex: 3334 -> 33/34)
  if (clean === '3334' || clean === '33' || clean === '34') return '33/34';
  if (clean === '3536' || clean === '35' || clean === '36') return '35/36';
  if (clean === '3738' || clean === '37' || clean === '38') return '37/38';
  if (clean === '3940' || clean === '39' || clean === '40') return '39/40';
  if (clean === '4142' || clean === '41' || clean === '42') return '41/42';
  if (clean === '4344' || clean === '43' || clean === '44') return '43/44';

  // 2. Sapatilhas e combinações alfanuméricas
  if (clean === 'P34/6' || clean === 'P33/6' || clean === 'P 33-36' || clean === 'P3336') return 'P 33/36';
  if (clean === 'M37/9' || clean === 'M37/4' || clean === 'M 37-40' || clean === 'M3740') return 'M 37/40';
  if (clean === 'G40/2' || clean === 'G40/4' || clean === 'G 40-44' || clean === 'G4044') return 'G 40/44';

  // 3. Tamanho único
  if (clean === 'UNICO' || clean === 'ÚNICO' || clean === 'TAMANHO UNICO' || clean === 'TAMANHO ÚNICO') return 'Único';

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
  productName?: string
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

  const fullText = `${productName ? `${productName} ` : ''}${description || ''}`;

  if (!description) {
    if (/tamanho\s*[uú]nico/i.test(fullText)) {
      return { sizes: ['Único'], outOfStockSizes: [], cleanDescription: '' };
    }
    return { sizes: [], outOfStockSizes: [], cleanDescription: '' };
  }

  // Procura padrão "Tamanhos: PP | P | M | G..." ou "Tamanho: 33/34 | 35/36..."
  const match = description.match(/Tamanhos?:\s*([^\n\r]+)/i);
  if (!match) {
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

    if (upper === 'UNICO' || upper === 'ÚNICO') {
      extracted.push('Único');
    } else if (validStandard.has(upper)) {
      extracted.push(upper);
    } else if (/^[0-9]{2}\/[0-9]{2}$/.test(s)) {
      // Calçados e Chinelos: 33/34, 35/36, 37/38, 39/40, 41/42, 43/44
      extracted.push(s);
    } else if (/^[0-9]{2}$/.test(s)) {
      // Numeração individual: 34, 36, 38, etc.
      extracted.push(s);
    } else if (/^[A-Za-z0-9\s\/\-\(\)]+$/.test(s) && s.length <= 12) {
      // Sapatilhas ou combinações alfanuméricas: P 33/36, M 37/40
      extracted.push(s);
    }
  });

  // Remove a linha "Tamanhos: ..." da descrição
  const cleanDescription = description.replace(/Tamanhos?:\s*[^\n\r]+/gi, '').trim();
  const uniqueSizes = Array.from(new Set(extracted));

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
