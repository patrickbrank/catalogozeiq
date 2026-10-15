'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Plus, Check, Layers } from 'lucide-react';
import { Product } from '@/types';
import { useQuoteCart } from '@/lib/store/quote-cart';
import { parseProductSizes } from '@/lib/utils/sizes';

interface ProductCardProps {
  product: Product;
  onOpenDetails: (product: Product) => void;
}

// Remove prefixo de SKU duplicado no nome (ex: '0214.009 - Camiseta...' -> 'Camiseta...')
function getCleanTitle(name: string): string {
  if (!name) return '';
  const cleaned = name.replace(/^([A-Z0-9\.\-\_]+)\s*[-–—]\s*/i, '');
  return cleaned.trim() || name;
}

export function ProductCard({ product, onOpenDetails }: ProductCardProps) {
  const [isAdded, setIsAdded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const addItem = useQuoteCart((state) => state.addItem);

  const images = product.images || [];
  const coverImg = images.find((img) => img.is_cover) || images[0];
  const secondaryImg = images.find((img) => img.id !== coverImg?.id) || images[1];

  const coverUrl = coverImg?.public_url || '/placeholder-product.svg';
  const secondaryUrl = secondaryImg?.public_url;

  const { sizes } = parseProductSizes(product.description, product.sizes, product.name);
  const hasSizes = sizes && sizes.length > 0;
  const displayTitle = getCleanTitle(product.name);

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasSizes) {
      // Se tem grade de tamanhos, abre o modal para o lojista escolher as quantidades
      onOpenDetails(product);
    } else {
      // Produto sem tamanho: adiciona 1 direto com feedback rápido
      addItem(product, 1);
      setIsAdded(true);
      setTimeout(() => setIsAdded(false), 1500);
    }
  };

  return (
    <div 
      onClick={() => onOpenDetails(product)}
      onMouseEnter={() => {
        if (!isHovered && secondaryUrl) setIsHovered(true);
      }}
      className="group bg-white rounded-lg border border-slate-200 overflow-hidden hover:border-slate-400 hover:shadow-md transition-all duration-300 flex flex-col h-full cursor-pointer select-none"
    >
      {/* Quadro da Foto amplo, limpo e com imagem em destaque */}
      <div className="relative aspect-square w-full bg-[#f8f9fa] overflow-hidden flex items-center justify-center p-0">
        {/* Foto de Capa (Preenchendo bem o espaço, nítida e otimizada pelo Next.js) */}
        <Image
          src={coverUrl}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          loading="lazy"
          className={`w-full h-full object-contain object-center mix-blend-multiply scale-[1.04] transition-all duration-500 ease-out group-hover:scale-110 ${
            secondaryUrl && isHovered ? 'group-hover:opacity-0' : ''
          }`}
        />

        {/* Segunda Foto carregada exclusivamente sob demanda no hover desktop */}
        {secondaryUrl && isHovered && (
          <Image
            src={secondaryUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            loading="lazy"
            className="absolute inset-0 w-full h-full object-contain object-center mix-blend-multiply opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none scale-[1.04] group-hover:scale-110 transition-transform duration-500 ease-out"
          />
        )}

        {/* Badge de SKU Técnico */}
        {product.code_sku && (
          <div className="absolute top-2 left-2 bg-zeiq-black text-white text-[9px] sm:text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded shadow-xs z-10">
            {product.code_sku}
          </div>
        )}
      </div>

      {/* Conteúdo do Card - Estrutura com flex-1 para alinhamento uniforme */}
      <div className="p-3 sm:p-4 flex flex-col flex-1 justify-between gap-2.5">
        <div>
          {/* Categoria */}
          {product.categories && product.categories.length > 0 && (
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1 truncate">
              {product.categories[0].name}
            </span>
          )}

          {/* Nome do Produto com suporte elegante a até 3 linhas e altura mínima travada */}
          <h3 
            className="text-xs sm:text-sm font-semibold text-zeiq-black leading-snug line-clamp-3 min-h-[3.15rem] sm:min-h-[3.6rem]"
            title={product.name}
          >
            {displayTitle}
          </h3>

          {/* Exibição rápida de tamanhos em linha única ou Tamanho Único com altura fixa */}
          {hasSizes ? (
            <div className="mt-1.5 flex items-center gap-1 overflow-hidden h-5">
              {sizes.slice(0, 4).map((sz) => (
                <span
                  key={sz}
                  className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 shrink-0"
                >
                  {sz}
                </span>
              ))}
              {sizes.length > 4 && (
                <span className="text-[9px] font-bold px-1 py-0.5 text-slate-400 shrink-0">
                  +{sizes.length - 4}
                </span>
              )}
            </div>
          ) : (
            <div className="mt-1.5 h-5 flex items-center">
              <span className="text-[10px] text-slate-400 font-medium">Tamanho único</span>
            </div>
          )}
        </div>

        {/* Rodapé do Card: Preço e Botão travados no fundo na mesma linha horizontal */}
        <div className="mt-auto pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2">
          <span className="text-[10px] sm:text-[11px] font-medium text-slate-500">
            Sob consulta
          </span>

          <button
            type="button"
            onClick={handleActionClick}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-all active:scale-95 shrink-0 whitespace-nowrap ${
              isAdded
                ? 'bg-emerald-600 text-white'
                : 'bg-zeiq-black hover:bg-zeiq-charcoal text-white'
            }`}
          >
            {isAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Adicionado
              </>
            ) : hasSizes ? (
              <>
                <Layers className="w-3.5 h-3.5" />
                Escolher Grade
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
