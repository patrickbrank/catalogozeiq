-- ==============================================================================
-- MIGRAÇÃO: SISTEMA DE VÍNCULO CLIENTE -> REVENDEDOR & PAINEL DO REVENDEDOR
-- Execute este script no SQL Editor do seu projeto Supabase (catalogo zeiq)
-- 100% Autocontido e Idempotente (pode rodar múltiplas vezes com segurança)
-- ==============================================================================

-- 1. FUNÇÃO DE SUPORTE A ADMIN E MASTER (Definida no início para evitar erros de dependência)
CREATE OR REPLACE FUNCTION public.is_admin_or_master()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = (SELECT auth.uid()) AND role IN ('admin', 'master')
    ) OR (SELECT auth.jwt()->>'email') IN ('marketing@zeiq.com.br', 'patrickbrank@outlook.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. CRIAR TABELA DE REVENDEDORES (RESELLERS)
CREATE TABLE IF NOT EXISTS public.resellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    whatsapp TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
    notification_preference TEXT NOT NULL DEFAULT 'both' CHECK (notification_preference IN ('whatsapp_only', 'email_only', 'both')),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_resellers_status ON public.resellers(status);
CREATE INDEX IF NOT EXISTS idx_resellers_email ON public.resellers(email);
CREATE INDEX IF NOT EXISTS idx_resellers_user_id ON public.resellers(user_id);

-- Trigger para updated_at da tabela resellers
CREATE OR REPLACE FUNCTION public.handle_resellers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_resellers_updated_at ON public.resellers;
CREATE TRIGGER trigger_resellers_updated_at
    BEFORE UPDATE ON public.resellers
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_resellers_updated_at();

-- 3. ADICIONAR COLUNA reseller_id NA TABELA PROFILES (Anulável para não afetar clientes legados)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_reseller_id 
ON public.profiles(reseller_id);

-- 4. ADICIONAR COLUNAS NA TABELA ORDERS (Anuláveis para manter pedidos existentes intactos)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reseller_name TEXT,
ADD COLUMN IF NOT EXISTS reseller_whatsapp TEXT,
ADD COLUMN IF NOT EXISTS reseller_email TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_notified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_notified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS whatsapp_share_url TEXT,
ADD COLUMN IF NOT EXISTS notification_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS notification_error TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_reseller_id 
ON public.orders(reseller_id);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id 
ON public.orders(customer_id);

-- Sincronizar customer_id com user_id existente se estiver nulo
UPDATE public.orders
SET customer_id = user_id
WHERE customer_id IS NULL AND user_id IS NOT NULL;

-- 5. FUNÇÕES AUXILIARES DE REVENDEDOR (Otimizadas com subquery para cache em RLS)
CREATE OR REPLACE FUNCTION public.get_current_reseller_id()
RETURNS UUID AS $$
DECLARE
    v_reseller_id UUID;
BEGIN
    SELECT id INTO v_reseller_id
    FROM public.resellers
    WHERE user_id = (SELECT auth.uid()) 
       OR LOWER(email) = LOWER((SELECT auth.jwt()->>'email'))
    LIMIT 1;
    RETURN v_reseller_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_reseller_user()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.resellers
        WHERE (user_id = (SELECT auth.uid()) OR LOWER(email) = LOWER((SELECT auth.jwt()->>'email')))
          AND status = 'ativo'
    ) OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = (SELECT auth.uid()) AND role IN ('reseller', 'ROLE_RESELLER', 'representative')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 6. HABILITAR ROW LEVEL SECURITY (RLS) NA TABELA RESELLERS
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos podem ler revendedores ativos" ON public.resellers;
CREATE POLICY "Todos podem ler revendedores ativos"
    ON public.resellers FOR SELECT
    USING (status = 'ativo' OR public.is_admin_or_master() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Administradores gerenciam revendedores" ON public.resellers;
CREATE POLICY "Administradores gerenciam revendedores"
    ON public.resellers FOR ALL
    USING (public.is_admin_or_master())
    WITH CHECK (public.is_admin_or_master());

-- 7. POLÍTICAS RLS ATUALIZADAS PARA PROFILES (Permissão de Revendedor ver e aprovar seus lojistas)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Revendedor pode visualizar lojistas vinculados" ON public.profiles;
CREATE POLICY "Revendedor pode visualizar lojistas vinculados"
    ON public.profiles FOR SELECT
    USING (
        reseller_id = public.get_current_reseller_id()
        OR representative_id = (SELECT auth.uid())
        OR id = (SELECT auth.uid())
        OR public.is_admin_or_master()
    );

DROP POLICY IF EXISTS "Revendedor pode atualizar status de seus lojistas" ON public.profiles;
CREATE POLICY "Revendedor pode atualizar status de seus lojistas"
    ON public.profiles FOR UPDATE
    USING (
        reseller_id = public.get_current_reseller_id()
        OR representative_id = (SELECT auth.uid())
        OR public.is_admin_or_master()
    )
    WITH CHECK (
        reseller_id = public.get_current_reseller_id()
        OR representative_id = (SELECT auth.uid())
        OR public.is_admin_or_master()
    );

-- 8. POLÍTICAS RLS ATUALIZADAS PARA ORDERS (Permissão de Revendedor ver e atualizar seus pedidos)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Revendedor pode visualizar pedidos de seus clientes" ON public.orders;
CREATE POLICY "Revendedor pode visualizar pedidos de seus clientes"
    ON public.orders FOR SELECT
    USING (
        reseller_id = public.get_current_reseller_id()
        OR representative_id = (SELECT auth.uid())
        OR customer_id = (SELECT auth.uid())
        OR user_id = (SELECT auth.uid())
        OR public.is_admin_or_master()
    );

DROP POLICY IF EXISTS "Revendedor pode atualizar status de seus pedidos" ON public.orders;
CREATE POLICY "Revendedor pode atualizar status de seus pedidos"
    ON public.orders FOR UPDATE
    USING (
        reseller_id = public.get_current_reseller_id()
        OR representative_id = (SELECT auth.uid())
        OR public.is_admin_or_master()
    )
    WITH CHECK (
        reseller_id = public.get_current_reseller_id()
        OR representative_id = (SELECT auth.uid())
        OR public.is_admin_or_master()
    );

-- 9. MIGRAÇÃO DE DADOS LEGADOS: Converte representantes de profiles para resellers e atualiza vínculos
DO $$
DECLARE
    r RECORD;
    new_reseller_id UUID;
BEGIN
    -- Verifica se existem representantes comerciais criados previamente na tabela profiles
    FOR r IN (
        SELECT id, contact_name, store_name, phone, email
        FROM public.profiles
        WHERE role = 'representative'
    ) LOOP
        -- Verifica se já existe na nova tabela resellers
        SELECT id INTO new_reseller_id FROM public.resellers WHERE email = r.email LIMIT 1;
        
        IF new_reseller_id IS NULL THEN
            INSERT INTO public.resellers (
                name,
                email,
                phone,
                whatsapp,
                status,
                notification_preference,
                user_id
            ) VALUES (
                COALESCE(r.contact_name, r.store_name, r.email),
                r.email,
                r.phone,
                COALESCE(regexp_replace(r.phone, '\D', '', 'g'), '62999999999'),
                'ativo',
                'both',
                r.id
            ) RETURNING id INTO new_reseller_id;
        END IF;

        -- Vincula lojistas que tinham representative_id para o novo reseller_id
        UPDATE public.profiles
        SET reseller_id = new_reseller_id
        WHERE representative_id = r.id AND reseller_id IS NULL;

        -- Vincula pedidos que tinham representative_id para o novo reseller_id
        UPDATE public.orders
        SET reseller_id = new_reseller_id,
            reseller_name = COALESCE(r.contact_name, r.store_name, r.email)
        WHERE representative_id = r.id AND reseller_id IS NULL;
    END LOOP;
END $$;
