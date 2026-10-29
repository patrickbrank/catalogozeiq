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
    <footer className="mt-16 border-t border-white/5 bg-zeiq-dark/80 backdrop-blur-md text-slate-400 font-sans">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          
          {/* Coluna 1: Marca & Posicionamento Zeiq */}
          <div className="lg:col-span-5 space-y-3.5">
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
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-zeiq-orange/10 text-zeiq-orange border border-zeiq-orange/30">
                Oficial B2B
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-md">
              Marca referência em Beach Tennis, vestuário esportivo técnico e equipamentos de alto rendimento. Atendimento dedicado a representantes e lojistas credenciados.
            </p>

            <div className="flex items-center gap-2 pt-1 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-zeiq-orange" />
              <span>Ambiente comercial com isolamento seguro por carteira de revenda</span>
            </div>
          </div>

          {/* Coluna 2: Card Destaque Instagram Oficial (Intuitivo & Interativo) */}
          <div className="lg:col-span-4">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 p-5 group hover:border-zeiq-orange/40 transition-all shadow-xl">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white shadow-lg shrink-0 group-hover:scale-105 transition-transform">
                    <InstagramIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zeiq-orange block">
                      Instagram Oficial
                    </span>
                    <h4 className="text-sm font-extrabold text-white tracking-tight">
                      @zeiqsports
                    </h4>
                  </div>
                </div>

                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500" />
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Acompanhe os lançamentos de novas coleções, atletas patrocinados, torneios e materiais para divulgação da sua loja.
              </p>

              <a
                href="https://www.instagram.com/zeiqsports"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 bg-gradient-to-r from-pink-600 via-rose-600 to-amber-600 hover:opacity-90 active:scale-98 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <span>Seguir no Instagram</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Coluna 3: Suporte & Central Comercial Zeiq */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-2">
              <span className="w-2 h-0.5 bg-zeiq-orange rounded-full inline-block" />
              <span>Suporte da Matriz</span>
            </h4>

            <div className="space-y-2 text-xs">
              <a
                href="https://wa.me/5516991667020"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-slate-300 hover:text-emerald-400 transition-colors p-2 rounded-xl hover:bg-white/5"
              >
                <MessageCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <div>
                  <span className="block text-[10px] text-slate-500">WhatsApp Comercial</span>
                  <span className="font-bold text-white">(16) 9 9166-7020</span>
                </div>
              </a>

              <a
                href="mailto:contato@zeiq.com.br"
                className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/5"
              >
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="block text-[10px] text-slate-500">E-mail Comercial</span>
                  <span className="font-medium text-white truncate max-w-[190px]">contato@zeiq.com.br</span>
                </div>
              </a>
            </div>
          </div>

        </div>

        {/* Linha Final de Copyright */}
        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <p>© {currentYear} Zeiq Sports. Todos os direitos reservados.</p>
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
            <button
              type="button"
              onClick={scrollToTop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zeiq-charcoal hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all border border-white/10 cursor-pointer active:scale-95"
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
