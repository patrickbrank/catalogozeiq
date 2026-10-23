-- ==============================================================================
-- MIGRAÇÃO: ADICIONAR SUPORTE A CÓDIGO DE BARRAS / EAN (CATÁLOGO ZEIQ)
-- Execute este script no SQL Editor do Supabase (projeto catalogo zeiq)
-- ==============================================================================

-- 1. ADICIONA A COLUNA EAN NA TABELA DE PRODUTOS
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS ean TEXT DEFAULT NULL;

-- 2. CRIA ÍNDICE OTIMIZADO PARA CONSULTAS POR EAN
CREATE INDEX IF NOT EXISTS idx_products_ean ON public.products (ean) WHERE ean IS NOT NULL;

-- 3. COMENTÁRIO EXPLICATIVO
COMMENT ON COLUMN public.products.ean IS 'Código de barras EAN/GTIN do produto para integração com ERP de estoque';
