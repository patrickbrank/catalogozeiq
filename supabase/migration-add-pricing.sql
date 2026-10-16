-- ==============================================================================
-- MIGRAÇÃO: ADICIONAR PREÇO AOS PRODUTOS DO CATÁLOGO ZEIQ
-- Execute este script no SQL Editor do Supabase (projeto catalogo zeiq)
-- ==============================================================================

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2) DEFAULT NULL;

-- Índice para consultas e filtros ordenados por preço se necessário
CREATE INDEX IF NOT EXISTS idx_products_price ON public.products (price ASC) WHERE is_published = true;
