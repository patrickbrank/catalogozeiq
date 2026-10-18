'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { RefreshCw, Home, AlertCircle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Router segment error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zeiq-black text-white flex flex-col justify-center items-center px-4 py-12">
      <div className="max-w-md w-full bg-zeiq-dark border border-zeiq-charcoal rounded-3xl p-8 text-center shadow-2xl space-y-6">
        <div className="relative h-8 w-28 mx-auto brightness-0 invert flex items-center justify-center">
          <Image
            src="/images/logo-zeiq.png"
            alt="Zeiq Sports"
            width={112}
            height={32}
            className="h-full w-auto object-contain"
          />
        </div>

        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-white">
            Falha no Carregamento
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Ocorreu uma instabilidade temporária ao carregar este módulo. Tente atualizar a página.
          </p>
          {error?.message && (
            <p className="text-xs font-mono text-rose-300 bg-rose-950/40 p-2.5 rounded-lg border border-rose-900/50 break-words text-left max-h-24 overflow-y-auto">
              {error.message}
            </p>
          )}
        </div>

        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-zeiq-orange hover:bg-zeiq-orange-hover text-zeiq-black rounded-xl text-xs font-black transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Tentar Novamente</span>
          </button>

          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all border border-white/10"
          >
            <Home className="w-4 h-4 text-zeiq-orange" />
            <span>Ir para o Catálogo</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
