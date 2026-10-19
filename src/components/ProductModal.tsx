'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Check, ShoppingBag, Tag, Layers, SlidersHorizontal } from 'lucide-react';
import { Product } from '@/types';
import { useQuoteCart } from '@/lib/store/quote-cart';
import { parseProductSizes } from '@/lib/utils/sizes';
import { parseProductSpecifications } from '@/lib/utils/specifications';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

export function ProductModal({ product, onClose }: ProductModalProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  
  // Grade de tamanhos com quantidade por tamanho: { 'P': 2, 'M': 4, 'G': 4 }
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>({});
  
  // Quantidade simples para produtos sem grade
  const [simpleQuantity, setSimpleQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const addItem = useQuoteCart((state) => state.addItem);
  const addBundle = useQuoteCart((state) => state.addBundle);

  // Extrai especificações técnicas (Peso, Comprimento, Espessura etc.) e tamanhos de forma inteligente
  const { highlights, cleanDescription: descWithoutSpecs } = product
    ? parseProductSpecifications(product.description, product.highlights)
    : { highlights: [], cleanDescription: '' };

  const { sizes, cleanDescription } = product
    ? parseProductSizes(descWithoutSpecs, product.sizes, product.name)
    : { sizes: [], cleanDescription: '' };

  const hasSizes = sizes && sizes.length > 0;
  const hasHighlights = highlights && highlights.length > 0;

  useEffect(() => {
    setSelectedImageIndex(0);
    setSimpleQuantity(1);
    setNotes('');
    setIsSuccess(false);

    // Inicializa a grade com 0 para cada tamanho
    if (product) {
      const parsedSpecs = parseProductSpecifications(product.description, product.highlights);
      const parsedSizes = parseProductSizes(parsedSpecs.cleanDescription, product.sizes, product.name);
      const initialGrade: Record<string, number> = {};
      parsedSizes.sizes.forEach((sz) => {
        initialGrade[sz] = 0;
      });
      setSizeQuantities(initialGrade);
    }
  }, [product]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (product) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [product, onClose]);

  if (!product) return null;

  const images = product.images && product.images.length > 0
    ? product.images
    : [{ id: 'placeholder', public_url: '/placeholder-product.svg', is_cover: true, storage_path: '', sort_order: 0, product_id: product.id }];

  const currentImage = images[selectedImageIndex] || images[0];

  // Total de peças na grade
  const totalGradePieces = Object.values(sizeQuantities).reduce((acc, q) => acc + (q || 0), 0);

  const handleUpdateSizeQty = (sz: string, delta: number) => {
    setSizeQuantities((prev) => {
      const current = prev[sz] || 0;
      const updated = Math.max(0, current + delta);
      return { ...prev, [sz]: updated };
    });
  };

  const handleSetExactSizeQty = (sz: string, value: string) => {
    const parsed = parseInt(value, 10);
    const qty = isNaN(parsed) ? 0 : Math.max(0, parsed);
    setSizeQuantities((prev) => ({ ...prev, [sz]: qty }));
  };

  const handleClearGrade = () => {
    const cleared: Record<string, number> = {};
    sizes.forEach((sz) => {
      cleared[sz] = 0;
    });
    setSizeQuantities(cleared);
  };

  const handleAddToList = () => {
    if (hasSizes) {
      if (totalGradePieces === 0) return;
      addBundle(product, sizeQuantities, notes);
    } else {
      addItem(product, simpleQuantity, undefined, notes);
    }

    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 850);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-zeiq-black/60 backdrop-blur-xs animate-fade-in">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Caixa do Modal / Bottom Sheet no Mobile */}
      <div className="relative w-full max-w-4xl max-h-[92dvh] sm:max-h-[90vh] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 border-t sm:border border-slate-200 animate-in slide-in-from-bottom-3 sm:slide-in-from-bottom-0 sm:fade-in duration-200">
        
        {/* Barra sutil de arrastar no topo (Mobile) */}
        <div className="pt-2 pb-1 flex justify-center sm:hidden shrink-0">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Botão de Fechar */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-slate-100 sm:bg-white hover:bg-slate-200 sm:hover:bg-slate-100 text-slate-600 hover:text-zeiq-black flex items-center justify-center transition-colors border border-slate-200 shadow-xs cursor-pointer active:scale-95"
          aria-label="Fechar modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Área de Conteúdo Rolável */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 pb-24 sm:pb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            
            {/* Galeria de Fotos Sticky no scroll do desktop */}
            <div className="flex flex-col gap-3 md:sticky md:top-0 self-start">
              {/* Foto Principal com Fundo Integrado e Preenchimento Completo (Foco no Topo) */}
              <div className="aspect-[4/5] w-full rounded-2xl bg-[#f8f9fa] border border-slate-200/80 overflow-hidden relative group">
                <img
                  src={currentImage.public_url}
                  alt={product.name}
                  className="w-full h-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-105"
                />
              </div>

              {/* Miniaturas */}
              {images.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {images.map((img, idx) => (
                    <button
                      key={img.id || idx}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-[#f8f9fa] border-2 transition-all cursor-pointer ${
                        selectedImageIndex === idx
                          ? 'border-zeiq-black shadow-xs'
                          : 'border-transparent opacity-60 hover:opacity-100 hover:border-slate-200'
                      }`}
                    >
                      <img
                        src={img.public_url}
                        alt=""
                        className="w-full h-full object-cover object-top"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Informações e Seletor de Grade */}
            <div className="flex flex-col">
              <div>
                {/* SKU e Categoria */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {product.code_sku && (
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-zeiq-black text-white rounded">
                      SKU: {product.code_sku}
                    </span>
                  )}
                  {product.categories && product.categories.map((c) => (
                    <span key={c.id} className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                      {c.name}
                    </span>
                  ))}
                </div>

                {/* Nome */}
                <h2 className="text-lg sm:text-xl font-bold text-zeiq-black leading-snug mb-3">
                  {product.name}
                </h2>

                {/* Box Comercial Sóbrio com Preço B2B */}
                <div className="p-3 bg-[#f8f9fa] rounded-xl border border-slate-200 mb-4">
                  {product.price != null && product.price > 0 ? (
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg sm:text-xl font-extrabold text-zeiq-black font-mono">
                          R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">/ unidade atacado</span>
                        {product.original_price != null && product.original_price > product.price && (
                          <span className="text-xs line-through text-slate-400 font-mono">
                            R$ {product.original_price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                      {(hasSizes ? totalGradePieces > 0 : simpleQuantity > 0) && (
                        <p className="text-xs font-bold text-emerald-700 mt-1">
                          Subtotal deste item: R$ {((hasSizes ? totalGradePieces : simpleQuantity) * product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs font-semibold text-zeiq-black mb-0.5">
                        Preço sob consulta (Revenda e Atacado)
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Tabela de valores e prazos calculados conforme a quantidade total de peças do pedido.
                      </p>
                    </div>
                  )}
                </div>

                {/* MATRIZ DE GRADE DE ATACADO (Ultra-compacta e elegante) */}
                {hasSizes ? (
                  <div className="mb-3.5 p-2.5 bg-slate-50/80 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200/60">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-zeiq-black">
                        <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>Grade por tamanho:</span>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        {totalGradePieces > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={handleClearGrade}
                              className="text-xs text-slate-400 hover:text-rose-600 transition-colors font-medium hover:underline cursor-pointer"
                            >
                              Zerar
                            </button>
                            <span className="text-xs font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300/60 whitespace-nowrap">
                              {totalGradePieces} {totalGradePieces === 1 ? 'peça' : 'peças'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 gap-2">
                      {sizes.map((sz) => {
                        const qty = sizeQuantities[sz] || 0;
                        return (
                          <div
                            key={sz}
                            className={`h-10 sm:h-9 rounded-xl border-2 transition-all flex items-center justify-between overflow-hidden ${
                              qty > 0
                                ? 'bg-white border-zeiq-black shadow-2xs'
                                : 'bg-white border-slate-200/90 hover:border-slate-300'
                            }`}
                          >
                            <span
                              className={`h-full px-2 sm:px-1.5 flex items-center justify-center text-xs font-extrabold tracking-tight shrink-0 select-none ${
                                qty > 0 ? 'bg-zeiq-black text-white' : 'bg-slate-100 text-slate-700'
                              }`}
                              style={{ minWidth: sz.length > 3 ? '42px' : '32px' }}
                            >
                              {sz}
                            </span>

                            <div className="flex items-center h-full flex-1 justify-end">
                              <button
                                type="button"
                                onClick={() => handleUpdateSizeQty(sz, -1)}
                                disabled={qty === 0}
                                className="w-8 sm:w-7 h-full flex items-center justify-center text-slate-400 hover:text-zeiq-black hover:bg-slate-100 disabled:opacity-20 active:scale-90 transition-all cursor-pointer"
                                aria-label={`Diminuir ${sz}`}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>

                              <input
                                type="number"
                                min="0"
                                value={qty === 0 ? '' : qty}
                                placeholder="0"
                                onChange={(e) => handleSetExactSizeQty(sz, e.target.value)}
                                className="w-8 h-full text-center text-xs font-bold text-zeiq-black bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
                              />

                              <button
                                type="button"
                                onClick={() => handleUpdateSizeQty(sz, 1)}
                                className="w-8 sm:w-7 h-full flex items-center justify-center text-slate-600 hover:text-zeiq-black hover:bg-slate-100 active:scale-90 transition-all cursor-pointer"
                                aria-label={`Aumentar ${sz}`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Produto sem variação de tamanho: Seletor de Quantidade Simples */
                  <div className="mb-4 p-3 bg-slate-50/80 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-zeiq-black">
                      Quantidade desejada:
                    </span>
                    <div className="flex items-center gap-1.5 border border-slate-200 rounded-md bg-white p-0.5">
                      <button
                        type="button"
                        onClick={() => setSimpleQuantity(Math.max(1, simpleQuantity - 1))}
                        className="w-7 h-7 rounded bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 active:scale-95"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-10 text-center text-xs font-bold text-zeiq-black">
                        {simpleQuantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSimpleQuantity(simpleQuantity + 1)}
                        className="w-7 h-7 rounded bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-700 active:scale-95"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Ficha de Especificações Técnicas em Grade Esportiva Minimalista */}
                {hasHighlights && (
                  <div className="mb-4 p-3.5 bg-slate-50/80 rounded-lg border border-slate-200">
                    <div className="text-xs font-bold text-zeiq-black uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                      Especificações do Modelo:
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                      {highlights.map((item, idx) => (
                        <div key={idx} className="bg-white p-2 rounded-md border border-slate-200/80">
                          <span className="text-xs uppercase font-bold text-slate-400 block tracking-wider">
                            {item.label}
                          </span>
                          <span className="text-xs font-semibold text-zeiq-black block mt-0.5">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Descrição limpa SEM barra de rolagem cinza */}
                {cleanDescription && (
                  <div className="mb-4">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                      Detalhes do Produto
                    </h3>
                    <div className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                      {cleanDescription}
                    </div>
                  </div>
                )}

                {/* Tags se houver */}
                {product.tags && product.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-4">
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    {product.tags.map((tag, i) => (
                      <span key={i} className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Controles e Observações */}
              <div className="pt-3 border-t border-slate-200">
                <div className="mb-1">
                  <label className="block text-xs font-semibold text-zeiq-black mb-1">
                    Observações adicionais (opcional):
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: cores específicas, prazo de entrega..."
                    className="w-full px-3 py-2 text-base sm:text-xs bg-[#f8f9fa] border border-slate-200 rounded-md text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black focus:border-zeiq-black"
                  />
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Rodapé Fixo Persistente (Sempre Visível ao Rolar) */}
        <div className="p-3.5 sm:p-4 pb-safe bg-white/95 backdrop-blur-md border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 z-20 shadow-md">
          <div className="hidden sm:flex flex-col">
            <span className="text-xs font-bold text-zeiq-black">
              {hasSizes
                ? totalGradePieces > 0
                  ? `${totalGradePieces} ${totalGradePieces === 1 ? 'peça selecionada' : 'peças selecionadas'}`
                  : 'Nenhuma peça selecionada'
                : `${simpleQuantity} ${simpleQuantity === 1 ? 'peça selecionada' : 'peças selecionadas'}`}
            </span>
            <span className="text-xs text-slate-500">
              {hasSizes && totalGradePieces === 0
                ? 'Escolha as quantidades na grade'
                : 'Cotação direta de atacado Zeiq'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleAddToList}
            disabled={hasSizes && totalGradePieces === 0}
            className={`w-full sm:w-auto sm:min-w-[280px] h-11 px-6 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm ${
              isSuccess
                ? 'bg-emerald-600 text-white'
                : hasSizes && totalGradePieces === 0
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-zeiq-black hover:bg-zeiq-charcoal text-white cursor-pointer'
            }`}
          >
            {isSuccess ? (
              <>
                <Check className="w-4 h-4" />
                Adicionado à Lista!
              </>
            ) : hasSizes && totalGradePieces === 0 ? (
              'Selecione as quantidades na grade'
            ) : (
              <>
                <ShoppingBag className="w-4 h-4 text-zeiq-orange" />
                {hasSizes
                  ? `Adicionar Grade à Lista (${totalGradePieces} peças)`
                  : `Adicionar à Lista de Pedido (${simpleQuantity} un.)`}
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
