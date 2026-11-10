-- ==============================================================================
-- MIGRAÇÃO: ADICIONAR PREÇO PROMOCIONAL E AGENDAMENTO DE CAMPANHA (ZEIQ)
-- Execute este script no SQL Editor do Supabase (projeto catalogo zeiq)
-- ==============================================================================

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS promotional_price NUMERIC(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS promo_start_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS promo_end_at TIMESTAMPTZ DEFAULT NULL;

-- Índice para consultas e filtros ordenados por preço promocional
CREATE INDEX IF NOT EXISTS idx_products_promotional_price ON public.products (promotional_price ASC) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_products_promo_dates ON public.products (promo_start_at, promo_end_at) WHERE promotional_price IS NOT NULL;

COMMENT ON COLUMN public.products.promotional_price IS 'Preço de atacado promocional (ex: Black Friday / Campanhas sazonais)';
COMMENT ON COLUMN public.products.promo_start_at IS 'Data/hora de início da vigência do preço promocional';
COMMENT ON COLUMN public.products.promo_end_at IS 'Data/hora de término da vigência do preço promocional';
