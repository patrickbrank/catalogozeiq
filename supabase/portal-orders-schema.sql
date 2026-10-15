-- ==============================================================================
-- SCHEMA ADICIONAL: PORTAL DO REVENDEDOR E GESTÃO DE PEDIDOS (SUPABASE)
-- Execute este script no SQL Editor do seu projeto Supabase (catalogo zeiq)
-- ==============================================================================

-- 1. SEQUÊNCIA PARA NÚMERO DO PEDIDO (ex: ZEIQ-1001, ZEIQ-1002...)
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1001;

-- 2. TABELA DE PERFIS DE USUÁRIOS (Revendedores e Administradores)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'reseller', -- 'admin' ou 'reseller'
    store_name TEXT,
    contact_name TEXT,
    phone TEXT,
    cnpj_cpf TEXT,
    city TEXT,
    state TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABELA DE PEDIDOS E COTAÇÕES B2B
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE DEFAULT ('ZEIQ-' || nextval('public.order_number_seq')),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    buyer_name TEXT NOT NULL,
    buyer_company TEXT,
    buyer_phone TEXT NOT NULL,
    buyer_email TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'processing', 'shipped', 'delivered', 'cancelled'
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_pieces INTEGER NOT NULL DEFAULT 0,
    tracking_code TEXT,
    tracking_url TEXT,
    commercial_notes TEXT,
    customer_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders (order_number);

-- 5. TRIGGER PARA ATUALIZAR updated_at AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION public.handle_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON public.orders;
CREATE TRIGGER trigger_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_orders_updated_at();

-- 6. FUNÇÃO AUXILIAR SEGURA PARA CHECAR ADMIN (SECURITY DEFINER + CACHE STABLE)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = (SELECT auth.uid()) AND role = 'admin'
    ) OR (SELECT auth.jwt()->>'email') = 'patrickbrank@outlook.com';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 7. TRIGGER PARA CRIAR PERFIL AUTOMÁTICO AO CADASTRAR NOVO USUÁRIO AUTH
-- BLINDAGEM: Nunca aceita 'role: admin' enviado pelo cliente via user_metadata
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        role,
        contact_name,
        store_name,
        phone
    ) VALUES (
        NEW.id,
        NEW.email,
        CASE WHEN LOWER(NEW.email) = 'patrickbrank@outlook.com' THEN 'admin' ELSE 'reseller' END,
        COALESCE(NEW.raw_user_meta_data->>'contact_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'store_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', '')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_new_user_profile ON auth.users;
CREATE TRIGGER trigger_new_user_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_profile();

-- 8. TRIGGER PARA PROTEGER CONTRA AUTO-ESCALAÇÃO DE PRIVILÉGIOS EM PROFILES
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Apenas admin existente pode mudar a coluna role
    IF NEW.role <> OLD.role AND NOT public.is_admin() THEN
        NEW.role = OLD.role;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_protect_profile_role ON public.profiles;
CREATE TRIGGER trigger_protect_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_role();

-- 9. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS PROFILES
CREATE POLICY "Usuário pode visualizar seu próprio perfil"
    ON public.profiles FOR SELECT
    USING ((SELECT auth.uid()) = id OR public.is_admin());

CREATE POLICY "Usuário pode atualizar seu próprio perfil"
    ON public.profiles FOR UPDATE
    USING ((SELECT auth.uid()) = id OR public.is_admin())
    WITH CHECK ((SELECT auth.uid()) = id OR public.is_admin());

CREATE POLICY "Administradores podem gerenciar todos os perfis"
    ON public.profiles FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- POLÍTICAS ORDERS
CREATE POLICY "Revendedor pode ver seus próprios pedidos"
    ON public.orders FOR SELECT
    USING (
        user_id = (SELECT auth.uid())
        OR public.is_admin()
    );

CREATE POLICY "Qualquer cliente pode criar pedido de cotação"
    ON public.orders FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Apenas administradores podem atualizar pedidos"
    ON public.orders FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Apenas administradores podem excluir pedidos"
    ON public.orders FOR DELETE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Apenas administradores podem excluir pedidos"
    ON public.orders FOR DELETE
    USING ((SELECT auth.uid()) IN (SELECT id FROM public.profiles WHERE role = 'admin'));
