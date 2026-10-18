'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Package,
  Truck,
  MessageCircle,
  Mail,
  Clock,
  ShieldCheck,
  ArrowRight,
  Layers,
  ArrowUp,
  Sparkles,
  PhoneCall,
} from 'lucide-react';
import { StoreSettings } from '@/types';

interface FooterProps {
  settings?: StoreSettings;
}

export function Footer({ settings: initialSettings }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const [settings, setSettings] = useState<StoreSettings | null>(initialSettings || null);

  useEffect(() => {
    if (!initialSettings) {
      fetch('/api/settings')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.settings) {
            setSettings(data.settings);
          }
        })
        .catch(() => {});
    }
  }, [initialSettings]);

  const rawPhone = settings?.whatsappNumber || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5516991667020';
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const contactEmail = settings?.contactEmail || process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contato@zeiq.com.br';

  const formatDisplayPhone = (digits: string) => {
    const nums = digits.replace(/\D/g, '');
    if (nums.length === 13 && nums.startsWith('55')) {
      const ddd = nums.slice(2, 4);
      const part1 = nums.slice(4, 9);
      const part2 = nums.slice(9);
      return `(${ddd}) ${part1}-${part2}`;
    }
    if (nums.length === 11) {
      return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
    }
    return rawPhone;
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-zeiq-black text-slate-400 font-sans border-t border-zeiq-charcoal relative overflow-hidden">
      
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
                <p className="text-xs text-slate-400 leading-snug mt-0.5">Monte os tamanhos conforme a demanda da sua arena.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/15 transition-colors group">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight">Cotação Rápida</h4>
                <p className="text-xs text-slate-400 leading-snug mt-0.5">Atendimento comercial consultivo direto no WhatsApp.</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 2. CORPO PRINCIPAL DO FOOTER */}
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
          
          {/* COLUNA 1: MARCA & INSTITUCIONAL (4 Colunas no Desktop) */}
          <div className="lg:col-span-4 space-y-4">
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

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Marca oficial especializada em Beach Tennis, vestuário técnico de alta performance e equipamentos premium para arenas esportivas, lojistas e revendedores autorizados.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-bold text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Catálogo B2B 2026
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-bold text-slate-300">
                Fábrica Oficial
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-bold text-slate-300">
                Venda PJ
              </span>
            </div>
          </div>

          {/* COLUNA 2: NAVEGAÇÃO DE LINHAS (2 Colunas no Desktop) */}
          <div className="lg:col-span-2 space-y-3.5">
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-0.5 bg-zeiq-orange rounded-full inline-block" />
              <span>Coleções Zeiq</span>
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/" className="text-slate-400 hover:text-white transition-colors block">
                  Catálogo Completo
                </Link>
              </li>
              <li>
                <Link href="/?dept=vestuario-masculino" className="text-slate-400 hover:text-white transition-colors block">
                  Linha Masculina
                </Link>
              </li>
              <li>
                <Link href="/?dept=vestuario-feminino" className="text-slate-400 hover:text-white transition-colors block">
                  Linha Feminina
                </Link>
              </li>
              <li>
                <Link href="/?dept=equipamentos" className="text-slate-400 hover:text-white transition-colors block">
                  Raquetes & Capas
                </Link>
              </li>
              <li>
                <Link href="/?dept=acessorios" className="text-slate-400 hover:text-white transition-colors block">
                  Bolas & Acessórios
                </Link>
              </li>
              <li>
                <Link href="/?dept=lancamentos" className="text-amber-400 hover:text-amber-300 font-semibold transition-colors flex items-center gap-1">
                  <span>🔥 Novidades 2026</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* COLUNA 3: ÁREA DO LOJISTA & PEDIDOS (2 Colunas no Desktop) */}
          <div className="lg:col-span-2 space-y-3.5">
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
                  Rastreamento de Envio
                </Link>
              </li>
              <li>
                <Link href="/portal/login" className="text-slate-400 hover:text-white transition-colors block">
                  Login do Revendedor
                </Link>
              </li>
              <li>
                <Link href="/portal/login" className="text-slate-400 hover:text-white transition-colors block">
                  Cadastrar Minha Arena
                </Link>
              </li>
              <li>
                <Link href="/portal" className="text-slate-400 hover:text-white transition-colors block">
                  Repetir Pedido Anterior
                </Link>
              </li>
            </ul>
          </div>

          {/* COLUNA 4: CARD COMERCIAL WHATSAPP & CONTATO (4 Colunas no Desktop) */}
          <div className="lg:col-span-4">
            <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden space-y-4">
              
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Atendimento Comercial</span>
                </div>
                <span className="text-xs font-medium text-slate-400">Atacado B2B</span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Tire dúvidas com nossos consultores de revenda, solicite a tabela de faturamento ou envie sua lista personalizada.
              </p>

              {/* Botão de Destaque WhatsApp com Presença Visual Forte */}
              <a
                href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent('Olá Zeiq Sports! Gostaria de informações comerciais para revenda.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-11 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-emerald-950/50 hover:shadow-emerald-900/40 active:scale-98"
              >
                <MessageCircle className="w-4 h-4 fill-current text-white shrink-0" />
                <span>Conversar no WhatsApp</span>
              </a>

              <div className="space-y-2 pt-1 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <PhoneCall className="w-3.5 h-3.5 text-slate-400" />
                    <span>WhatsApp:</span>
                  </span>
                  <a
                    href={`https://wa.me/${cleanPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono font-semibold text-white hover:text-emerald-400 transition-colors"
                  >
                    {formatDisplayPhone(cleanPhone)}
                  </a>
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>E-mail:</span>
                  </span>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="font-medium text-slate-300 hover:text-white transition-colors truncate max-w-[190px]"
                  >
                    {contactEmail}
                  </a>
                </div>

                <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-white/[0.06]">
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Horário Comercial:</span>
                  </span>
                  <span className="text-xs font-medium text-slate-300">08h às 18h (Seg - Sex)</span>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* 3. RODAPÉ FINAL COM COPYRIGHT & VOLTAR AO TOPO */}
        <div className="mt-10 pt-6 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="text-center sm:text-left">
            <p>© {currentYear} Zeiq Sports. Todos os direitos reservados.</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Catálogo de revenda e cotações de atacado exclusivo para pessoas jurídicas, lojistas e arenas esportivas.
            </p>
          </div>

          <div className="flex items-center justify-center sm:justify-end gap-3 sm:gap-4 text-xs flex-wrap sm:flex-nowrap">
            <Link href="/portal" className="text-slate-400 hover:text-white transition-colors whitespace-nowrap">
              Rastrear Pedido
            </Link>
            <span className="text-slate-600 select-none">•</span>
            <Link href="/portal/login" className="text-slate-400 hover:text-white transition-colors whitespace-nowrap">
              Portal do Revendedor
            </Link>
            <button
              type="button"
              onClick={scrollToTop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/[0.08] active:scale-95 whitespace-nowrap ml-1 sm:ml-2"
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
