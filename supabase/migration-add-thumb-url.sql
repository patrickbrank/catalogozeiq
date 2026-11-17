-- ==============================================================================
-- MIGRAÇÃO OPCIONAL: MINIATURAS OTIMIZADAS (thumb_url) EM product_images
-- Execute no SQL Editor do Supabase caso deseje persistir thumb_url explícita.
-- (O código e o script de otimização já funcionam mesmo antes de rodar este SQL.)
-- ==============================================================================

ALTER TABLE public.product_images
ADD COLUMN IF NOT EXISTS thumb_url TEXT DEFAULT NULL;
