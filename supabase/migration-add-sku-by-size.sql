-- ==============================================================================
-- MIGRAÇÃO: ADICIONAR SUPORTE A SKU POR VARIAÇÃO / TAMANHO (CATÁLOGO ZEIQ)
-- Execute este script no SQL Editor do Supabase (projeto catalogo zeiq)
-- ==============================================================================

-- 1. ADICIONA A COLUNA sku_by_size NA TABELA DE PRODUTOS
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS sku_by_size JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. CRIA ÍNDICE GIN PARA BUSCAS RÁPIDAS NO JSONB DE SKUS POR TAMANHO
CREATE INDEX IF NOT EXISTS idx_products_sku_by_size ON public.products USING GIN (sku_by_size);

-- 3. COMENTÁRIO EXPLICATIVO
COMMENT ON COLUMN public.products.sku_by_size IS 'Mapeamento de SKUs por variação/tamanho em formato JSONB, ex: {"33/34": "401.015-3334", "35/36": "401.015-3536", "P": "0214.013-P"}';
