'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, ShoppingBag, X, Package } from 'lucide-react';
import { useQuoteCart } from '@/lib/store/quote-cart';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function Header({ searchQuery, onSearchChange }: HeaderProps) {
  const [mounted, setMounted] = useState(false);
  const items = useQuoteCart((state) => state.items);
  const setIsOpen = useQuoteCart((state) => state.setIsOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  const totalItems = mounted ? items.reduce((acc, item) => acc + item.quantity, 0) : 0;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zeiq-muted">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          
          {/* Logo Oficial Zeiq em Proporção Perfeita */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <div
              className="relative h-8 sm:h-9 w-28 sm:w-36 transition-opacity hover:opacity-85 flex items-center"
              style={{ position: 'relative', width: '130px', height: '36px', maxWidth: '100%' }}
            >
              <Image
                src="/images/logo-zeiq.png"
                alt="Zeiq Sports"
                width={130}
                height={36}
                priority
                className="h-full w-auto object-contain object-left"
                style={{ width: 'auto', height: '100%', maxHeight: '36px', objectFit: 'contain' }}
              />
            </div>
            <div className="hidden lg:flex flex-col border-l border-zeiq-muted pl-3">
              <span className="text-[10px] font-bold tracking-wider text-zeiq-black uppercase">
                Revenda B2B
              </span>
              <span className="text-[9px] font-medium text-slate-500">
                Catálogo Oficial
              </span>
            </div>
          </Link>

          {/* Campo de Busca em Tempo Real (Desktop) */}
          <div className="flex-1 max-w-lg hidden md:block">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Pesquisar por modelo ou SKU..."
                className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm bg-zeiq-light border border-zeiq-muted rounded-lg text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black focus:border-zeiq-black transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-zeiq-black transition-colors"
                  aria-label="Limpar pesquisa"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Ação: Botões de Meus Pedidos e Lista de Pedido */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/portal"
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-lg border border-zeiq-muted hover:border-zeiq-black bg-white hover:bg-slate-50 text-zeiq-black font-semibold text-xs sm:text-sm transition-all shadow-xs"
              title="Acompanhar meus pedidos e cotações"
            >
              <Package className="w-4 h-4 text-slate-700" />
              <span className="hidden sm:inline">Meus Pedidos</span>
            </Link>

            <button
              onClick={() => setIsOpen(true)}
              className="relative inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-zeiq-black hover:bg-zeiq-charcoal text-white font-semibold text-xs sm:text-sm rounded-lg transition-all active:scale-95 shadow-xs shrink-0"
              aria-label="Abrir lista de pedido"
            >
              <ShoppingBag className="w-4 h-4 text-white" />
              <span className="font-semibold hidden sm:inline">Lista de Pedido</span>
              <span className="font-semibold sm:hidden">Lista</span>
              {mounted && totalItems > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold bg-white text-zeiq-black rounded-full">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
