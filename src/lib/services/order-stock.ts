import { revalidatePath } from 'next/cache';
import { invalidateCatalogCache } from '@/lib/data/products';
import { normalizeCanonicalSize } from '@/lib/utils/sizes';
import { OrderStatus } from '@/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const STOCK_DEDUCTED_STATUSES = new Set<string>([
  'approved',
  'processing',
  'shipped',
  'delivered',
]);

export const STOCK_REFUND_STATUSES = new Set<string>([
  'cancelled',
  'pending',
]);

interface ProductOrderDelta {
  productId?: string;
  sku?: string | null;
  sizeDeltas: Record<string, number>;
  simpleDelta: number;
}

function resolveExistingStockKey(
  currentStock: Record<string, number>,
  skuBySize: Record<string, any> | null | undefined,
  rawSize: string
): string {
  if (typeof currentStock[rawSize] === 'number') {
    return rawSize;
  }

  const trimmed = rawSize.trim();
  if (typeof currentStock[trimmed] === 'number') {
    return trimmed;
  }

  const normTarget = normalizeCanonicalSize(trimmed) || trimmed;

  // 1. Procura chave equivalente já existente em stock_by_size
  for (const [k, v] of Object.entries(currentStock)) {
    if (k !== '_padrao' && typeof v === 'number') {
      const normKey = normalizeCanonicalSize(k) || k.trim();
      if (normKey === normTarget) {
        return k;
      }
    }
  }

  // 2. Procura chave equivalente cadastrada em sku_by_size
  if (skuBySize && typeof skuBySize === 'object') {
    for (const k of Object.keys(skuBySize)) {
      if (k !== '_padrao') {
        const normKey = normalizeCanonicalSize(k) || k.trim();
        if (normKey === normTarget) {
          return normalizeCanonicalSize(k) || k.trim();
        }
      }
    }
  }

  return normTarget;
}

function aggregateOrderItems(items: any[]): ProductOrderDelta[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const byKey = new Map<string, ProductOrderDelta>();

  for (const item of items) {
    if (!item) continue;
    const rawProdId = typeof item.productId === 'string' ? item.productId.trim() : '';
    const rawSku = typeof item.sku === 'string' ? item.sku.trim() : '';
    const mapKey = rawProdId || (rawSku ? `sku:${rawSku}` : '');
    if (!mapKey) continue;

    let entry = byKey.get(mapKey);
    if (!entry) {
      entry = {
        productId: UUID_REGEX.test(rawProdId) ? rawProdId : undefined,
        sku: rawSku || null,
        sizeDeltas: {},
        simpleDelta: 0,
      };
      byKey.set(mapKey, entry);
    }

    if (item.sizeBreakdown && typeof item.sizeBreakdown === 'object' && Object.keys(item.sizeBreakdown).length > 0) {
      for (const [sz, qty] of Object.entries(item.sizeBreakdown)) {
        const numQty = Math.max(0, Number(qty) || 0);
        if (numQty <= 0) continue;
        const cleanSz = normalizeCanonicalSize(sz) || sz.trim();
        entry.sizeDeltas[cleanSz] = (entry.sizeDeltas[cleanSz] || 0) + numQty;
      }
    } else if (item.selectedSize && String(item.selectedSize).trim()) {
      const numQty = Math.max(0, Number(item.quantity) || 1);
      if (numQty > 0) {
        const cleanSz = normalizeCanonicalSize(String(item.selectedSize)) || String(item.selectedSize).trim();
        entry.sizeDeltas[cleanSz] = (entry.sizeDeltas[cleanSz] || 0) + numQty;
      }
    } else {
      const numQty = Math.max(0, Number(item.quantity) || 1);
      if (numQty > 0) {
        entry.simpleDelta += numQty;
      }
    }
  }

  return Array.from(byKey.values());
}

/**
 * Executa baixa (isDeduction=true) ou estorno (isDeduction=false) de estoque para os itens do pedido
 * mantendo 100% de compatibilidade com a integração de ERP (/api/integrations/stock) e usando
 * controle otimista de concorrência (CAS via updated_at) para evitar perda de atualizações simultâneas.
 */
export async function processOrderStockMovement(
  adminSupabase: any,
  items: any[],
  isDeduction: boolean
): Promise<{ updatedProducts: number }> {
  if (!adminSupabase || !Array.isArray(items) || items.length === 0) {
    return { updatedProducts: 0 };
  }

  const aggregated = aggregateOrderItems(items);
  if (aggregated.length === 0) {
    return { updatedProducts: 0 };
  }

  const sign = isDeduction ? -1 : 1;
  let updatedProducts = 0;

  for (const agg of aggregated) {
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        let prod: any = null;

        if (agg.productId) {
          const { data } = await adminSupabase
            .from('products')
            .select('id, code_sku, stock_by_size, sku_by_size, total_stock, updated_at')
            .eq('id', agg.productId)
            .maybeSingle();
          prod = data;
        } else if (agg.sku) {
          const { data } = await adminSupabase
            .from('products')
            .select('id, code_sku, stock_by_size, sku_by_size, total_stock, updated_at')
            .eq('code_sku', agg.sku)
            .limit(1)
            .maybeSingle();
          prod = data;
        }

        if (!prod) break;

        const currentStock: Record<string, number> = {};
        if (prod.stock_by_size && typeof prod.stock_by_size === 'object') {
          for (const [k, v] of Object.entries(prod.stock_by_size)) {
            if (typeof v === 'number' && !Number.isNaN(v)) {
              currentStock[k] = v;
            } else if (v !== null && v !== undefined && !Number.isNaN(Number(v))) {
              currentStock[k] = Number(v);
            }
          }
        }

        const existingNonPadrao = Object.keys(currentStock).filter((k) => k !== '_padrao');
        const skuNonPadrao =
          prod.sku_by_size && typeof prod.sku_by_size === 'object'
            ? Object.keys(prod.sku_by_size).filter((k) => k !== '_padrao')
            : [];

        const hasStructuredSizes = existingNonPadrao.length > 0 || skuNonPadrao.length > 0;
        const sizeEntries = Object.entries(agg.sizeDeltas);
        const netTotalDelta =
          (sizeEntries.reduce((sum, [, q]) => sum + q, 0) + agg.simpleDelta) * sign;

        let newStockBySize: Record<string, number> = { ...currentStock };
        let newTotal = Math.max(0, Number(prod.total_stock) || 0);

        if (Object.keys(currentStock).length === 0) {
          // Produto sem grade de estoque inicializada ainda
          if (newTotal === 0 && isDeduction) {
            // Não cria chaves parciais em stock_by_size vazio para não marcar outros tamanhos como esgotados
            break;
          }

          if (!hasStructuredSizes && sizeEntries.length === 0) {
            newTotal = Math.max(0, newTotal + netTotalDelta);
            newStockBySize = { _padrao: newTotal };
          } else {
            // Produto com tamanhos mas apenas total_stock preenchido: ajusta total_stock sem poluir stock_by_size
            newTotal = Math.max(0, newTotal + netTotalDelta);
          }
        } else {
          // 1. Aplica variações por tamanho
          for (const [rawSz, qty] of sizeEntries) {
            const delta = qty * sign;
            const targetKey = resolveExistingStockKey(newStockBySize, prod.sku_by_size, rawSz);

            if (typeof newStockBySize[targetKey] === 'number') {
              newStockBySize[targetKey] = Math.max(0, newStockBySize[targetKey] + delta);
            } else if (
              !isDeduction &&
              hasStructuredSizes &&
              delta > 0
            ) {
              newStockBySize[targetKey] = Math.max(0, delta);
            } else if (skuNonPadrao.some((k) => (normalizeCanonicalSize(k) || k.trim()) === targetKey)) {
              newStockBySize[targetKey] = Math.max(0, delta);
            } else if (!hasStructuredSizes) {
              const prevPadrao =
                typeof newStockBySize['_padrao'] === 'number'
                  ? newStockBySize['_padrao']
                  : newTotal;
              newStockBySize['_padrao'] = Math.max(0, prevPadrao + delta);
            }
          }

          // 2. Aplica quantidade simples (itens sem variação informada)
          if (agg.simpleDelta > 0) {
            const simpleDelta = agg.simpleDelta * sign;
            const finalNonPadrao = Object.keys(newStockBySize).filter((k) => k !== '_padrao');

            if (finalNonPadrao.length === 0 && !hasStructuredSizes) {
              const prevPadrao =
                typeof newStockBySize['_padrao'] === 'number'
                  ? newStockBySize['_padrao']
                  : newTotal;
              newStockBySize['_padrao'] = Math.max(0, prevPadrao + simpleDelta);
            } else if (finalNonPadrao.length === 1) {
              const onlyKey = finalNonPadrao[0];
              newStockBySize[onlyKey] = Math.max(0, (newStockBySize[onlyKey] || 0) + simpleDelta);
            }
          }

          // 3. Regra de integridade ERP: nunca manter '_padrao' se houver tamanhos reais
          const finalNonPadrao = Object.keys(newStockBySize).filter((k) => k !== '_padrao');
          if (finalNonPadrao.length > 0 && newStockBySize['_padrao'] !== undefined) {
            delete newStockBySize['_padrao'];
          }

          newTotal = Object.values(newStockBySize).reduce(
            (sum, val) => sum + Math.max(0, Number(val) || 0),
            0
          );
        }

        let updateQuery = adminSupabase
          .from('products')
          .update({
            stock_by_size: newStockBySize,
            total_stock: newTotal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', prod.id);

        if (prod.updated_at) {
          updateQuery = updateQuery.eq('updated_at', prod.updated_at);
        }

        const { data: updatedRows, error: updateErr } = await updateQuery.select('id');

        if (!updateErr && Array.isArray(updatedRows) && updatedRows.length > 0) {
          updatedProducts++;
          break;
        }

        // Fallback se a coluna updated_at não existir ou conflito de concorrência na última tentativa
        if (updateErr && updateErr.message?.includes('updated_at')) {
          const { error: retryErr } = await adminSupabase
            .from('products')
            .update({
              stock_by_size: newStockBySize,
              total_stock: newTotal,
            })
            .eq('id', prod.id);
          if (!retryErr) updatedProducts++;
          break;
        }

        if (attempt === MAX_RETRIES) {
          console.warn(
            `Conflito de concorrência ao atualizar estoque do produto ${prod.id} após ${MAX_RETRIES} tentativas.`
          );
        }
      } catch (err) {
        console.warn(`Erro ao processar estoque do produto ${agg.productId || agg.sku}:`, err);
        break;
      }
    }
  }

  if (updatedProducts > 0) {
    try {
      invalidateCatalogCache();
      revalidatePath('/');
      revalidatePath('/catalogo');
      revalidatePath('/admin');
    } catch (e) {
      console.warn('Aviso ao invalidar cache do catálogo após movimentação de estoque:', e);
    }
  }

  return { updatedProducts };
}

/**
 * Atualiza um pedido e garante baixa/estorno atômico (sem dupla contagem em cliques simultâneos)
 * tanto no Painel Admin quanto no Painel do Revendedor.
 */
export async function updateOrderWithStockSync(
  adminSupabase: any,
  existingOrder: any,
  updates: Record<string, any>,
  requestedStatus?: OrderStatus
): Promise<{
  order: any;
  error: any;
  stockAction: 'deducted' | 'refunded' | 'none';
}> {
  const isCurrentlyDeducted = Boolean(existingOrder.stock_deducted);
  const shouldDeduct = Boolean(
    requestedStatus &&
      STOCK_DEDUCTED_STATUSES.has(requestedStatus) &&
      !isCurrentlyDeducted
  );
  const shouldRefund = Boolean(
    requestedStatus &&
      STOCK_REFUND_STATUSES.has(requestedStatus) &&
      isCurrentlyDeducted
  );

  // 1. Baixa de estoque na aprovação / separação / envio / entrega
  if (shouldDeduct) {
    const { data: claimedOrder, error: claimErr } = await adminSupabase
      .from('orders')
      .update({
        ...updates,
        stock_deducted: true,
      })
      .eq('id', existingOrder.id)
      .eq('stock_deducted', false)
      .select('*')
      .maybeSingle();

    if (claimErr) {
      // Fallback caso coluna stock_deducted ainda não exista no schema
      if (claimErr.message?.includes('stock_deducted')) {
        const { data: fallbackOrder, error: fbErr } = await adminSupabase
          .from('orders')
          .update(updates)
          .eq('id', existingOrder.id)
          .select('*')
          .single();
        if (!fbErr && fallbackOrder) {
          await processOrderStockMovement(adminSupabase, existingOrder.items, true);
        }
        return {
          order: fallbackOrder,
          error: fbErr,
          stockAction: !fbErr ? 'deducted' : 'none',
        };
      }
      return { order: null, error: claimErr, stockAction: 'none' };
    }

    if (claimedOrder) {
      await processOrderStockMovement(adminSupabase, existingOrder.items, true);
      return { order: claimedOrder, error: null, stockAction: 'deducted' };
    }

    // Outra requisição concorrente já marcou stock_deducted=true: aplica apenas updates sem duplicar baixa
    const { data: updatedOrder, error: updErr } = await adminSupabase
      .from('orders')
      .update(updates)
      .eq('id', existingOrder.id)
      .select('*')
      .single();
    return { order: updatedOrder, error: updErr, stockAction: 'none' };
  }

  // 2. Estorno de estoque ao cancelar ou retornar para pendente
  if (shouldRefund) {
    const { data: claimedOrder, error: claimErr } = await adminSupabase
      .from('orders')
      .update({
        ...updates,
        stock_deducted: false,
      })
      .eq('id', existingOrder.id)
      .eq('stock_deducted', true)
      .select('*')
      .maybeSingle();

    if (claimErr) {
      if (claimErr.message?.includes('stock_deducted')) {
        const { data: fallbackOrder, error: fbErr } = await adminSupabase
          .from('orders')
          .update(updates)
          .eq('id', existingOrder.id)
          .select('*')
          .single();
        if (!fbErr && fallbackOrder) {
          await processOrderStockMovement(adminSupabase, existingOrder.items, false);
        }
        return {
          order: fallbackOrder,
          error: fbErr,
          stockAction: !fbErr ? 'refunded' : 'none',
        };
      }
      return { order: null, error: claimErr, stockAction: 'none' };
    }

    if (claimedOrder) {
      await processOrderStockMovement(adminSupabase, existingOrder.items, false);
      return { order: claimedOrder, error: null, stockAction: 'refunded' };
    }

    const { data: updatedOrder, error: updErr } = await adminSupabase
      .from('orders')
      .update(updates)
      .eq('id', existingOrder.id)
      .select('*')
      .single();
    return { order: updatedOrder, error: updErr, stockAction: 'none' };
  }

  // 3. Atualização sem mudança de saldo de estoque (ex: approved -> processing -> shipped)
  const { data: updatedOrder, error: updErr } = await adminSupabase
    .from('orders')
    .update(updates)
    .eq('id', existingOrder.id)
    .select('*')
    .single();

  return { order: updatedOrder, error: updErr, stockAction: 'none' };
}
