'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Lock, Mail, AlertCircle, ArrowLeft, ArrowRight, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('error') === 'unauthorized') {
        setErrorMsg('Acesso restrito. Esta conta não possui privilégios de administrador.');
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      // Valida imediatamente se o usuário possui cargo de administrador
      const verifyRes = await fetch('/api/admin/verify');
      const verifyData = await verifyRes.json();

      if (!verifyData.success || !verifyData.isAdmin) {
        await supabase.auth.signOut();
        throw new Error('Acesso restrito: esta conta é de lojista e possui acesso exclusivo ao catálogo no site.');
      }

      router.push('/admin');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao autenticar. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090b0e] bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(255,150,0,0.12),rgba(255,255,255,0))] flex flex-col justify-center items-center p-4 sm:p-6 text-white relative overflow-hidden">
      {/* Marca d'água de grade atlética sutil */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.025] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="max-w-md w-full relative z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Card Principal com Acabamento Carbon Matte e Borda Sutil */}
        <div className="bg-[#12151b]/95 border border-white/[0.08] rounded-3xl p-7 sm:p-9 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)] backdrop-blur-xl">
          
          {/* Logo Oficial Zeiq com Iluminação */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative h-9 w-32 mb-4 brightness-0 invert flex items-center justify-center">
              <Image
                src="/images/logo-zeiq.png"
                alt="Zeiq Sports"
                width={128}
                height={36}
                priority
                className="h-full w-auto object-contain"
              />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-[11px] font-semibold text-slate-300 tracking-wide uppercase mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-zeiq-orange" />
              <span>Gestão Administrativa B2B</span>
            </div>

            <h1 className="text-xl font-black text-white tracking-tight">
              Acesso à Diretoria & Equipe
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
              Ambiente restrito para controle de estoque, aprovação de pedidos e catálogo.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-950/50 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Campo de E-mail */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                E-mail de acesso
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ex: marketing@zeiq.com.br"
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#14171d] border border-white/[0.1] hover:border-white/[0.2] focus:border-zeiq-orange focus:ring-2 focus:ring-zeiq-orange/20 text-sm text-white placeholder:text-slate-500 transition-all outline-none"
                />
              </div>
            </div>

            {/* Campo de Senha com Olhinho Toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-10 pr-11 rounded-xl bg-[#14171d] border border-white/[0.1] hover:border-white/[0.2] focus:border-zeiq-orange focus:ring-2 focus:ring-zeiq-orange/20 text-sm text-white placeholder:text-slate-500 transition-all outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer z-10 p-1"
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botão de Entrar */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-zeiq-orange hover:bg-zeiq-orange-hover text-zeiq-black rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20 active:scale-[0.99] cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zeiq-black" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Painel</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Rodapé Limpo */}
          <div className="mt-6 pt-5 border-t border-white/[0.08] flex items-center justify-between text-xs text-slate-400">
            <Link
              href="/"
              className="hover:text-white transition-colors inline-flex items-center gap-1.5 font-medium group"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-zeiq-orange transition-transform group-hover:-translate-x-0.5" />
              <span>Voltar ao catálogo</span>
            </Link>

            <span className="text-[11px] font-mono text-slate-500">
              Zeiq Sports
            </span>
          </div>

        </div>

        {/* Nota de Segurança Inferior */}
        <p className="text-center text-[11px] text-slate-500 mt-4 leading-relaxed">
          Área restrita à equipe Zeiq. Acesso monitorado com proteção criptográfica de dados.
        </p>
      </div>
    </div>
  );
}
