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

  // Grade completa de tamanhos
  const rawGrade = item.stock_by_size || item.grade || item.tamanhos || item.sizes;
  let stockBySize: Record<string, number> | null = null;
  if (rawGrade && typeof rawGrade === 'object' && !Array.isArray(rawGrade)) {
    stockBySize = {};
    for (const [k, v] of Object.entries(rawGrade)) {
      stockBySize[k.trim()] = Math.max(0, parseInt(String(v), 10) || 0);
    }
  }

  // Tamanho individual
  let size = (item.size || item.tamanho || item.tam || '').toString().trim() || null;

  // Se SKU vier como "0214.013-M" e o tamanho não tiver sido informado
  let cleanSku = rawSku;
  if (!size && cleanSku.includes('-')) {
    const parts = cleanSku.split('-');
    if (parts.length === 2 && parts[1].length <= 5) {
      cleanSku = parts[0].trim();
      size = parts[1].trim();
    }
  }

  // Quantidade / Saldo
  const rawQty = item.quantity ?? item.estoque ?? item.quantidade ?? item.saldo ?? item.qtd;
  const quantity = rawQty !== undefined && rawQty !== null ? Math.max(0, parseInt(String(rawQty), 10) || 0) : null;

  return {
    rawSku: cleanSku,
    originalSku: rawSku,
    rawEan,
    stockBySize,
    size,
    quantity,
  };
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

  // 2. Busca exata por code_sku
  const { data: byExactSku } = await adminSupabase
    .from('products')
    .select('id, name, code_sku, stock_by_size, total_stock')
    .ilike('code_sku', cleanSku)
    .maybeSingle();

  if (byExactSku) return byExactSku;

  // 3. Variações comuns de SKU entre ERPs brasileiros:
  const variations: string[] = [];

  // a) Com ou sem zero inicial (ex: "0214.013" <-> "214.013")
  if (cleanSku.startsWith('0')) {
    variations.push(cleanSku.replace(/^0+/, ''));
  } else if (/^[0-9]/.test(cleanSku)) {
    variations.push(`0${cleanSku}`);
  }

  // b) Com ou sem ponto (ex: "0214.013" <-> "0214013" ou "401.019" <-> "401019")
  if (cleanSku.includes('.')) {
    variations.push(cleanSku.replace(/\./g, ''));
  } else if (/^[0-9]{6,8}$/.test(cleanSku)) {
    // Tenta formato padrão com ponto se tiver 7 dígitos (ex: 401019 -> 401.019)
    if (cleanSku.length === 6) {
      variations.push(`${cleanSku.slice(0, 3)}.${cleanSku.slice(3)}`);
    } else if (cleanSku.length === 7) {
      variations.push(`${cleanSku.slice(0, 4)}.${cleanSku.slice(4)}`);
    }
  }

  for (const candidate of variations) {
    const { data: byCand } = await adminSupabase
      .from('products')
      .select('id, name, code_sku, stock_by_size, total_stock')
      .ilike('code_sku', candidate)
      .maybeSingle();

    if (byCand) return byCand;
  }

  // 4. Fallback pelo prefixo do nome do produto (ex: "401.019 - Chinelo...")
  const { data: byNamePrefix } = await adminSupabase
    .from('products')
    .select('id, name, code_sku, stock_by_size, total_stock')
    .ilike('name', `${cleanSku}%`)
    .maybeSingle();

  if (byNamePrefix) return byNamePrefix;

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

    for (const rawItem of rawItems) {
      const { rawSku, originalSku, rawEan, stockBySize, size, quantity } = normalizeStockItem(rawItem);
      const identifier = rawEan || originalSku || rawSku || 'não informado';

      if (!rawSku && !rawEan) {
        errorsCount++;
        results.push({
          identifier,
          status: 'error',
          message: 'É obrigatório informar ao menos uma chave: "sku", "codigo" ou "ean".',
        });
        continue;
      }

      try {
        const product = await findProduct(adminSupabase, rawSku, rawEan);

        if (!product) {
          errorsCount++;
          results.push({
            identifier,
            status: 'not_found',
            message: `Produto com identificador "${identifier}" não foi localizado no catálogo.`,
          });
          continue;
        }

        let newStockBySize: Record<string, number> = {};
        let newTotalStock = 0;

        // CASO A: Grade completa de tamanhos informada
        if (stockBySize && Object.keys(stockBySize).length > 0) {
          newStockBySize = stockBySize;
          newTotalStock = Object.values(newStockBySize).reduce((acc, q) => acc + q, 0);
        }
        // CASO B: Atualização de tamanho pontual
        else if (size) {
          const cleanSize = size.trim();
          const targetQty = quantity ?? 0;

          const currentStock: Record<string, number> = { ...(product.stock_by_size || {}) };
          currentStock[cleanSize] = targetQty;

          newStockBySize = currentStock;
          newTotalStock = Object.values(newStockBySize).reduce((acc, q) => acc + (Number(q) || 0), 0);
        }
        // CASO C: Produto simples (sem tamanho / tamanho único)
        else {
          const targetQty = quantity ?? 0;
          newTotalStock = targetQty;
          newStockBySize = { _padrao: targetQty };
        }

        // Grava no banco de dados
        const { error: updateError } = await adminSupabase
          .from('products')
          .update({
            stock_by_size: newStockBySize,
            total_stock: newTotalStock,
            updated_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        if (updateError) {
          errorsCount++;
          results.push({
            identifier,
            product_name: product.name,
            status: 'error',
            message: `Erro ao salvar no banco: ${updateError.message}`,
          });
        } else {
          updatedCount++;
          results.push({
            identifier,
            product_name: product.name,
            status: 'updated',
            total_stock: newTotalStock,
            stock_by_size: newStockBySize,
          });
        }
      } catch (err: any) {
        errorsCount++;
        results.push({
          identifier,
          status: 'error',
          message: err.message || 'Erro inesperado ao processar item.',
        });
      }
    }

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
      success: true,
      summary: {
        total_received: rawItems.length,
        updated: updatedCount,
        errors_count: errorsCount,
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
