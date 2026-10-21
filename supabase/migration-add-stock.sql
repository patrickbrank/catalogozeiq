-- ==============================================================================
-- MIGRAÇÃO: CONTROLE DE ESTOQUE POR TAMANHO E BAIXA EM PEDIDOS (CATÁLOGO ZEIQ)
-- Execute este script no SQL Editor do seu projeto Supabase (catalogo zeiq)
-- ==============================================================================

-- 1. ADICIONAR COLUNAS DE ESTOQUE NA TABELA DE PRODUTOS
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS stock_by_size JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS total_stock INTEGER NOT NULL DEFAULT 0;

-- 2. ÍNDICE PARA CONSULTAS E FILTROS DE ESTOQUE
CREATE INDEX IF NOT EXISTS idx_products_total_stock ON public.products (total_stock ASC);

-- 3. ADICIONAR COLUNA PARA CONTROLE DE BAIXA DE ESTOQUE NA TABELA DE PEDIDOS
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN NOT NULL DEFAULT false;

-- 4. COMENTÁRIOS EXPLICATIVOS
COMMENT ON COLUMN public.products.stock_by_size IS 'Estoque por tamanho em formato JSONB, ex: {"P": 10, "M": 15, "G": 8} ou {"_padrao": 20}';
COMMENT ON COLUMN public.products.total_stock IS 'Soma total de unidades em estoque do produto';
COMMENT ON COLUMN public.orders.stock_deducted IS 'Indica se a baixa de estoque deste pedido já foi processada';
