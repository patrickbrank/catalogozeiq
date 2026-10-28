import { NextResponse, type NextRequest } from 'next/server';
import { getCatalogData } from '@/lib/data/products';
import { getAdminClient, verifyAdmin } from '@/lib/supabase/admin-auth';

export const dynamic = 'force-dynamic';

// GET: Retorna catálogo de produtos para administração
export async function GET() {
  try {
    const { products } = await getCatalogData();
    return NextResponse.json({
      success: true,
      products: products || [],
      total: products?.length || 0,
    });
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
    const { isAdmin, role } = await verifyAdmin();
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
      is_published = true,
      is_featured = false,
      display_order = 0,
      tags = [],
      sizes = [],
      highlights = [],
      stock_by_size = null,
      total_stock = null,
      category_ids = [],
      images = [],
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'Nome do produto é obrigatório.' }, { status: 400 });
    }

    const finalSlug = (slug?.trim() || name.trim())
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `produto-${Date.now()}`;

    const insertPayload: any = {
      name: name.trim(),
      slug: finalSlug,
      code_sku: code_sku?.trim() || null,
      ean: ean?.trim() || null,
      description: description?.trim() || null,
      price: price != null && !isNaN(price) ? Number(price) : null,
      original_price: original_price != null && !isNaN(original_price) ? Number(original_price) : null,
      is_published: !!is_published,
      is_featured: !!is_featured,
      display_order: Number(display_order) || 0,
      tags: Array.isArray(tags) ? tags : [],
      sizes: Array.isArray(sizes) ? sizes : [],
      highlights: Array.isArray(highlights) ? highlights : [],
      stock_by_size: stock_by_size || null,
      total_stock: total_stock != null ? Number(total_stock) : null,
    };

    let { data: newProd, error: insertErr } = await adminSupabase
      .from('products')
      .insert(insertPayload)
      .select('*')
      .single();

    // Fallback se colunas de preço ou estoque não existirem ainda
    if (insertErr && (insertErr.message?.includes('price') || insertErr.message?.includes('stock'))) {
      delete insertPayload.stock_by_size;
      delete insertPayload.total_stock;
      delete insertPayload.price;
      delete insertPayload.original_price;

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
    const { isAdmin } = await verifyAdmin();
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
    }

    let { data: updatedProd, error: updateErr } = await adminSupabase
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 400 });
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID do produto é obrigatório.' }, { status: 400 });
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: false, error: 'Serviço de administração Supabase indisponível.' }, { status: 500 });
    }

    // 1. Remove dependências relacionais
    try {
      await adminSupabase.from('product_categories').delete().eq('product_id', id);
      await adminSupabase.from('product_images').delete().eq('product_id', id);
    } catch {}

    // 2. Exclui o produto
    const { error: delErr } = await adminSupabase
      .from('products')
      .delete()
      .eq('id', id);

    if (delErr) {
      return NextResponse.json({ success: false, error: delErr.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Produto excluído com sucesso do catálogo!',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
