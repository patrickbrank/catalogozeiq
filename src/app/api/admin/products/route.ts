import { NextResponse, type NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCatalogData, invalidateCatalogCache, cleanProductDescription } from '@/lib/data/products';
import { getAdminClient, verifyAdmin } from '@/lib/supabase/admin-auth';
import { parseProductSizes, findStockForSize, normalizeCanonicalSize, buildProductVariants } from '@/lib/utils/sizes';
import { getPromotionsMap, savePromotionsMap, cleanSkuKey, mergePromotionsIntoProducts } from '@/lib/data/promotions';

export const dynamic = 'force-dynamic';

// GET: Retorna catálogo de produtos para administração (em tempo real do banco)
export async function GET() {
  try {
    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      const { products } = await getCatalogData();
      return NextResponse.json(
        {
          success: true,
          products: products || [],
          total: products?.length || 0,
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          },
        }
      );
    }

    // Busca todos os produtos (publicados e rascunhos) com categorias e imagens diretamente do banco
    const { data: dbProducts, error: prodErr } = await adminSupabase
      .from('products')
      .select(`
        *,
        images:product_images(*),
        categories:product_categories(
          category:categories(*)
        )
      `)
      .order('created_at', { ascending: false });

    if (prodErr) {
      // Fallback para getCatalogData se houver erro de query
      const { products } = await getCatalogData();
      return NextResponse.json(
        { success: true, products: products || [], total: products?.length || 0 },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
      );
    }

    const promoMap = await getPromotionsMap();

    const formattedProducts = (dbProducts || []).map((p: any) => {
      const parsedSizes = parseProductSizes(p.description, p.sizes, p.name, p.stock_by_size);
      const sizesList = parsedSizes.sizes || [];
      const promoData = promoMap[p.id] || (p.code_sku ? promoMap[cleanSkuKey(p.code_sku)] : null);
      const promotionalPrice = p.promotional_price ?? promoData?.promotional_price ?? null;
      const promoStartAt = p.promo_start_at ?? promoData?.promo_start_at ?? null;
      const promoEndAt = p.promo_end_at ?? promoData?.promo_end_at ?? null;

      const { variants, hasSizes, options } = buildProductVariants({
        id: p.id,
        name: p.name,
        code_sku: p.code_sku,
        ean: p.ean,
        price: p.price,
        original_price: p.original_price,
        promotional_price: promotionalPrice,
        promo_start_at: promoStartAt,
        promo_end_at: promoEndAt,
        stock_by_size: p.stock_by_size,
        sku_by_size: p.sku_by_size,
        total_stock: p.total_stock,
        sizes: sizesList,
      });

      return {
        ...p,
        sku: p.code_sku || '',
        parent_sku: p.code_sku || '',
        product_sku: p.code_sku || '',
        sku_pai: p.code_sku || '',
        stock_by_size: p.stock_by_size || {},
        sku_by_size: p.sku_by_size || {},
        promotional_price: promotionalPrice,
        promo_start_at: promoStartAt,
        promo_end_at: promoEndAt,
        sizes: sizesList,
        has_sizes: hasSizes,
        has_variants: hasSizes,
        type: hasSizes ? 'variable' : 'simple',
        product_type: hasSizes ? 'variable' : 'simple',
        tipo: hasSizes ? 'com_variacao' : 'simples',
        options,
        variants,
        variations: variants,
        clean_description: parsedSizes.cleanDescription,
        description: cleanProductDescription(p.description),
        images: (p.images || []).sort((a: any, b: any) => {
          if (a.is_cover && !b.is_cover) return -1;
          if (!a.is_cover && b.is_cover) return 1;
          return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        }),
        categories: p.categories?.map((c: any) => c.category).filter(Boolean) || [],
      };
    });

    return NextResponse.json(
      {
        success: true,
        products: formattedProducts,
        total: formattedProducts.length,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao carregar produtos.' },
      { status: 500 }
    );
  }
}

// POST: Cadastro de Novo Produto (Habilitado para Administradores e Equipe)
export async function POST(request: NextRequest) {
  try {
    const { isAdmin, isMaster, role } = await verifyAdmin();
    const canManageCampaigns = isMaster || role === 'admin';
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso restrito: apenas administradores podem cadastrar produtos.' },
        { status: 403 }
      );
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json(
        { success: false, error: 'Serviço de administração Supabase indisponível.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      name,
      slug,
      code_sku,
      ean,
      description,
      price,
      original_price,
      promotional_price,
      promo_start_at,
      promo_end_at,
      is_published = true,
      is_featured = false,
      display_order = 0,
      tags = [],
      stock_by_size = null,
      sku_by_size = null,
      total_stock = null,
      category_ids = [],
      images = [],
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'Nome do produto é obrigatório.' }, { status: 400 });
    }

    let finalSlug = (slug?.trim() || name.trim())
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `produto-${Date.now()}`;

    // Garante que o slug é único no banco
    const { data: existingSlug } = await adminSupabase
      .from('products')
      .select('id')
      .eq('slug', finalSlug)
      .maybeSingle();

    if (existingSlug) {
      finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
    }

    // Calcula total_stock automaticamente a partir de stock_by_size caso não tenha sido explicitado
    let calculatedTotal = total_stock != null && !isNaN(Number(total_stock)) ? Number(total_stock) : null;
    if (stock_by_size && typeof stock_by_size === 'object' && calculatedTotal === null) {
      calculatedTotal = Object.values(stock_by_size as Record<string, any>).reduce(
        (acc: number, val: any) => acc + (Math.max(0, parseInt(String(val), 10) || 0)),
        0
      );
    }

    const insertPayload: any = {
      name: name.trim(),
      slug: finalSlug,
      code_sku: code_sku?.trim() || null,
      ean: ean?.trim() || null,
      description: description?.trim() || null,
      price: price != null && !isNaN(price) ? Number(price) : null,
      original_price: original_price != null && !isNaN(original_price) ? Number(original_price) : null,
      promotional_price: promotional_price != null && !isNaN(promotional_price) && promotional_price > 0 ? Number(promotional_price) : null,
      promo_start_at: promo_start_at || null,
      promo_end_at: promo_end_at || null,
      is_published: !!is_published,
      is_featured: !!is_featured,
      display_order: Number(display_order) || 0,
      tags: Array.isArray(tags) ? tags : [],
      stock_by_size: stock_by_size || null,
      sku_by_size: sku_by_size || null,
      total_stock: calculatedTotal,
    };

    let { data: newProd, error: insertErr } = await adminSupabase
      .from('products')
      .insert(insertPayload)
      .select('*')
      .single();

    // Fallback se colunas opcionais não existirem no schema do banco
    if (insertErr && (insertErr.message?.includes('price') || insertErr.message?.includes('stock') || insertErr.message?.includes('ean') || insertErr.message?.includes('promo') || insertErr.message?.includes('sku_by_size'))) {
      if (insertErr.message?.includes('ean')) delete insertPayload.ean;
      if (insertErr.message?.includes('sku_by_size')) delete insertPayload.sku_by_size;
      if (insertErr.message?.includes('price')) {
        delete insertPayload.price;
        delete insertPayload.original_price;
      }
      if (insertErr.message?.includes('promo')) {
        delete insertPayload.promotional_price;
        delete insertPayload.promo_start_at;
        delete insertPayload.promo_end_at;
      }
      if (insertErr.message?.includes('stock')) {
        delete insertPayload.stock_by_size;
        delete insertPayload.total_stock;
      }

      const retry = await adminSupabase
        .from('products')
        .insert(insertPayload)
        .select('*')
        .single();
      newProd = retry.data;
      insertErr = retry.error;
    }

    if (insertErr || !newProd) {
      return NextResponse.json({ success: false, error: insertErr?.message || 'Falha ao cadastrar produto.' }, { status: 400 });
    }

    const productId = newProd.id;

    // Sincroniza preço promocional no storage de promoções (somente Master e Admin)
    const numPromoPrice = canManageCampaigns && promotional_price != null && !isNaN(promotional_price) && promotional_price > 0 ? Number(promotional_price) : null;
    if (canManageCampaigns && numPromoPrice != null) {
      try {
        const map = await getPromotionsMap();
        map[productId] = {
          promotional_price: numPromoPrice,
          promo_start_at: promo_start_at || null,
          promo_end_at: promo_end_at || null,
          updated_at: new Date().toISOString(),
        };
        if (newProd.code_sku) map[cleanSkuKey(newProd.code_sku)] = map[productId];
        await savePromotionsMap(map);
      } catch (err) {
        console.warn('Erro ao salvar promoção no storage:', err);
      }
    }

    // Vincula categorias
    if (Array.isArray(category_ids) && category_ids.length > 0) {
      try {
        const catInserts = category_ids.map((cId: string) => ({
          product_id: productId,
          category_id: cId,
        }));
        await adminSupabase.from('product_categories').insert(catInserts);
      } catch {}
    }

    // Vincula imagens
    if (Array.isArray(images) && images.length > 0) {
      try {
        const imgInserts = images.map((img: any, idx: number) => ({
          product_id: productId,
          public_url: img.public_url || img.url,
          storage_path: img.storage_path || `produtos/${productId}/foto-${idx + 1}.jpg`,
          sort_order: img.sort_order ?? idx,
          is_cover: !!img.is_cover || idx === 0,
        }));
        await adminSupabase.from('product_images').insert(imgInserts);
      } catch {}
    }

    // Invalida o cache em memória e revalida as páginas do Next.js
    invalidateCatalogCache();
    try {
      revalidatePath('/');
      revalidatePath('/admin');
      revalidatePath('/catalogo');
    } catch {}

    return NextResponse.json({
      success: true,
      product: newProd,
      message: 'Produto cadastrado com sucesso!',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT: Atualização de Produto (Habilitado para Administradores e Equipe)
export async function PUT(request: NextRequest) {
  try {
    const { isAdmin, isMaster, role } = await verifyAdmin();
    const canManageCampaigns = isMaster || role === 'admin';
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso restrito: apenas administradores podem editar produtos.' },
        { status: 403 }
      );
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: false, error: 'Serviço de administração Supabase indisponível.' }, { status: 500 });
    }

    const body = await request.json();
    const { id, category_ids, images, ...fields } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID do produto é obrigatório.' }, { status: 400 });
    }

    // Remove campos virtuais ou relacionamentos que não existem na tabela products
    delete fields.sizes;
    delete fields.highlights;
    delete fields.categories;
    delete fields.images;

    const updatePayload: any = {
      ...fields,
      updated_at: new Date().toISOString(),
    };

    if (fields.price !== undefined) {
      updatePayload.price = fields.price != null && !isNaN(fields.price) ? Number(fields.price) : null;
    }
    if (fields.original_price !== undefined) {
      updatePayload.original_price = fields.original_price != null && !isNaN(fields.original_price) ? Number(fields.original_price) : null;
    }
    if (fields.total_stock !== undefined) {
      updatePayload.total_stock = fields.total_stock != null ? Number(fields.total_stock) : null;
    } else if (fields.stock_by_size && typeof fields.stock_by_size === 'object') {
      updatePayload.total_stock = Object.values(fields.stock_by_size as Record<string, any>).reduce(
        (acc: number, val: any) => acc + (Math.max(0, parseInt(String(val), 10) || 0)),
        0
      );
    }

    let hasPromoField = false;
    let numPromoPrice: number | null = null;
    if (fields.promotional_price !== undefined && canManageCampaigns) {
      hasPromoField = true;
      numPromoPrice = fields.promotional_price != null && !isNaN(fields.promotional_price) && fields.promotional_price > 0 ? Number(fields.promotional_price) : null;
      updatePayload.promotional_price = numPromoPrice;
      updatePayload.promo_start_at = fields.promo_start_at || null;
      updatePayload.promo_end_at = fields.promo_end_at || null;
    } else {
      delete updatePayload.promotional_price;
      delete updatePayload.promo_start_at;
      delete updatePayload.promo_end_at;
    }

    let { data: updatedProd, error: updateErr } = await adminSupabase
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr && (updateErr.message?.includes('promotional_price') || updateErr.message?.includes('promo') || updateErr.message?.includes('sku_by_size'))) {
      if (updateErr.message?.includes('sku_by_size')) {
        delete updatePayload.sku_by_size;
      }
      if (updateErr.message?.includes('promotional_price') || updateErr.message?.includes('promo')) {
        delete updatePayload.promotional_price;
        delete updatePayload.promo_start_at;
        delete updatePayload.promo_end_at;
      }
      const retry = await adminSupabase
        .from('products')
        .update(updatePayload)
        .eq('id', id)
        .select('*')
        .single();
      updatedProd = retry.data;
      updateErr = retry.error;
    }

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 400 });
    }

    // Sincroniza com mapa de promoções do storage (somente Master e Admin)
    if (hasPromoField && canManageCampaigns) {
      try {
        const map = await getPromotionsMap();
        if (numPromoPrice != null) {
          map[id] = {
            promotional_price: numPromoPrice,
            promo_start_at: fields.promo_start_at || null,
            promo_end_at: fields.promo_end_at || null,
            updated_at: new Date().toISOString(),
          };
          if (updatedProd?.code_sku) {
            map[cleanSkuKey(updatedProd.code_sku)] = map[id];
          }
        } else {
          delete map[id];
          if (updatedProd?.code_sku) {
            delete map[cleanSkuKey(updatedProd.code_sku)];
          }
        }
        await savePromotionsMap(map);
      } catch (err) {
        console.warn('Aviso ao sincronizar mapa de promoções:', err);
      }
    }

    // Atualiza categorias se fornecidas
    if (Array.isArray(category_ids)) {
      try {
        await adminSupabase.from('product_categories').delete().eq('product_id', id);
        if (category_ids.length > 0) {
          const catInserts = category_ids.map((cId: string) => ({
            product_id: id,
            category_id: cId,
          }));
          await adminSupabase.from('product_categories').insert(catInserts);
        }
      } catch {}
    }

    // Atualiza imagens se fornecidas
    if (Array.isArray(images)) {
      try {
        await adminSupabase.from('product_images').delete().eq('product_id', id);
        if (images.length > 0) {
          const imgInserts = images.map((img: any, idx: number) => ({
            product_id: id,
            public_url: img.public_url || img.url,
            storage_path: img.storage_path || `produtos/${id}/foto-${idx + 1}.jpg`,
            sort_order: img.sort_order ?? idx,
            is_cover: !!img.is_cover || idx === 0,
          }));
          await adminSupabase.from('product_images').insert(imgInserts);
        }
      } catch {}
    }

    // Invalida o cache em memória e revalida as páginas do Next.js
    invalidateCatalogCache();
    try {
      revalidatePath('/');
      revalidatePath('/admin');
      revalidatePath('/catalogo');
    } catch {}

    return NextResponse.json({
      success: true,
      product: updatedProd,
      message: 'Produto atualizado com sucesso!',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Exclusão Segura de Produto (Habilitado para Administradores)
export async function DELETE(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso restrito: apenas administradores podem excluir produtos.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rawId = searchParams.get('id');

    if (!rawId?.trim()) {
      return NextResponse.json({ success: false, error: 'ID do produto é obrigatório.' }, { status: 400 });
    }

    const id = rawId.trim();

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: false, error: 'Serviço de administração Supabase indisponível.' }, { status: 500 });
    }

    // Identifica o ID real no banco (pode ser UUID direto ou legacy_id)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let targetId = id;

    if (!isUuid) {
      // Se não for UUID, busca o produto correspondente por legacy_id ou slug
      const { data: foundProd } = await adminSupabase
        .from('products')
        .select('id')
        .or(`legacy_id.eq.${id},slug.eq.${id}`)
        .maybeSingle();

      if (foundProd?.id) {
        targetId = foundProd.id;
      }
    }

    // 1. Remove dependências relacionais
    try {
      await adminSupabase.from('product_categories').delete().eq('product_id', targetId);
      await adminSupabase.from('product_images').delete().eq('product_id', targetId);
    } catch {}

    // 2. Exclui o produto
    let { data: deletedRows, error: delErr } = await adminSupabase
      .from('products')
      .delete()
      .eq('id', targetId)
      .select('id');

    // Se não encontrou por ID primário e não era UUID, tenta exclusão por legacy_id
    if ((!deletedRows || deletedRows.length === 0) && !delErr && !isUuid) {
      const { data: fallbackRows, error: fallbackErr } = await adminSupabase
        .from('products')
        .delete()
        .eq('legacy_id', id)
        .select('id');
      if (fallbackRows && fallbackRows.length > 0) {
        deletedRows = fallbackRows;
      }
      if (fallbackErr) delErr = fallbackErr;
    }

    if (delErr) {
      return NextResponse.json({ success: false, error: delErr.message }, { status: 400 });
    }

    // 3. Invalida imediatamente todo o cache em memória e do Next.js
    invalidateCatalogCache();
    try {
      revalidatePath('/');
      revalidatePath('/admin');
      revalidatePath('/catalogo');
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Produto excluído com sucesso do catálogo!',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
