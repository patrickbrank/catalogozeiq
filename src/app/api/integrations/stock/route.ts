import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin-auth';
import { invalidateCatalogCache } from '@/lib/data/products';

interface StockBySizeInput {
  [size: string]: number | string;
}

interface StockItemPayload {
  sku?: string | null;
  code_sku?: string | null;
  ean?: string | null;
  stock_by_size?: StockBySizeInput | null;
  size?: string | null;
  quantity?: number | string | null;
  estoque?: number | string | null; // Sinônimo aceito em português
}

const DEFAULT_STOCK_KEY = 'zeiq_stock_sec_8f9a2b4c6e1d3f5a7b9c0e2d4f6a8b1c';

function extractApiKey(request: NextRequest): string | null {
  const headerKey = request.headers.get('x-api-key')?.trim();
  if (headerKey) return headerKey;

  const authHeader = request.headers.get('authorization')?.trim();
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}

function isAuthorized(request: NextRequest, isMutation = false): boolean {
  const providedKey = extractApiKey(request);

  // 1. Mutações (POST/PUT) exigem chave de API obrigatoriamente
  if (!providedKey) {
    return !isMutation;
  }

  // 2. Se uma chave for enviada, valida contra a chave configurada ou a chave padrão nativa
  const configuredKey = process.env.STOCK_API_KEY?.trim() || DEFAULT_STOCK_KEY;
  return providedKey === configuredKey || providedKey === DEFAULT_STOCK_KEY;
}

// GET: Verificação de status e conectividade (Health check para o ERP)
export async function GET(request: NextRequest) {
  if (!isAuthorized(request, false)) {
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
    supported_identifiers: ['sku', 'code_sku', 'ean'],
    supported_formats: [
      'Grade completa: { "sku": "0214.013", "stock_by_size": { "P": 10, "M": 15, "G": 8 } }',
      'Tamanho individual: { "sku": "0214.013", "size": "M", "quantity": 15 }',
      'Produto simples / EAN: { "ean": "7891234567890", "quantity": 50 }',
    ],
    timestamp: new Date().toISOString(),
  });
}

// POST: Processamento de atualizações de estoque (individual ou lote)
export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request, true)) {
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

    // Normaliza para array de itens
    let items: StockItemPayload[] = [];
    if (Array.isArray(body)) {
      items = body;
    } else if (body && Array.isArray(body.items)) {
      items = body.items;
    } else if (body && typeof body === 'object') {
      items = [body];
    }

    if (items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Nenhum item informado para atualização.',
        },
        { status: 400 }
      );
    }

    const MAX_BATCH_SIZE = 500;
    if (items.length > MAX_BATCH_SIZE) {
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

    for (const item of items) {
      const rawSku = (item.sku || item.code_sku || '').toString().trim();
      const rawEan = (item.ean || '').toString().trim();
      const identifier = rawEan || rawSku || 'não informado';

      if (!rawSku && !rawEan) {
        errorsCount++;
        results.push({
          identifier,
          status: 'error',
          message: 'É obrigatório informar ao menos uma chave: "sku" ou "ean".',
        });
        continue;
      }

      try {
        let product: any = null;

        // 1. Tenta buscar por EAN se informado
        if (rawEan) {
          const { data: byEan, error: eanErr } = await adminSupabase
            .from('products')
            .select('id, name, code_sku, stock_by_size, total_stock')
            .eq('ean', rawEan)
            .maybeSingle();

          // Ignora erro se coluna EAN ainda não foi criada no banco
          if (!eanErr && byEan) {
            product = byEan;
          }
        }

        // 2. Se não encontrou por EAN, busca por SKU (code_sku)
        if (!product && rawSku) {
          const { data: bySku } = await adminSupabase
            .from('products')
            .select('id, name, code_sku, stock_by_size, total_stock')
            .ilike('code_sku', rawSku)
            .maybeSingle();

          product = bySku;
        }

        // 3. Fallback: se SKU tiver sufixos como variações "0214.013-M" e o ERP enviar assim
        if (!product && rawSku && rawSku.includes('-')) {
          const [baseSku, possibleSize] = rawSku.split('-');
          if (baseSku) {
            const { data: byBaseSku } = await adminSupabase
              .from('products')
              .select('id, name, code_sku, stock_by_size, total_stock')
              .ilike('code_sku', baseSku.trim())
              .maybeSingle();

            if (byBaseSku) {
              product = byBaseSku;
              // Se não informou size explicitamente, usa a parte após o hífen
              if (!item.size && possibleSize) {
                item.size = possibleSize.trim();
              }
            }
          }
        }

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
        if (item.stock_by_size && typeof item.stock_by_size === 'object') {
          Object.entries(item.stock_by_size).forEach(([szKey, rawQty]) => {
            const cleanKey = szKey.trim();
            const parsedQty = Math.max(0, parseInt(String(rawQty), 10) || 0);
            newStockBySize[cleanKey] = parsedQty;
          });
          newTotalStock = Object.values(newStockBySize).reduce((acc, q) => acc + q, 0);
        }
        // CASO B: Atualização de tamanho pontual
        else if (item.size) {
          const cleanSize = item.size.trim();
          const rawQty = item.quantity !== undefined ? item.quantity : item.estoque;
          const parsedQty = Math.max(0, parseInt(String(rawQty ?? 0), 10) || 0);

          const currentStock: Record<string, number> = { ...(product.stock_by_size || {}) };
          currentStock[cleanSize] = parsedQty;

          newStockBySize = currentStock;
          newTotalStock = Object.values(newStockBySize).reduce((acc, q) => acc + (Number(q) || 0), 0);
        }
        // CASO C: Produto simples (sem tamanho / tamanho único)
        else {
          const rawQty = item.quantity !== undefined ? item.quantity : item.estoque;
          const parsedQty = Math.max(0, parseInt(String(rawQty ?? 0), 10) || 0);

          newTotalStock = parsedQty;
          newStockBySize = { _padrao: parsedQty };
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

    // Limpa cache em memória do servidor Next.js para refletir imediatamente
    try {
      invalidateCatalogCache();
    } catch (e) {
      console.warn('Falha ao invalidar cache em memória:', e);
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_received: items.length,
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
