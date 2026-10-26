import { Product } from '@/types';

export const COMMON_SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'G1', 'G2', 'Único'];

export function parseProductSizes(
  description?: string | null,
  explicitSizes?: string[],
  productName?: string
): {
  sizes: string[];
  cleanDescription: string;
} {
  if (explicitSizes && explicitSizes.length > 0) {
    // Se o produto já possui tamanhos explícitos cadastrados no admin
    let cleanDesc = description || '';
    cleanDesc = cleanDesc.replace(/Tamanhos?:\s*[^\n\r]+/gi, '').trim();
    return {
      sizes: explicitSizes,
      cleanDescription: cleanDesc,
    };
  }

  const fullText = `${productName ? `${productName} ` : ''}${description || ''}`;

  if (!description) {
    if (/tamanho\s*[uú]nico/i.test(fullText)) {
      return { sizes: ['Único'], cleanDescription: '' };
    }
    return { sizes: [], cleanDescription: '' };
  }

  // Procura padrão "Tamanhos: PP | P | M | G..." ou "Tamanho: 33/34 | 35/36..."
  const match = description.match(/Tamanhos?:\s*([^\n\r]+)/i);
  if (!match) {
    if (/tamanho\s*[uú]nico/i.test(fullText)) {
      return { sizes: ['Único'], cleanDescription: description };
    }
    return { sizes: [], cleanDescription: description };
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

  return {
    sizes: Array.from(new Set(extracted)),
    cleanDescription,
  };
}

export function isSizeOutOfStock(product?: Product | null, size?: string): boolean {
  if (!product || !size) return false;

  // 1. Se o produto possui grade de estoque por tamanho detalhada
  if (product.stock_by_size && Object.keys(product.stock_by_size).length > 0) {
    const stock = product.stock_by_size[size];
    if (typeof stock === 'number') {
      return stock <= 0;
    }
    // Grade cadastrada, mas este tamanho específico não consta ou não tem estoque
    return true;
  }

  // 2. Se não há grade por tamanho, verifica o estoque total do produto
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
