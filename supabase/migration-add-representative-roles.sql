-- ==============================================================================
-- MIGRAÇÃO: NOVO CARGO REPRESENTANTE, CARTEIRA DE LOJISTAS E REGRAS DE PERMISSÃO
-- Execute este script no SQL Editor do seu projeto Supabase (catalogo zeiq)
-- ==============================================================================

-- 1. ADICIONA COLUNA representative_id NA TABELA profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS representative_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índice para consultas rápidas de lojistas por representante
CREATE INDEX IF NOT EXISTS idx_profiles_representative_id 
ON public.profiles(representative_id);

-- 2. ADICIONA COLUNA representative_id NA TABELA orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS representative_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índice para consultas rápidas de pedidos por representante
CREATE INDEX IF NOT EXISTS idx_orders_representative_id 
ON public.orders(representative_id);

-- 3. MIGRAÇÃO DE CONTAS EXISTENTES COM CARGO 'marketing' (se houver) PARA 'admin' OU 'stock'
UPDATE public.profiles
SET role = 'admin'
WHERE role = 'marketing';

-- 4. FUNÇÕES DE SUPORTE A PERMISSÕES NO BANCO DE DADOS
CREATE OR REPLACE FUNCTION public.is_admin_or_master()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'master')
    ) OR (SELECT auth.jwt()->>'email') IN ('marketing@zeiq.com.br', 'patrickbrank@outlook.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_representative()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = (SELECT auth.uid()) AND role = 'representative'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 5. POLÍTICAS RLS ATUALIZADAS PARA PROFILES
DROP POLICY IF EXISTS "Administradores podem gerenciar todos os perfis" ON public.profiles;
CREATE POLICY "Administradores e Masters podem gerenciar todos os perfis"
    ON public.profiles FOR ALL
    USING (public.is_admin_or_master())
    WITH CHECK (public.is_admin_or_master());

DROP POLICY IF EXISTS "Representante pode visualizar lojistas de sua carteira" ON public.profiles;
CREATE POLICY "Representante pode visualizar lojistas de sua carteira"
    ON public.profiles FOR SELECT
    USING (
        representative_id = (SELECT auth.uid()) 
        OR id = (SELECT auth.uid())
    );

DROP POLICY IF EXISTS "Representante pode atualizar status de lojistas de sua carteira" ON public.profiles;
CREATE POLICY "Representante pode atualizar status de lojistas de sua carteira"
    ON public.profiles FOR UPDATE
    USING (representative_id = (SELECT auth.uid()))
    WITH CHECK (representative_id = (SELECT auth.uid()));

-- 6. POLÍTICAS RLS ATUALIZADAS PARA ORDERS
DROP POLICY IF EXISTS "Representante pode ver pedidos de sua carteira" ON public.orders;
CREATE POLICY "Representante pode ver pedidos de sua carteira"
    ON public.orders FOR SELECT
    USING (
        representative_id = (SELECT auth.uid())
        OR user_id IN (SELECT id FROM public.profiles WHERE representative_id = (SELECT auth.uid()))
        OR public.is_admin_or_master()
    );

DROP POLICY IF EXISTS "Representante pode atualizar status de pedidos de sua carteira" ON public.orders;
CREATE POLICY "Representante pode atualizar status de pedidos de sua carteira"
    ON public.orders FOR UPDATE
    USING (
        representative_id = (SELECT auth.uid())
        OR user_id IN (SELECT id FROM public.profiles WHERE representative_id = (SELECT auth.uid()))
        OR public.is_admin_or_master()
    )
    WITH CHECK (
        representative_id = (SELECT auth.uid())
        OR user_id IN (SELECT id FROM public.profiles WHERE representative_id = (SELECT auth.uid()))
        OR public.is_admin_or_master()
    );
