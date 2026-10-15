import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Package, Truck, MessageCircle, Mail, Clock, ShieldCheck, ArrowRight, Layers } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const whatsappPhone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5516991667020';
  const cleanPhone = whatsappPhone.replace(/\D/g, '');
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contato@zeiq.com.br';

  return (
    <footer className="bg-zeiq-black text-slate-400 text-xs py-12 border-t border-zeiq-charcoal font-sans">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-10">
        
        {/* Grid de 4 Colunas Enriquecido */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10 mb-10">
          
          {/* Coluna 1: Marca Zeiq com Logo e Posicionamento B2B */}
          <div className="space-y-4">
            <div
              className="relative h-8 w-28 brightness-0 invert flex items-center"
              style={{ position: 'relative', width: '112px', height: '32px', maxWidth: '100%' }}
            >
              <Image
                src="/images/logo-zeiq.png"
                alt="Zeiq Sports"
                width={112}
                height={32}
                className="h-full w-auto object-contain object-left"
                style={{ width: 'auto', height: '100%', maxHeight: '32px', objectFit: 'contain' }}
              />
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              Marca especializada em Beach Tennis, vestuário de alta performance e acessórios premium para atletas, lojistas, arenas e distribuidores.
            </p>
            <div className="pt-1 flex flex-col gap-1.5 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Atacado Direto de Fábrica</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Despacho para todo o Brasil</span>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-zeiq-orange shrink-0" />
                <span>Grade Flexível para Arenas & Lojas</span>
              </div>
            </div>
          </div>

          {/* Coluna 2: Navegação do Catálogo */}
          <div>
            <h4 className="text-xs font-bold text-white mb-3.5 uppercase tracking-wider flex items-center gap-2">
              <span>Catálogo & Linhas</span>
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/" className="hover:text-white transition-colors flex items-center justify-between group">
                  <span>Catálogo Completo</span>
                  <ArrowRight className="w-3 h-3 text-slate-600 group-hover:text-white transition-colors" />
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Vestuário Masculino & Bermudas
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Vestuário Feminino, Tops & Saias
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Raquetes & Capas Beach Tennis
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Acessórios, Overgrips & Bolas
                </Link>
              </li>
            </ul>
          </div>

          {/* Coluna 3: Área do Revendedor (Melhoria do bloco NAVEGAÇÃO original) */}
          <div>
            <h4 className="text-xs font-bold text-white mb-3.5 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-zeiq-orange" />
              <span>Área do Revendedor</span>
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/portal" className="text-white hover:text-emerald-400 transition-colors font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  Meus Pedidos & Andamento
                </Link>
              </li>
              <li>
                <Link href="/portal" className="hover:text-white transition-colors">
                  Rastreamento com Código do Pedido
                </Link>
              </li>
              <li>
                <Link href="/portal/login" className="hover:text-white transition-colors">
                  Acessar Conta de Lojista / Login
                </Link>
              </li>
              <li>
                <Link href="/portal/login" className="hover:text-white transition-colors">
                  Criar Cadastro de Revenda B2B
                </Link>
              </li>
              <li>
                <Link href="/portal" className="hover:text-white transition-colors">
                  Repetição de Pedidos em 1 Clique
                </Link>
              </li>
            </ul>
          </div>

          {/* Coluna 4: Atendimento B2B & Suporte Comercial */}
          <div>
            <h4 className="text-xs font-bold text-white mb-3.5 uppercase tracking-wider">
              Atendimento B2B & Cotações
            </h4>
            <p className="text-slate-400 text-xs mb-3 leading-relaxed">
              Dúvidas comerciais, condições de atacado para arenas e negociações de grade:
            </p>
            
            <div className="space-y-2 mb-4">
              <a
                href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent('Olá Zeiq Sports! Gostaria de informações comerciais para revenda.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-zeiq-whatsapp hover:text-white text-slate-200 rounded-lg text-xs font-semibold transition-all border border-white/10"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>WhatsApp Comercial Direto</span>
              </a>

              <div className="flex items-center gap-2 text-slate-300 text-xs">
                <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{contactEmail}</span>
              </div>

              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Segunda a Sexta • 08h às 18h</span>
              </div>
            </div>
          </div>

        </div>

        {/* Linha Inferior com Copyright e Informações */}
        <div className="pt-6 border-t border-zeiq-charcoal flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <p>© {currentYear} Zeiq Sports. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <Link href="/portal" className="hover:text-slate-300 transition-colors">
              Acompanhar Pedido
            </Link>
            <span>•</span>
            <Link href="/portal/login" className="hover:text-slate-300 transition-colors">
              Portal do Revendedor
            </Link>
            <span>•</span>
            <span>Catálogo B2B para lojistas e arenas</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
