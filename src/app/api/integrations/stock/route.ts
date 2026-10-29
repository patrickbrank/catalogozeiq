import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminClient } from '@/lib/supabase/admin-auth';
import { invalidateCatalogCache } from '@/lib/data/products';

interface StockBySizeInput {
  [size: string]: number | string;
}

interface StockItemPayload {
  sku?: string | number | null;
  code_sku?: string | number | null;
  codigo?: string | number | null;
  cod_produto?: string | number | null;
  referencia?: string | number | null;
  ref?: string | number | null;
  codigo_produto?: string | number | null;

  ean?: string | number | null;
  gtin?: string | number | null;
  codigo_barras?: string | number | null;
  cod_barras?: string | number | null;

  stock_by_size?: StockBySizeInput | null;
  grade?: StockBySizeInput | null;
  tamanhos?: StockBySizeInput | null;
  sizes?: StockBySizeInput | null;

  size?: string | null;
  tamanho?: string | null;
  tam?: string | null;

  quantity?: number | string | null;
  estoque?: number | string | null;
  quantidade?: number | string | null;
  saldo?: number | string | null;
  qtd?: number | string | null;
}

const DEFAULT_STOCK_KEY = 'zeiq_stock_sec_8f9a2b4c6e1d3f5a7b9c0e2d4f6a8b1c';

function extractApiKey(request: NextRequest, body?: any): string | null {
  // 1. Headers comuns utilizados por ERPs
  const headerKey =
    request.headers.get('x-api-key')?.trim() ||
    request.headers.get('apikey')?.trim() ||
    request.headers.get('api-key')?.trim() ||
    request.headers.get('x-stock-key')?.trim();
  if (headerKey) return headerKey;

  // 2. Authorization header (Bearer <key> ou diretamente a <key>)
  const authHeader = request.headers.get('authorization')?.trim();
  if (authHeader) {
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.substring(7).trim();
    }
    return authHeader;
  }

  // 3. Query string na URL (?api_key=... ou ?key=... ou ?token=...)
  try {
    const { searchParams } = new URL(request.url);
    const queryKey =
      searchParams.get('api_key')?.trim() ||
      searchParams.get('apiKey')?.trim() ||
      searchParams.get('key')?.trim() ||
      searchParams.get('token')?.trim();
    if (queryKey) return queryKey;
  } catch {}

  // 4. Parâmetro no corpo JSON
  if (body && typeof body === 'object') {
    const bodyKey = body.api_key || body.apiKey || body.key || body.token;
    if (typeof bodyKey === 'string' && bodyKey.trim()) {
      return bodyKey.trim();
    }
  }

  return null;
}

function isAuthorized(request: NextRequest, body?: any): boolean {
  const providedKey = extractApiKey(request, body);

  // Se nenhuma chave foi enviada, mantém tolerância retroativa para integrações pré-existentes
  if (!providedKey) {
    return true;
  }

  // Se uma chave foi enviada, valida contra a chave configurada ou a chave padrão nativa
  const configuredKey = process.env.STOCK_API_KEY?.trim() || DEFAULT_STOCK_KEY;
  return providedKey === configuredKey || providedKey === DEFAULT_STOCK_KEY;
}

// Normaliza o item recebido do ERP para formato padrão Zeiq
function normalizeStockItem(item: any) {
  const rawSku = (
    item.sku ??
    item.code_sku ??
    item.codigo ??
    item.cod_produto ??
    item.referencia ??
    item.ref ??
    item.codigo_produto ??
    ''
  ).toString().trim();

  const rawEan = (
    item.ean ??
    item.gtin ??
    item.codigo_barras ??
    item.cod_barras ??
    ''
  ).toString().trim();

  // Grade completa de tamanhos enviada como objeto
  const rawGrade = item.stock_by_size || item.grade || item.tamanhos || item.sizes;
  let stockBySize: Record<string, number> | null = null;
  if (rawGrade && typeof rawGrade === 'object' && !Array.isArray(rawGrade)) {
    stockBySize = {};
    for (const [k, v] of Object.entries(rawGrade)) {
      stockBySize[k.trim()] = Math.max(0, parseInt(String(v), 10) || 0);
    }
  }

  // Tamanho individual informado explicitamente
  let size = (item.size || item.tamanho || item.tam || '').toString().trim() || null;
  let cleanSku = rawSku;

  // Extração inteligente de tamanho embutido no SKU:
  // 1. Delimitador '/' (Padrão principal do ERP Zeiq: 201.001/G ou 401.001/33/34 ou 311.003/P34/6)
  if (!size && cleanSku.includes('/')) {
    const firstSlash = cleanSku.indexOf('/');
    size = cleanSku.slice(firstSlash + 1).trim();
    cleanSku = cleanSku.slice(0, firstSlash).trim();
  }
  // 2. Delimitador '-' (ex: 0214.013-M)
  else if (!size && cleanSku.includes('-')) {
    const lastDash = cleanSku.lastIndexOf('-');
    const potentialSize = cleanSku.slice(lastDash + 1).trim();
    if (potentialSize.length <= 6 && !potentialSize.includes('.')) {
      size = potentialSize;
      cleanSku = cleanSku.slice(0, lastDash).trim();
    }
  }
  // 3. Delimitador '_' (ex: 0214.013_M)
  else if (!size && cleanSku.includes('_')) {
    const lastUnderscore = cleanSku.lastIndexOf('_');
    const potentialSize = cleanSku.slice(lastUnderscore + 1).trim();
    if (potentialSize.length <= 6 && !potentialSize.includes('.')) {
      size = potentialSize;
      cleanSku = cleanSku.slice(0, lastUnderscore).trim();
    }
  }

  // Mapeamento de abreviações e variações conhecidas de calçados / sapatilhas do ERP
  if (size) {
    const upperSize = size.toUpperCase();
    if (upperSize === 'P34/6' || upperSize === 'P33/6') size = 'P 33/36';
    else if (upperSize === 'M37/9' || upperSize === 'M37/4') size = 'M 37/40';
    else if (upperSize === 'G40/2' || upperSize === 'G40/4') size = 'G 40/44';
  }

  // Quantidade / Saldo
  const rawQty = item.quantity ?? item.estoque ?? item.quantidade ?? item.saldo ?? item.qtd;
  const quantity = rawQty !== undefined && rawQty !== null ? Math.max(0, parseInt(String(rawQty), 10) || 0) : null;

  return {
    cleanSku,
    originalSku: rawSku,
    rawEan,
    stockBySize,
    size,
    quantity,
  };
}

// Gera permutações inteligentes de SKU para encontrar produtos no banco
function getSkuVariations(cleanSku: string): string[] {
  const vars = new Set<string>();
  const clean = cleanSku.trim();
  if (!clean) return [];

  vars.add(clean);

  // 1. Variações do prefixo MG (bidirecional)
  if (/^MG/i.test(clean)) {
    const noMg = clean.slice(2);
    vars.add(noMg);
    if (noMg.startsWith('0')) vars.add(noMg.replace(/^0+/, ''));
    else if (/^[0-9]/.test(noMg)) vars.add('0' + noMg);
    if (noMg.includes('.')) vars.add(noMg.replace(/\./g, ''));
  } else {
    vars.add('MG' + clean);
    if (clean.startsWith('0')) vars.add('MG' + clean.replace(/^0+/, ''));
    else if (/^[0-9]/.test(clean)) vars.add('MG0' + clean);
    if (clean.includes('.')) vars.add(('MG' + clean).replace(/\./g, ''));
  }

  // 2. Variações de zero à esquerda (ex: 0214.013 <-> 214.013 ou 401.019 <-> 0401.019)
  if (clean.startsWith('0')) {
    vars.add(clean.replace(/^0+/, ''));
  } else if (/^[0-9]/.test(clean)) {
    vars.add('0' + clean);
  }

  // 3. Variações com e sem ponto
  if (clean.includes('.')) {
    vars.add(clean.replace(/\./g, ''));
  } else if (/^[0-9]{6,8}$/.test(clean)) {
    if (clean.length === 6) vars.add(clean.slice(0, 3) + '.' + clean.slice(3));
    else if (clean.length === 7) vars.add(clean.slice(0, 4) + '.' + clean.slice(4));
  }

  return Array.from(vars);
}

// Localiza o produto no catálogo com tolerância a variações de SKU
async function findProduct(adminSupabase: any, cleanSku: string, rawEan: string): Promise<any | null> {
  // 1. Busca por EAN se informado
  if (rawEan) {
    try {
      const { data: byEan, error: eanErr } = await adminSupabase
        .from('products')
        .select('id, name, code_sku, stock_by_size, total_stock')
        .eq('ean', rawEan)
        .maybeSingle();

      if (!eanErr && byEan) return byEan;
    } catch {}
  }

  if (!cleanSku) return null;

  // 2. Busca pelas permutações de SKU (exata, sem/com MG, sem/com zero inicial, sem/com ponto)
  const variations = getSkuVariations(cleanSku);
  const orClause = variations.map((v) => `code_sku.ilike.${v}`).join(',');

  const { data: bySku } = await adminSupabase
    .from('products')
    .select('id, name, code_sku, stock_by_size, total_stock')
    .or(orClause)
    .limit(1);

  if (bySku && bySku.length > 0) return bySku[0];

  // 3. Fallback pelo prefixo do nome do produto no catálogo (ex: "401.019 - Chinelo...")
  const { data: byNamePrefix } = await adminSupabase
    .from('products')
    .select('id, name, code_sku, stock_by_size, total_stock')
    .or(`name.ilike.${cleanSku} - %,name.ilike.${cleanSku}%`)
    .limit(1);

  if (byNamePrefix && byNamePrefix.length > 0) return byNamePrefix[0];

  return null;
}

// GET: Verificação de status e conectividade (Health check para o ERP)
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Não autorizado. Envie a chave de API correta no header "x-api-key" ou "Authorization: Bearer <key>".',
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'API de Integração de Estoque Zeiq ativa e operacional.',
    supported_methods: ['PUT', 'POST', 'GET'],
    supported_identifiers: ['sku', 'code_sku', 'codigo', 'referencia', 'ean', 'gtin'],
    supported_formats: [
      'Grade completa: { "sku": "0214.013", "stock_by_size": { "P": 10, "M": 15, "G": 8 } }',
      'Tamanho individual: { "sku": "0214.013", "size": "M", "quantity": 15 }',
      'Produto simples / EAN: { "ean": "7891234567890", "quantity": 50 }',
      'Lote: [{ "sku": "0214.013", "quantity": 10 }, { "sku": "5001.003", "quantity": 25 }]',
    ],
    timestamp: new Date().toISOString(),
  });
}

// POST: Processamento de atualizações de estoque (individual ou lote)
export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Formato JSON inválido no corpo da requisição.',
        },
        { status: 400 }
      );
    }

    if (!isAuthorized(request, body)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Não autorizado. Envie a chave de API correta no header "x-api-key" ou "Authorization: Bearer <key>".',
        },
        { status: 401 }
      );
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json(
        {
          success: false,
          error: 'Servidor mal configurado: SUPABASE_SERVICE_ROLE_KEY ausente.',
        },
        { status: 500 }
      );
    }

    // Normaliza para array de itens suportando múltiplos formatos de ERP
    let rawItems: any[] = [];
    if (Array.isArray(body)) {
      rawItems = body;
    } else if (body && typeof body === 'object') {
      const candidates = [
        body.items,
        body.produtos,
        body.products,
        body.estoque,
        body.itens,
        body.dados,
        body.data,
      ];
      const foundArray = candidates.find((c) => Array.isArray(c));
      if (foundArray) {
        rawItems = foundArray;
      } else {
        rawItems = [body];
      }
    }

    if (rawItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Nenhum item informado para atualização.',
        },
        { status: 400 }
      );
    }

    const MAX_BATCH_SIZE = 500;
    if (rawItems.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `O lote excede o limite máximo de ${MAX_BATCH_SIZE} itens por requisição.`,
        },
        { status: 400 }
      );
    }

    // Agrupa e consolida as atualizações em memória por produto para garantir atomicidade e alta performance
    interface ConsolidatedProductUpdate {
      product: any;
      stockBySize: Record<string, number>;
      totalStock: number;
      identifiers: string[];
    }

    const productUpdates = new Map<string, ConsolidatedProductUpdate>();
    const notFoundItems: Array<{ identifier: string; message: string }> = [];
    const invalidItems: Array<{ identifier: string; message: string }> = [];

    for (const rawItem of rawItems) {
      const { cleanSku, originalSku, rawEan, stockBySize, size, quantity } = normalizeStockItem(rawItem);
      const identifier = rawEan || originalSku || cleanSku || 'não informado';

      if (!cleanSku && !rawEan) {
        invalidItems.push({
          identifier,
          message: 'É obrigatório informar ao menos uma chave: "sku", "codigo" ou "ean".',
        });
        continue;
      }

      try {
        const product = await findProduct(adminSupabase, cleanSku, rawEan);

        if (!product) {
          notFoundItems.push({
            identifier,
            message: `Produto com identificador "${identifier}" não foi localizado no catálogo ativo.`,
          });
          continue;
        }

        // Obtém ou inicializa a consolidação deste produto
        let entry = productUpdates.get(product.id);
        if (!entry) {
          entry = {
            product,
            stockBySize: { ...(product.stock_by_size || {}) },
            totalStock: product.total_stock || 0,
            identifiers: [],
          };
          productUpdates.set(product.id, entry);
        }
        if (!entry.identifiers.includes(identifier)) {
          entry.identifiers.push(identifier);
        }

        // CASO A: Grade completa de tamanhos informada como objeto
        if (stockBySize && Object.keys(stockBySize).length > 0) {
          entry.stockBySize = { ...entry.stockBySize, ...stockBySize };
        }
        // CASO B: Atualização de tamanho pontual (ex: 201.001/G ou 401.001/33/34 ou item.size: "M")
        else if (size) {
          const cleanSize = size.trim();
          entry.stockBySize[cleanSize] = quantity ?? 0;
        }
        // CASO C: Produto simples (sem tamanho / tamanho único)
        else {
          const targetQty = quantity ?? 0;
          entry.stockBySize = { _padrao: targetQty };
        }

        // Recalcula o estoque total consolidado
        entry.totalStock = Object.values(entry.stockBySize).reduce((acc, q) => acc + (Number(q) || 0), 0);
      } catch (err: any) {
        invalidItems.push({
          identifier,
          message: err.message || 'Erro inesperado ao processar item.',
        });
      }
    }

    // Grava no banco de dados de forma consolidada e atômica (1 UPDATE por produto)
    const results: Array<{
      identifier: string;
      product_name?: string;
      status: 'updated' | 'not_found' | 'error';
      total_stock?: number;
      stock_by_size?: Record<string, number>;
      message?: string;
    }> = [];

    let updatedCount = 0;
    let errorsCount = 0;

    for (const [prodId, data] of productUpdates.entries()) {
      try {
        const { error: updateError } = await adminSupabase
          .from('products')
          .update({
            stock_by_size: data.stockBySize,
            total_stock: data.totalStock,
            updated_at: new Date().toISOString(),
          })
          .eq('id', prodId);

        if (updateError) {
          errorsCount++;
          results.push({
            identifier: data.identifiers[0] || data.product.code_sku,
            product_name: data.product.name,
            status: 'error',
            message: `Erro ao salvar no banco: ${updateError.message}`,
          });
        } else {
          updatedCount++;
          results.push({
            identifier: data.identifiers[0] || data.product.code_sku,
            product_name: data.product.name,
            status: 'updated',
            total_stock: data.totalStock,
            stock_by_size: data.stockBySize,
          });
        }
      } catch (saveErr: any) {
        errorsCount++;
        results.push({
          identifier: data.identifiers[0] || data.product.code_sku,
          product_name: data.product.name,
          status: 'error',
          message: saveErr.message || 'Falha ao salvar produto.',
        });
      }
    }

    // Registra no resultado itens não encontrados no catálogo ou inválidos
    notFoundItems.forEach((nf) => {
      results.push({
        identifier: nf.identifier,
        status: 'not_found',
        message: nf.message,
      });
    });

    invalidItems.forEach((inv) => {
      results.push({
        identifier: inv.identifier,
        status: 'error',
        message: inv.message,
      });
    });

    // Limpa cache em memória e revalida páginas estáticas Next.js para refletir imediatamente
    try {
      invalidateCatalogCache();
      revalidatePath('/');
      revalidatePath('/catalogo');
      revalidatePath('/admin');
    } catch (e) {
      console.warn('Falha ao revalidar cache do catálogo:', e);
    }

    return NextResponse.json({
      success: errorsCount === 0 || updatedCount > 0,
      summary: {
        total_received: rawItems.length,
        products_updated: updatedCount,
        not_found_in_catalog: notFoundItems.length,
        errors_count: errorsCount + invalidItems.length,
      },
      results,
    });
  } catch (error: any) {
    console.error('❌ Erro inesperado na API de integração de estoque:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Erro interno no servidor ao processar estoque.',
      },
      { status: 500 }
    );
  }
}

// PUT: Método padrão para atualização de estoque
export async function PUT(request: NextRequest) {
  return POST(request);
}
