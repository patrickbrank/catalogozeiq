-- ==============================================================================
-- SCHEMA DO BANCO DE DADOS: CATÁLOGO ZEIQ (SUPABASE / POSTGRESQL)
-- ==============================================================================

-- 1. EXTENSÕES ÚTEIS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- 2. TABELA DE CATEGORIAS
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABELA DE PRODUTOS
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_id TEXT UNIQUE, -- ID original do WooCommerce (ex: '290') para migração idempotente
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    code_sku TEXT,
    description TEXT,
    is_published BOOLEAN NOT NULL DEFAULT true,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. TABELA ASSOCIATIVA PRODUTO <-> CATEGORIA (N:N)
CREATE TABLE IF NOT EXISTS public.product_categories (
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, category_id)
);

-- 5. TABELA DE IMAGENS DO PRODUTO
CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    legacy_url TEXT, -- URL de origem da Hostinger para rastreabilidade
    storage_path TEXT NOT NULL, -- Caminho no bucket do Supabase (ex: 'produtos/p-290/foto-1.jpg')
    public_url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_cover BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- ÍNDICES PARA ALTA PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON public.categories (display_order ASC, name ASC);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories (slug);

CREATE INDEX IF NOT EXISTS idx_products_published_order ON public.products (display_order ASC, created_at DESC) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products (slug);
CREATE INDEX IF NOT EXISTS idx_products_legacy_id ON public.products (legacy_id);
CREATE INDEX IF NOT EXISTS idx_products_code_sku ON public.products (code_sku);

CREATE INDEX IF NOT EXISTS idx_product_categories_cat_id ON public.product_categories (category_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_prod_id ON public.product_categories (product_id);

CREATE INDEX IF NOT EXISTS idx_product_images_prod_sort ON public.product_images (product_id, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_product_images_legacy_url ON public.product_images (legacy_url);

-- ==============================================================================
-- TRIGGER PARA ATUALIZAR AUTOMATICAMENTE updated_at
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_products_updated_at ON public.products;
CREATE TRIGGER trigger_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_categories_updated_at ON public.categories;
CREATE TRIGGER trigger_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) - SEGURANÇA MÁXIMA
-- ==============================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- CATEGORIES: Leitura pública, escrita apenas autenticado (admin)
CREATE POLICY "Categorias visíveis publicamente"
    ON public.categories FOR SELECT
    USING (true);

CREATE POLICY "Categorias modificáveis apenas por admin autenticado"
    ON public.categories FOR ALL
    USING ((SELECT auth.uid()) IS NOT NULL)
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- PRODUCTS: Público visualiza apenas publicados; admin visualiza e edita todos
CREATE POLICY "Produtos publicados visíveis publicamente"
    ON public.products FOR SELECT
    USING (is_published = true OR (SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "Produtos modificáveis apenas por admin autenticado"
    ON public.products FOR ALL
    USING ((SELECT auth.uid()) IS NOT NULL)
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- PRODUCT_CATEGORIES: Leitura pública, escrita apenas autenticado
CREATE POLICY "Relação produtos-categorias visível publicamente"
    ON public.product_categories FOR SELECT
    USING (true);

CREATE POLICY "Relação produtos-categorias modificável apenas por admin"
    ON public.product_categories FOR ALL
    USING ((SELECT auth.uid()) IS NOT NULL)
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- PRODUCT_IMAGES: Leitura pública, escrita apenas autenticado
CREATE POLICY "Imagens visíveis publicamente"
    ON public.product_images FOR SELECT
    USING (true);

CREATE POLICY "Imagens modificáveis apenas por admin"
    ON public.product_images FOR ALL
    USING ((SELECT auth.uid()) IS NOT NULL)
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- ==============================================================================
-- POLÍTICAS DO STORAGE (BUCKET 'produtos')
-- ==============================================================================
-- Observação: O bucket 'produtos' já foi criado como público pelo usuário.
-- As regras abaixo garantem leitura pública e upload restrito a usuários logados.

DO $$
BEGIN
    -- Permitir download / visualização pública dos arquivos do bucket produtos
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Imagens de produtos são públicas'
    ) THEN
        CREATE POLICY "Imagens de produtos são públicas"
            ON storage.objects FOR SELECT
            USING (bucket_id = 'produtos');
    END IF;

    -- Permitir upload apenas para administradores autenticados ou scripts via service_role
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Upload restrito para autenticados'
    ) THEN
        CREATE POLICY "Upload restrito para autenticados"
            ON storage.objects FOR INSERT
            WITH CHECK (bucket_id = 'produtos' AND (SELECT auth.uid()) IS NOT NULL);
    END IF;

    -- Permitir exclusão/atualização apenas para administradores autenticados
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Exclusão restrita para autenticados'
    ) THEN
        CREATE POLICY "Exclusão restrita para autenticados"
            ON storage.objects FOR DELETE
            USING (bucket_id = 'produtos' AND (SELECT auth.uid()) IS NOT NULL);
    END IF;
END $$;
