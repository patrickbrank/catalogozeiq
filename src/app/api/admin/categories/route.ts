import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient, verifyAdmin } from '@/lib/supabase/admin-auth';

// GET: Lista todas as categorias com contagem de produtos vinculados
export async function GET(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: false, error: 'Chave não configurada' }, { status: 500 });
    }

    const { data: categories, error } = await adminSupabase
      .from('categories')
      .select('*, products:product_categories(count)')
      .order('display_order', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const formatted = (categories || []).map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      display_order: cat.display_order,
      created_at: cat.created_at,
      product_count: cat.products?.[0]?.count || 0,
    }));

    return NextResponse.json({
      success: true,
      categories: formatted,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Cria nova categoria
export async function POST(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: false, error: 'Chave não configurada' }, { status: 500 });
    }

    const body = await request.json();
    const { name, slug, display_order } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'O nome da categoria é obrigatório.' }, { status: 400 });
    }

    const generatedSlug = (slug || name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const { data, error } = await adminSupabase
      .from('categories')
      .insert({
        name: name.trim(),
        slug: generatedSlug,
        display_order: Number(display_order) || 0,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, category: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT: Atualiza categoria existente
export async function PUT(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: false, error: 'Chave não configurada' }, { status: 500 });
    }

    const body = await request.json();
    const { id, name, slug, display_order } = body;

    if (!id || !name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'ID e Nome da categoria são obrigatórios.' }, { status: 400 });
    }

    const generatedSlug = (slug || name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const { data, error } = await adminSupabase
      .from('categories')
      .update({
        name: name.trim(),
        slug: generatedSlug,
        display_order: Number(display_order) || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, category: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Exclui categoria
export async function DELETE(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: false, error: 'Chave não configurada' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID da categoria é obrigatório.' }, { status: 400 });
    }

    // Remove relação com produtos antes
    await adminSupabase.from('product_categories').delete().eq('category_id', id);

    const { error } = await adminSupabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Categoria excluída com sucesso.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
