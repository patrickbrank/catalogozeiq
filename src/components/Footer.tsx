'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Truck,
  MessageCircle,
  ShieldCheck,
  Layers,
  ArrowUp,
  ExternalLink,
} from 'lucide-react';
import { StoreSettings } from '@/types';

function InstagramIcon({ className = 'w-4 h-4' }: { className?: string }) {
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

interface FooterProps {
  settings?: StoreSettings;
}

export function Footer({ settings: initialSettings }: FooterProps) {
  const currentYear = new Date().getFullYear();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-black text-slate-400 font-sans border-t border-white/10 relative overflow-hidden">
      
      {/* 1. FAIXA SUPERIOR: 4 PILARES B2B COM ACABAMENTO MODERNO */}
      <div className="border-b border-white/[0.08] bg-white/[0.015]">
        <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            
            <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/15 transition-colors group">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">Atacado de Fábrica</h4>
                <p className="text-xs text-slate-400 leading-snug mt-0.5">Tabela comercial e preços diretos da indústria Zeiq.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/15 transition-colors group">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">Envio para Todo o Brasil</h4>
                <p className="text-xs text-slate-400 leading-snug mt-0.5">Despacho ágil com código de rastreamento em tempo real.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/15 transition-colors group">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">Grade Livre</h4>
                <p className="text-xs text-slate-400 leading-snug mt-0.5">Monte os tamanhos conforme a demanda da sua loja.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/15 transition-colors group">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">Atendimento Dedicado</h4>
                <p className="text-xs text-slate-400 leading-snug mt-0.5">Negociação direta com o revendedor oficial da sua região.</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 2. CORPO PRINCIPAL DO FOOTER */}
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* COLUNA 1: MARCA & INSTITUCIONAL (5 Colunas no Desktop) */}
          <div className="lg:col-span-5 space-y-4">
            <Link href="/" className="inline-block transition-opacity hover:opacity-85">
              <div className="relative h-8 w-32 brightness-0 invert flex items-center">
                <Image
                  src="/images/logo-zeiq.png"
                  alt="Zeiq Sports"
                  width={128}
                  height={32}
                  className="h-full w-auto object-contain object-left"
                />
              </div>
            </Link>

            <p className="text-xs text-slate-400 leading-relaxed max-w-md">
              Marca oficial especializada em Beach Tennis, vestuário técnico de alta performance e equipamentos esportivos para lojistas e arenas credenciadas em todo o Brasil.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-bold text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Catálogo B2B 2026
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-bold text-slate-300">
                Venda PJ
              </span>
            </div>

            <div className="pt-2">
              <a
                href="https://www.instagram.com/zeiq.bt"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 text-xs text-slate-300 hover:text-white transition-all group"
              >
                <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white shrink-0">
                  <InstagramIcon className="w-3.5 h-3.5" />
                </div>
                <span>Instagram Oficial: <strong className="text-white font-mono">@zeiq.bt</strong></span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors ml-0.5" />
              </a>
            </div>
          </div>

          {/* COLUNA 2: NAVEGAÇÃO DE LINHAS (4 Colunas no Desktop) */}
          <div className="lg:col-span-4 space-y-3.5">
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-0.5 bg-zeiq-orange rounded-full inline-block" />
              <span>Coleções Zeiq</span>
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              <Link href="/" className="text-slate-400 hover:text-white transition-colors block">
                Catálogo Completo
              </Link>
              <Link href="/?dept=vestuario-masculino" className="text-slate-400 hover:text-white transition-colors block">
                Linha Masculina
              </Link>
              <Link href="/?dept=vestuario-feminino" className="text-slate-400 hover:text-white transition-colors block">
                Linha Feminina
              </Link>
              <Link href="/?dept=equipamentos" className="text-slate-400 hover:text-white transition-colors block">
                Raquetes & Capas
              </Link>
              <Link href="/?dept=acessorios" className="text-slate-400 hover:text-white transition-colors block">
                Bolas & Acessórios
              </Link>
              <Link href="/?dept=lancamentos" className="text-amber-400 hover:text-amber-300 font-semibold transition-colors flex items-center gap-1">
                <span>🔥 Novidades 2026</span>
              </Link>
            </div>
          </div>

          {/* COLUNA 3: ÁREA DO LOJISTA & PEDIDOS (3 Colunas no Desktop) */}
          <div className="lg:col-span-3 space-y-3.5">
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-0.5 bg-sky-400 rounded-full inline-block" />
              <span>Área do Lojista</span>
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/portal" className="text-slate-400 hover:text-white transition-colors block">
                  Meus Pedidos & Cotações
                </Link>
              </li>
              <li>
                <Link href="/portal" className="text-slate-400 hover:text-white transition-colors block">
                  Acompanhamento de Status
                </Link>
              </li>
              <li>
                <Link href="/portal" className="text-slate-400 hover:text-white transition-colors block">
                  Repetir Pedido Anterior
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-slate-400 hover:text-white transition-colors block">
                  Acessar Conta B2B
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* 3. RODAPÉ FINAL COM COPYRIGHT & VOLTAR AO TOPO */}
        <div className="mt-10 pt-6 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="text-center sm:text-left">
            <p>© {currentYear} Zeiq Sports. Todos os direitos reservados.</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Catálogo de revenda e cotações de atacado exclusivo para pessoas jurídicas, lojistas e revendedores autorizados.
            </p>
          </div>

          <div className="flex items-center justify-center sm:justify-end gap-3 sm:gap-4 text-xs flex-wrap sm:flex-nowrap">
            <Link href="/portal" className="text-slate-400 hover:text-white transition-colors whitespace-nowrap">
              Portal do Lojista
            </Link>
            <span className="text-slate-700">•</span>
            <button
              type="button"
              onClick={scrollToTop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/[0.08] active:scale-95 whitespace-nowrap ml-1 sm:ml-2 cursor-pointer"
              aria-label="Voltar ao início da página"
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
