-- ==============================================================================
-- MIGRAÇÃO: ADICIONAR CAMPOS DE ENDEREÇO E AVATAR / LOGO NA TABELA PROFILES
-- Execute no SQL Editor do Supabase (projeto catalogo zeiq)
-- ==============================================================================

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS address TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cep TEXT DEFAULT NULL;
