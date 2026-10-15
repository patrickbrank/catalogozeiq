'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Mail, Lock, Building2, User, Phone, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

export default function ResellerLoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  
  // Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Cadastro
  const [contactName, setContactName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.push('/portal');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao autenticar. Verifique e-mail e senha.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'reseller',
            contact_name: contactName,
            store_name: storeName,
            phone: phone,
          },
        },
      });

      if (error) throw error;

      if (data?.session) {
        router.push('/portal');
        router.refresh();
      } else {
        setSuccessMsg('Conta criada com sucesso! Você já pode entrar com seu e-mail e senha.');
        setTab('login');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao criar conta de revendedor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        
        {/* Link Voltar */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-zeiq-black mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para o catálogo de produtos
        </Link>

        {/* Logo Zeiq Oficial */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="relative h-8 w-28 flex items-center"
            style={{ position: 'relative', width: '112px', height: '32px', maxWidth: '100%' }}
          >
            <Image
              src="/images/logo-zeiq.png"
              alt="Zeiq Sports"
              width={112}
              height={32}
              priority
              className="h-full w-auto object-contain object-left"
              style={{ width: 'auto', height: '100%', maxHeight: '32px', objectFit: 'contain' }}
            />
          </div>
          <div className="border-l border-slate-300 pl-3">
            <h1 className="text-sm font-bold text-zeiq-black">Portal do Revendedor</h1>
            <p className="text-[11px] text-slate-500">Acompanhamento de Pedidos B2B</p>
          </div>
        </div>

        {/* Card de Autenticação */}
        <div className="bg-white py-8 px-6 sm:px-8 rounded-xl border border-slate-200 shadow-sm">
          
          {/* Alternância de Abas */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              type="button"
              onClick={() => { setTab('login'); setErrorMsg(''); }}
              className={`flex-1 pb-3 text-xs font-bold border-b-2 transition-all ${
                tab === 'login'
                  ? 'border-zeiq-black text-zeiq-black'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              Entrar na Conta
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setErrorMsg(''); }}
              className={`flex-1 pb-3 text-xs font-bold border-b-2 transition-all ${
                tab === 'register'
                  ? 'border-zeiq-black text-zeiq-black'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              Criar Cadastro Lojista
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 mb-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
              {successMsg}
            </div>
          )}

          {tab === 'login' ? (
            /* Formulário de Login */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  E-mail cadastrado
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@loja.com.br"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-[#f8f9fa] border border-slate-200 rounded-lg text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-[#f8f9fa] border border-slate-200 rounded-lg text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Acessar Meus Pedidos'
                )}
              </button>
            </form>
          ) : (
            /* Formulário de Cadastro de Revendedor */
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome do Responsável *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Nome completo"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-[#f8f9fa] border border-slate-200 rounded-lg text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome da Loja, Arena ou Clube *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Ex: Arena Beach Point"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-[#f8f9fa] border border-slate-200 rounded-lg text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  WhatsApp com DDD *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="16 99999-9999"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-[#f8f9fa] border border-slate-200 rounded-lg text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  E-mail para faturamento e login *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contato@arena.com.br"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-[#f8f9fa] border border-slate-200 rounded-lg text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Crie sua senha de acesso *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-[#f8f9fa] border border-slate-200 rounded-lg text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Criando conta...
                  </>
                ) : (
                  'Concluir Cadastro de Revendedor'
                )}
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
