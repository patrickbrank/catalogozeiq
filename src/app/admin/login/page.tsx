'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Lock, Mail, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        throw new Error('Acesso restrito: Esta conta é de lojista/revendedor e possui acesso exclusivo ao catálogo no site. Por favor, utilize o login principal do site.');
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
    <div className="min-h-screen bg-zeiq-black flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Voltar ao catálogo */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-zeiq-orange" />
          Voltar para o catálogo público
        </Link>

        {/* Marca Zeiq com Logo Oficial */}
        <div className="flex items-center gap-4">
          <div
            className="relative h-8 w-28 brightness-0 invert flex items-center"
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
          <div className="border-l border-white/20 pl-3">
            <h1 className="text-sm font-bold text-white tracking-tight">PAINEL ADMINISTRATIVO</h1>
            <p className="text-xs text-slate-400">Gestão de Catálogo B2B</p>
          </div>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-zeiq-dark py-8 px-6 sm:px-10 rounded-3xl border border-zeiq-charcoal shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-5">
            {errorMsg && (
              <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                E-mail do Administrador
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@zeiq.com.br"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-zeiq-black border border-zeiq-charcoal rounded-xl text-base sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-zeiq-orange/40 focus:border-zeiq-orange"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-zeiq-black border border-zeiq-charcoal rounded-xl text-base sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-zeiq-orange/40 focus:border-zeiq-orange"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-zeiq-orange hover:bg-zeiq-orange-hover text-zeiq-black rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50 active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zeiq-black" />
                  Autenticando...
                </>
              ) : (
                'Entrar no Painel'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-zeiq-charcoal text-center">
            <p className="text-xs text-slate-500 leading-relaxed">
              Área de acesso restrito. Autenticação criptografada com políticas de Row Level Security (RLS) no Supabase.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
