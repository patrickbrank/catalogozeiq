'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Briefcase,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

export default function ResellerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

      // Valida se o usuário tem privilégio de revendedor ou administrador
      const res = await fetch('/api/reseller/me');
      const meData = await res.json();

      if (!meData.success || !meData.reseller) {
        // Se for um lojista comum tentando logar no painel de revendedor
        await supabase.auth.signOut();
        throw new Error(
          'Acesso restrito: esta conta não possui permissão de Revendedor Autorizado. Se você é um lojista parceiro, utilize o acesso do Catálogo B2B.'
        );
      }

      // Redireciona com atualização completa de sessão
      window.location.href = '/revendedor';
    } catch (err: any) {
      setErrorMsg(
        err.message?.includes('Invalid login credentials')
          ? 'E-mail ou senha incorretos. Verifique suas credenciais de revendedor.'
          : err.message || 'Falha ao autenticar. Tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zeiq-black text-white flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans selection:bg-zeiq-orange selection:text-zeiq-black">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        
        {/* Marca Zeiq com Logo Oficial */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
          <div className="relative h-10 w-36 brightness-0 invert flex items-center justify-center mb-3">
            <Image
              src="/images/logo-zeiq.png"
              alt="Zeiq Sports"
              width={144}
              height={40}
              priority
              className="h-full w-auto object-contain"
            />
          </div>
          <span className="text-xs font-black uppercase tracking-widest text-zeiq-orange bg-zeiq-orange/10 border border-zeiq-orange/30 px-3 py-1 rounded-full flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5" />
            Painel do Revendedor
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-3 tracking-tight">
            Acesso do Representante Comercial
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
            Área exclusiva para representantes e revendedores autorizados consultarem seus lojistas e pedidos.
          </p>
        </div>

        {/* Card Principal */}
        <div className="bg-zeiq-dark py-7 px-6 sm:px-8 rounded-3xl border border-zeiq-charcoal shadow-2xl">
          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                E-mail do Revendedor
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="revendedor@zeiq.com.br"
                  className="w-full pl-9 pr-3 py-2.5 bg-zeiq-charcoal border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-zeiq-orange transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 bg-zeiq-charcoal border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-zeiq-orange transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-zeiq-orange hover:bg-orange-600 active:scale-98 text-zeiq-black font-extrabold rounded-xl text-xs sm:text-sm transition-all shadow-lg shadow-zeiq-orange/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validando credenciais...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Painel do Revendedor</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/5 flex flex-col gap-2.5 text-center">
            <Link
              href="/login"
              className="text-xs text-slate-400 hover:text-zeiq-orange transition-colors flex items-center justify-center gap-1.5"
            >
              <span>É um lojista parceiro?</span>
              <span className="font-bold underline text-white">Acessar Catálogo B2B</span>
            </Link>

            <Link
              href="/admin/login"
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              Acesso da Diretoria &bull; Painel Master
            </Link>
          </div>
        </div>

        {/* Rodapé de Segurança */}
        <div className="text-center mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-zeiq-orange" />
          <span>Ambiente B2B Seguro com isolamento por carteira comercial</span>
        </div>
      </div>
    </div>
  );
}
