'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Plus, Check, Layers, Flame } from 'lucide-react';
import { Product } from '@/types';
import { useQuoteCart } from '@/lib/store/quote-cart';
import { parseProductSizes, isProductOutOfStock, isSizeOutOfStock } from '@/lib/utils/sizes';
import { getProductEffectivePrice } from '@/lib/utils/pricing';
import { flyToCartAnimation } from '@/lib/utils/cart-animation';

interface ProductCardProps {
  product: Product;
  onOpenDetails: (product: Product) => void;
  forcePromoPreview?: boolean;
}

// Remove prefixo de SKU duplicado no nome (ex: '0214.009 - Camiseta...' -> 'Camiseta...')
function getCleanTitle(name: string): string {
  if (!name) return '';
  const cleaned = name.replace(/^([A-Z0-9\.\-\_]+)\s*[-–—]\s*/i, '');
  return cleaned.trim() || name;
}

export function ProductCard({ product, onOpenDetails, forcePromoPreview }: ProductCardProps) {
  const [isAdded, setIsAdded] = useState(false);
  const addItem = useQuoteCart((state) => state.addItem);

  const images = product.images || [];
  const coverImg = images.find((img) => img.is_cover) || images[0];
  const secondaryImg = images.find((img) => img.id !== coverImg?.id) || images[1];

  const coverUrl = coverImg?.public_url || '/placeholder-product.svg';
  const secondaryUrl = secondaryImg?.public_url;

  const { sizes } = parseProductSizes(product.description, product.sizes, product.name);
  const hasSizes = sizes && sizes.length > 0;
  const displayTitle = getCleanTitle(product.name);

  const isOutOfStock = isProductOutOfStock(product);
  const pricing = getProductEffectivePrice(product, undefined, forcePromoPreview);

  const handleActionClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (hasSizes) {
      // Se tem grade de tamanhos, abre o modal para o lojista escolher as quantidades
      onOpenDetails(product);
    } else {
      if (isOutOfStock) return;
      // Animação GSAP balística do produto voando até a sacola
      flyToCartAnimation({
        startElement: e.currentTarget,
        imageUrl: coverUrl,
        count: 1,
      });

      // Produto sem tamanho: adiciona 1 direto com feedback rápido
      addItem(product, 1);
      setIsAdded(true);
      setTimeout(() => setIsAdded(false), 1500);
    }
  };

  return (
    <div 
      onClick={() => onOpenDetails(product)}
      className="group bg-white rounded-xl border border-slate-200/90 overflow-hidden hover:border-slate-300 hover:shadow-md transition-all duration-300 flex flex-col h-full cursor-pointer select-none"
    >
      {/* Quadro da Foto amplo em proporção vertical 3:4 com foco no topo (preserva cabeça do modelo) */}
      <div className="relative aspect-[3/4] w-full bg-[#f8f9fa] overflow-hidden flex items-center justify-center p-0">
        {/* Foto de Capa (Preenchendo 100% do espaço, ancorada no topo) */}
        <Image
          src={coverUrl}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          loading="lazy"
          className="w-full h-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-105"
        />

        {/* Segunda Foto em camada superior com isolamento (Hover fluido exclusivo para telas com cursor/mouse) */}
        {secondaryUrl && (
          <div className="absolute inset-0 bg-[#f8f9fa] isolate opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10 hidden sm:block">
            <Image
              src={secondaryUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              loading="lazy"
              className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500 ease-out"
            />
          </div>
        )}

        {/* Badge de Esgotado ou Campanha Promocional */}
        {isOutOfStock ? (
          <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bg-rose-600 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-md z-20">
            Esgotado
          </div>
        ) : pricing.isPromoActive ? (
          <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-20 flex items-center rounded-full overflow-hidden bg-black border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.5)] select-none transition-transform group-hover:scale-105 duration-300">
            {/* Gradiente quente de fundo */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#4d1604] via-[#240a02] to-black pointer-events-none" />

            {/* Círculo do Emoji sem borda */}
            <div className="relative z-10 flex items-center justify-center w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-b from-[#5c1d05] to-[#2b0c01] ml-1 shrink-0">
              <span className="text-xs sm:text-sm leading-none drop-shadow-[0_2px_4px_rgba(255,100,0,0.5)]">
                {pricing.campaignEmoji || '🔥'}
              </span>
            </div>

            {/* Texto: Percentual e OFF em Branco com padding compacto */}
            <div className="relative z-10 flex items-baseline gap-1 pl-1 pr-2.5 sm:pr-3 py-1 leading-none font-sans">
              <span className="text-white font-black text-xs sm:text-[13px] tracking-tight">
                {pricing.discountPercentage ? `${pricing.discountPercentage}%` : 'PROMO'}
              </span>
              {pricing.discountPercentage != null && (
                <span className="text-white font-bold text-[10px] sm:text-[11px] tracking-wider uppercase opacity-95">
                  OFF
                </span>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Conteúdo do Card - Estrutura com flex-1 para alinhamento uniforme */}
      <div className="p-3 sm:p-4 flex flex-col flex-1 justify-between gap-2.5">
        <div>
          {/* Linha de Metadados: Categoria e Código SKU Técnico */}
          <div className="flex items-center justify-between gap-1.5 mb-1">
            {product.categories && product.categories.length > 0 ? (
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
                {product.categories[0].name}
              </span>
            ) : (
              <span />
            )}
            {product.code_sku && (
              <span className="text-[11px] font-mono font-bold text-slate-400 shrink-0">
                {product.code_sku}
              </span>
            )}
          </div>

          {/* Nome do Produto com suporte elegante a até 3 linhas e altura mínima travada */}
          <h3 
            className="text-sm font-bold text-zeiq-black leading-snug line-clamp-3 min-h-[3.15rem] sm:min-h-[3.6rem]"
            title={product.name}
          >
            {displayTitle}
          </h3>

          {/* Exibição rápida de grade de tamanhos em micro-badges atléticos de alta precisão */}
          {hasSizes ? (
            <div className="mt-2 flex items-center gap-1 overflow-hidden h-5.5">
              {sizes.slice(0, 5).map((sz) => {
                const outOfStock = isSizeOutOfStock(product, sz);

                if (outOfStock) {
                  return (
                    <span
                      key={sz}
                      title={`Tamanho ${sz} indisponível`}
                      className="h-5 min-w-[22px] px-1.5 rounded-md bg-slate-100/90 border border-slate-200 text-slate-400 font-mono font-medium text-[10px] flex items-center justify-center gap-1 shrink-0 opacity-60 select-none"
                    >
                      <span>{sz}</span>
                      <span className="text-[9px] font-bold text-rose-500 leading-none">✕</span>
                    </span>
                  );
                }

                return (
                  <span
                    key={sz}
                    className="h-5 min-w-[22px] px-1 rounded-md bg-white border border-slate-200 text-slate-800 font-mono font-bold text-[10px] flex items-center justify-center shrink-0 shadow-2xs group-hover:border-slate-300 transition-colors"
                  >
                    {sz}
                  </span>
                );
              })}
              {sizes.length > 5 && (
                <span className="h-5 px-1.5 rounded-md bg-slate-100 border border-slate-200/80 text-slate-500 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                  +{sizes.length - 5}
                </span>
              )}
            </div>
          ) : (
            <div className="mt-2 h-5.5 flex items-center">
              <span className="h-5 px-2 rounded-md bg-slate-50 border border-slate-200/80 text-slate-500 font-mono font-bold text-[10px] inline-flex items-center">
                ÚNICO
              </span>
            </div>
          )}
        </div>

        {/* Rodapé do Card: Layout Comercial Sólido e Equilibrado */}
        <div className="mt-auto pt-2.5 border-t border-slate-100 flex flex-col gap-2">
          {pricing.isPromoActive ? (
            <div className="flex flex-col gap-0.5">
              {/* Linha 1: Varejo Sugerido */}
              <div className="text-[11px] font-mono text-slate-400 select-none h-4 flex items-center truncate">
                {pricing.originalPrice != null ? (
                  <span className="flex items-center gap-1">
                    <span className="font-sans text-slate-400 font-medium">Varejo sugerido:</span>
                    <strong className="font-semibold text-slate-600 tabular-nums">
                      R$ {pricing.originalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </span>
                ) : (
                  <span />
                )}
              </div>

              {/* Linha 2: Preço Promocional Hero + Preço Anterior Riscado */}
              <div className="flex items-baseline gap-2 pt-0.5">
                <span className="text-lg sm:text-xl font-black text-zeiq-black font-mono tracking-tight tabular-nums">
                  R$ {pricing.effectivePrice?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {pricing.regularPrice != null && (
                  <span className="text-xs sm:text-sm font-semibold text-slate-400 font-mono line-through decoration-slate-300 tabular-nums" title="Preço normal de tabela">
                    R$ {pricing.regularPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {/* Linha 1: Varejo Sugerido */}
              <div className="text-[11px] font-mono text-slate-400 select-none h-4 flex items-center truncate">
                {product.original_price != null && product.price != null && product.original_price > product.price ? (
                  <span className="flex items-center gap-1">
                    <span className="font-sans text-slate-400 font-medium">Varejo sugerido:</span>
                    <strong className="font-semibold text-slate-600 tabular-nums">
                      R$ {product.original_price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </span>
                ) : (
                  <div className="h-4" />
                )}
              </div>

              {/* Linha 2: Preço Normal de Revenda */}
              <div className="flex items-baseline gap-2 pt-0.5">
                {product.price != null && product.price > 0 ? (
                  <span className="text-lg sm:text-xl font-black text-zeiq-black font-mono tracking-tight tabular-nums">
                    R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-slate-500">
                    Sob consulta
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Botão de Ação Full Width Confortável e Imponente */}
          <button
            type="button"
            onClick={handleActionClick}
            disabled={isOutOfStock && !hasSizes}
            className={`w-full h-9 rounded-xl text-xs font-bold transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 ${
              isAdded
                ? 'bg-emerald-600 text-white shadow-xs'
                : isOutOfStock && !hasSizes
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : isOutOfStock && hasSizes
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                : 'bg-zeiq-black hover:bg-zinc-800 text-white shadow-xs'
            }`}
          >
            {isAdded ? (
              <>
                <Check className="w-4 h-4" />
                Adicionado
              </>
            ) : isOutOfStock && !hasSizes ? (
              'Esgotado'
            ) : hasSizes ? (
              <>
                <Layers className="w-4 h-4" />
                {isOutOfStock ? 'Ver Grade' : 'Escolher Grade'}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Adicionar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
