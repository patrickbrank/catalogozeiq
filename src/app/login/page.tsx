'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Mail, Lock, Loader2, AlertCircle, MessageCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function B2BLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

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

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(
        err.message?.includes('Invalid login credentials')
          ? 'E-mail ou senha incorretos. Verifique suas credenciais.'
          : err.message || 'Falha ao autenticar. Tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5516991667020';
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    'Olá equipe Zeiq! Gostaria de credenciar minha loja/arena para ter acesso ao catálogo de revenda B2B.'
  )}`;

  return (
    <div className="min-h-screen bg-zeiq-black text-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-zeiq-orange selection:text-zeiq-black">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        
        {/* Marca Zeiq com Logo Oficial */}
        <div className="flex flex-col items-center text-center mb-8">
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
          <span className="text-xs font-black uppercase tracking-widest text-zeiq-orange bg-zeiq-orange/10 border border-zeiq-orange/30 px-3 py-1 rounded-full">
            Catálogo Exclusivo B2B
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-3 tracking-tight">
            Acesso para Lojistas & Arenas
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
            Área de atacado restrita a parceiros credenciados. Informe suas credenciais cadastradas pelo administrador.
          </p>
        </div>

        {/* Card de Formulário */}
        <div className="bg-zeiq-dark py-8 px-6 sm:px-8 rounded-3xl border border-zeiq-charcoal shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                E-mail Cadastrado
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@loja.com.br"
                  className="w-full pl-10 pr-4 py-2.5 bg-zeiq-charcoal border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-zeiq-orange focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-zeiq-charcoal border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-zeiq-orange focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-zeiq-orange hover:bg-zeiq-orange-hover text-zeiq-black rounded-xl text-xs sm:text-sm font-black transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50 mt-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Catálogo</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divisor */}
          <div className="mt-6 pt-6 border-t border-white/10 space-y-4 text-center">
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-left space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <ShieldCheck className="w-4 h-4 text-zeiq-orange" />
                <span>Ainda não possui credencial de lojista?</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                O catálogo é restrito para revenda e atacado. Entre em contato direto com a equipe comercial da Zeiq para obter seu login e senha.
              </p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Solicitar Cadastro no WhatsApp</span>
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
