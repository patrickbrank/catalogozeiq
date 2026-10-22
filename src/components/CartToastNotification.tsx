'use client';

import React, { useEffect, useState, useRef } from 'react';
import gsap from 'gsap';
import { useQuoteCart } from '@/lib/store/quote-cart';
import { Check, ShoppingBag, X, ArrowRight } from 'lucide-react';

export function CartToastNotification() {
  const lastAdded = useQuoteCart((state) => state.lastAdded);
  const clearLastAdded = useQuoteCart((state) => state.clearLastAdded);
  const setIsOpen = useQuoteCart((state) => state.setIsOpen);
  const getTotalItems = useQuoteCart((state) => state.getTotalItems);

  const [visible, setVisible] = useState(false);
  const toastRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (lastAdded) {
      setVisible(true);

      // Animação GSAP de entrada elástica suave
      requestAnimationFrame(() => {
        if (toastRef.current) {
          gsap.killTweensOf(toastRef.current);
          gsap.fromTo(
            toastRef.current,
            { y: 60, opacity: 0, scale: 0.92 },
            { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.4)' }
          );
        }

        // Barra de progresso linear com GSAP
        if (progressRef.current) {
          gsap.killTweensOf(progressRef.current);
          gsap.fromTo(
            progressRef.current,
            { scaleX: 1, transformOrigin: 'left center' },
            { scaleX: 0, duration: 3.6, ease: 'linear' }
          );
        }
      });

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, 3600);
    }
  }, [lastAdded]);

  const handleDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (toastRef.current) {
      gsap.to(toastRef.current, {
        y: 40,
        opacity: 0,
        scale: 0.95,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => {
          setVisible(false);
          clearLastAdded();
        },
      });
    } else {
      setVisible(false);
      clearLastAdded();
    }
  };

  const handleOpenCart = () => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (toastRef.current) {
      gsap.to(toastRef.current, {
        scale: 0.9,
        opacity: 0,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: () => {
          setVisible(false);
          clearLastAdded();
          setIsOpen(true);
        },
      });
    } else {
      setVisible(false);
      clearLastAdded();
      setIsOpen(true);
    }
  };

  if (!visible || !lastAdded) return null;

  const totalCart = getTotalItems();

  return (
    <div
      ref={toastRef}
      role="status"
      aria-live="polite"
      className="fixed bottom-4 sm:bottom-6 left-3 right-3 sm:left-auto sm:right-6 z-50 sm:max-w-md bg-zeiq-black/95 text-white p-3 sm:p-3.5 rounded-2xl shadow-2xl border border-white/10 backdrop-blur-md flex flex-col gap-2 select-none overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Foto em Miniatura ou Ícone */}
          <div className="w-11 h-11 rounded-xl bg-zeiq-charcoal border border-white/10 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
            {lastAdded.coverImage ? (
              <img
                src={lastAdded.coverImage}
                alt=""
                className="w-full h-full object-cover object-top rounded-lg"
              />
            ) : (
              <ShoppingBag className="w-5 h-5 text-zeiq-orange" />
            )}
          </div>

          {/* Informações da Peça / Grade */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </span>
              <span className="text-xs font-bold text-white tracking-tight leading-none">
                Adicionado à Lista
              </span>
              <span className="text-xs font-mono font-bold text-zeiq-orange bg-zeiq-orange/15 px-1.5 py-0.2 rounded leading-none shrink-0">
                +{lastAdded.quantity} {lastAdded.quantity === 1 ? 'peça' : 'peças'}
              </span>
            </div>

            <p className="text-xs text-slate-300 font-medium truncate max-w-[200px] sm:max-w-[240px]">
              {lastAdded.productName}
            </p>

            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Total no pedido: <strong className="text-white font-bold">{totalCart} peças</strong>
            </p>
          </div>
        </div>

        {/* Ações: Ver Lista e Fechar */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleOpenCart}
            className="h-9 px-3 bg-white hover:bg-slate-100 text-zeiq-black font-extrabold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <span>Ver Lista</span>
            <ArrowRight className="w-3.5 h-3.5 text-zeiq-orange" />
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar notificação"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Barra de Progresso GSAP na base do Toast */}
      <div className="w-full h-0.5 bg-white/10 rounded-full overflow-hidden mt-0.5">
        <div
          ref={progressRef}
          className="w-full h-full bg-gradient-to-r from-zeiq-orange to-amber-400"
        />
      </div>
    </div>
  );
}
