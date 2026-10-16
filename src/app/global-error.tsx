'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global application error:', error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#0a0a0a] text-white flex flex-col justify-center items-center px-4 py-12 font-sans">
        <div className="max-w-md w-full bg-[#141414] border border-[#202020] rounded-3xl p-8 text-center shadow-2xl space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-[#ff9600] bg-[#ff9600]/10 border border-[#ff9600]/20 px-3 py-1 rounded-full inline-block">
              Sistema Zeiq
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white">
              Erro Crítico
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ocorreu um erro inesperado no aplicativo. Clique no botão abaixo para reiniciar a aplicação.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-[#ff9600] hover:bg-[#e68500] text-[#0a0a0a] rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
            >
              Reiniciar Aplicação
            </button>

            <Link
              href="/"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all border border-white/10"
            >
              Voltar ao Início
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
