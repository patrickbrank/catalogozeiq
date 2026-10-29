'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ExternalLink,
  MessageCircle,
  Mail,
  ShieldCheck,
  ArrowUp,
  Clock,
  Sparkles,
} from 'lucide-react';

function InstagramIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export function PanelFooter() {
  const currentYear = new Date().getFullYear();

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer className="mt-16 border-t border-white/10 bg-black text-slate-400 font-sans relative overflow-hidden">
      {/* Luz ambiente de profundidade no topo */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Coluna 1: Marca & Posicionamento Zeiq B2B */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative h-7 w-28 brightness-0 invert flex items-center">
                <Image
                  src="/images/logo-zeiq.png"
                  alt="Zeiq Sports"
                  width={112}
                  height={28}
                  className="h-full w-auto object-contain object-left"
                />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-zeiq-orange/15 text-zeiq-orange border border-zeiq-orange/30">
                Oficial B2B
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-lg">
              Marca referência em Beach Tennis, vestuário técnico de alta performance e equipamentos esportivos para arenas e lojistas credenciados em todo o território nacional.
            </p>

            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-zeiq-orange shrink-0" />
              <span>Atendimento comercial exclusivo via carteira dedicada do seu revendedor</span>
            </div>
          </div>

          {/* Coluna 2: Card Instagram Oficial @zeiq.bt */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-[#0a0a0a] border border-white/10 p-5 group hover:border-white/20 transition-all shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white shadow-md shrink-0 group-hover:scale-105 transition-transform">
                    <InstagramIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block leading-tight">
                      Instagram Oficial
                    </span>
                    <h4 className="text-sm sm:text-base font-black text-white font-mono tracking-tight">
                      @zeiq.bt
                    </h4>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-300 border border-white/[0.08]">
                  Oficial
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Acompanhe novidades da marca, lançamentos de Beach Tennis e conteúdos oficiais para divulgação da sua loja.
              </p>

              <a
                href="https://www.instagram.com/zeiq.bt"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-200 active:scale-98 text-zeiq-black font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <span>Acessar @zeiq.bt</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

        </div>

        {/* Linha Final de Copyright */}
        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <p className="font-medium text-slate-400">© {currentYear} Zeiq Sports. Todos os direitos reservados.</p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Catálogo de revenda e gestão B2B exclusivo para parceiros credenciados.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              className="text-slate-400 hover:text-white transition-colors text-xs font-semibold"
            >
              Catálogo Público
            </Link>
            <span className="text-slate-700">•</span>
            <Link
              href="/portal"
              className="text-slate-400 hover:text-white transition-colors text-xs font-semibold"
            >
              Meus Pedidos
            </Link>
            <span className="text-slate-700">•</span>
            <button
              type="button"
              onClick={scrollToTop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white text-xs font-bold transition-all border border-white/10 cursor-pointer active:scale-95"
            >
              <span>Subir ao topo</span>
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
}
