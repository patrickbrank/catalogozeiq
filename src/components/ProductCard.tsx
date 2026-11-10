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

        {/* Badge de SKU Técnico */}
        {product.code_sku && (
          <div className="absolute top-2 left-2 bg-zeiq-black text-white text-xs font-mono font-bold px-2 py-0.5 rounded shadow-xs z-20">
            {product.code_sku}
          </div>
        )}

        {/* Badge de Esgotado ou Campanha Promocional */}
        {isOutOfStock ? (
          <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bg-rose-600 text-white text-[10px] sm:text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-md z-20">
            Esgotado
          </div>
        ) : pricing.isPromoActive ? (
          <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black text-white border border-white/20 shadow-[0_4px_14px_rgba(0,0,0,0.22)] px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full z-20 flex items-center gap-1.5 select-none animate-in fade-in">
            <span className="text-sm sm:text-base leading-none drop-shadow-xs">{pricing.campaignEmoji || '🔥'}</span>
            <span className="text-white font-black text-xs sm:text-[13px] tracking-tight">
              {pricing.discountPercentage ? `${pricing.discountPercentage}% OFF` : 'PROMO'}
            </span>
          </div>
        ) : null}
      </div>

      {/* Conteúdo do Card - Estrutura com flex-1 para alinhamento uniforme */}
      <div className="p-3 sm:p-4 flex flex-col flex-1 justify-between gap-2.5">
        <div>
          {/* Categoria */}
          {product.categories && product.categories.length > 0 && (
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1 truncate">
              {product.categories[0].name}
            </span>
          )}

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

        {/* Rodapé do Card: Proposta 1 (2 Níveis de Alta Precisão e Alinhamento) */}
        <div className="mt-auto pt-2.5 border-t border-slate-100 flex flex-col gap-1.5">
          {pricing.isPromoActive ? (
            <>
              {/* Nível 1: Linha de Referência de Margem B2B (Varejo e Revenda de Tabela) */}
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] leading-tight text-slate-400 font-mono h-4 overflow-hidden">
                {pricing.originalPrice != null && (
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider font-sans text-slate-400 select-none">
                      Varejo:
                    </span>
                    <span className="font-medium text-slate-400 tabular-nums">
                      R$ {pricing.originalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </span>
                )}
                {pricing.originalPrice != null && pricing.regularPrice != null && (
                  <span className="text-slate-300 font-sans select-none shrink-0">•</span>
                )}
                {pricing.regularPrice != null && (
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider font-sans text-slate-400 select-none">
                      Revenda:
                    </span>
                    <span className="font-medium text-slate-400 line-through decoration-slate-300 tabular-nums" title="Preço normal de tabela">
                      R$ {pricing.regularPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </span>
                )}
              </div>

              {/* Nível 2: Preço Promocional Hero + Botão de Ação Alinhados */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-baseline gap-1.5 min-w-0 whitespace-nowrap">
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-zeiq-black font-sans shrink-0 select-none">
                    Promo:
                  </span>
                  <span className="text-base sm:text-lg font-black text-zeiq-black font-mono tracking-tight tabular-nums">
                    R$ {pricing.effectivePrice?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleActionClick}
                  disabled={isOutOfStock && !hasSizes}
                  className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0 whitespace-nowrap cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                    isAdded
                      ? 'bg-emerald-600 text-white'
                      : isOutOfStock && !hasSizes
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : isOutOfStock && hasSizes
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                      : 'bg-zeiq-black hover:bg-zinc-800 text-white shadow-xs'
                  }`}
                >
                  {isAdded ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Adicionado
                    </>
                  ) : isOutOfStock && !hasSizes ? (
                    'Esgotado'
                  ) : hasSizes ? (
                    <>
                      <Layers className="w-3.5 h-3.5" />
                      {isOutOfStock ? 'Ver Grade' : 'Escolher Grade'}
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Nível 1: Linha de Referência Varejo Sugerido (se houver) */}
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] leading-tight text-slate-400 font-mono h-4 overflow-hidden">
                {product.original_price != null && product.price != null && product.original_price > product.price && (
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider font-sans text-slate-400 select-none">
                      Varejo:
                    </span>
                    <span className="font-medium text-slate-400 tabular-nums">
                      R$ {product.original_price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </span>
                )}
              </div>

              {/* Nível 2: Preço Normal de Revenda + Botão de Ação */}
              <div className="flex items-center justify-between gap-2">
                {product.price != null && product.price > 0 ? (
                  <div className="flex items-baseline gap-1.5 min-w-0 whitespace-nowrap">
                    <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-zeiq-black font-sans shrink-0 select-none">
                      Revenda:
                    </span>
                    <span className="text-base sm:text-lg font-black text-zeiq-black font-mono tracking-tight tabular-nums">
                      R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-medium text-slate-500">
                    Sob consulta
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleActionClick}
                  disabled={isOutOfStock && !hasSizes}
                  className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0 whitespace-nowrap cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                    isAdded
                      ? 'bg-emerald-600 text-white'
                      : isOutOfStock && !hasSizes
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      : isOutOfStock && hasSizes
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                      : 'bg-zeiq-black hover:bg-zinc-800 text-white shadow-xs'
                  }`}
                >
                  {isAdded ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Adicionado
                    </>
                  ) : isOutOfStock && !hasSizes ? (
                    'Esgotado'
                  ) : hasSizes ? (
                    <>
                      <Layers className="w-3.5 h-3.5" />
                      {isOutOfStock ? 'Ver Grade' : 'Escolher Grade'}
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
