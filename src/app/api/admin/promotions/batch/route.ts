import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient, verifyAdmin } from '@/lib/supabase/admin-auth';
import { invalidateCatalogCache } from '@/lib/data/products';
import { getPromotionsMap, savePromotionsMap, cleanSkuKey } from '@/lib/data/promotions';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso restrito: apenas administradores podem configurar campanhas promocionais.' },
        { status: 403 }
      );
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: false, error: 'Serviço de administração indisponível.' }, { status: 500 });
    }

    const body = await request.json();
    const { items, promo_start_at = null, promo_end_at = null, campaign_name = 'Campanha Black Friday' } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum item fornecido para a campanha promocional.' }, { status: 400 });
    }

    // Busca todos os produtos do catálogo para cruzamento de SKU
    const { data: allProducts, error: prodErr } = await adminSupabase
      .from('products')
      .select('id, name, code_sku, price');

    if (prodErr || !allProducts) {
      return NextResponse.json({ success: false, error: 'Falha ao consultar produtos do catálogo.' }, { status: 500 });
    }

    // Indexa produtos do catálogo por sku normalizado e por id
    const productBySku = new Map<string, any>();
    const productById = new Map<string, any>();

    allProducts.forEach((p) => {
      productById.set(p.id, p);
      if (p.code_sku) {
        productBySku.set(cleanSkuKey(p.code_sku), p);
      }
      // Indexa também pelo código inicial do nome (ex: "401.021 - Nome...")
      const m = p.name.match(/^([A-Z0-9\.\_\-]+)\s*[-–—]/i);
      if (m) {
        productBySku.set(cleanSkuKey(m[1]), p);
      }
    });

    const promoMap = await getPromotionsMap();
    let updatedCount = 0;
    const matchedProducts: Array<{ id: string; sku: string; name: string; oldPrice: number; promoPrice: number }> = [];

    for (const item of items) {
      const rawSku = (item.sku || item.code_sku || item.codigo || '').toString().trim();
      const rawPrice = item.promotional_price ?? item.preco_promocional ?? item.preco ?? item.price;
      const numPrice = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice || '').replace(/\./g, '').replace(',', '.'));

      if (isNaN(numPrice) || numPrice <= 0) continue;

      let matchedProd = item.id ? productById.get(item.id) : null;
      if (!matchedProd && rawSku) {
        matchedProd = productBySku.get(cleanSkuKey(rawSku));
      }

      if (matchedProd) {
        updatedCount++;
        matchedProducts.push({
          id: matchedProd.id,
          sku: matchedProd.code_sku || rawSku,
          name: matchedProd.name,
          oldPrice: matchedProd.price,
          promoPrice: numPrice,
        });

        // 1. Atualiza no mapa persistente de promoções
        promoMap[matchedProd.id] = {
          promotional_price: numPrice,
          promo_start_at: promo_start_at || null,
          promo_end_at: promo_end_at || null,
          updated_at: new Date().toISOString(),
        };

        if (matchedProd.code_sku) {
          promoMap[cleanSkuKey(matchedProd.code_sku)] = promoMap[matchedProd.id];
        }

        // 2. Tenta atualizar direto nas colunas da tabela products do banco
        try {
          await adminSupabase
            .from('products')
            .update({
              promotional_price: numPrice,
              promo_start_at: promo_start_at || null,
              promo_end_at: promo_end_at || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', matchedProd.id);
        } catch {}
      }
    }

    // Salva mapa consolidado no storage
    await savePromotionsMap(promoMap);

    // Invalida caches
    invalidateCatalogCache();
    try {
      revalidatePath('/');
      revalidatePath('/admin');
      revalidatePath('/catalogo');
    } catch {}

    return NextResponse.json({
      success: true,
      message: `${updatedCount} produtos atualizados com preços promocionais com sucesso!`,
      summary: {
        total_received: items.length,
        updated: updatedCount,
        promo_start_at,
        promo_end_at,
        campaign_name,
      },
      matched_products: matchedProducts,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Encerra / Remove campanha de promoções em lote
export async function DELETE(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Acesso restrito.' }, { status: 403 });
    }

    const adminSupabase = getAdminClient();
    await savePromotionsMap({});

    if (adminSupabase) {
      try {
        await adminSupabase
          .from('products')
          .update({
            promotional_price: null,
            promo_start_at: null,
            promo_end_at: null,
            updated_at: new Date().toISOString(),
          })
          .not('promotional_price', 'is', null);
      } catch {}
    }

    invalidateCatalogCache();
    try {
      revalidatePath('/');
      revalidatePath('/admin');
      revalidatePath('/catalogo');
    } catch {}

    return NextResponse.json({ success: true, message: 'Todas as promoções foram canceladas/limpas com sucesso.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
