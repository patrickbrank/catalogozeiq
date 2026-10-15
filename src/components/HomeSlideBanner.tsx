'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

export interface BannerAction {
  type: 'search' | 'category' | 'department' | 'cart' | 'scroll';
  query?: string;
  departmentId?: string;
  categorySlug?: string;
}

export interface CarouselSlide {
  id: string;
  title: string;
  badge?: string;
  buttonText: string;
  action: BannerAction;
  desktopImage: string;
  mobileImage: string;
}

export const BANNER_SLIDES: CarouselSlide[] = [
  {
    id: 'slide-leo-branco',
    title: 'Black Edition Light • Leo Branco',
    badge: 'Coleção Assinada',
    buttonText: 'Ver Coleção Leo Branco',
    desktopImage: '/images/banners/banner-leo-branco-desktop.png',
    mobileImage: '/images/banners/banner-leo-branco-mobile.png',
    action: {
      type: 'search',
      query: 'Leo Branco',
    },
  },
  {
    id: 'slide-favoritos',
    title: 'Favoritos dos Atletas • Zeiq Sports',
    badge: 'Alta Performance',
    buttonText: 'Explorar Linha Beach Tennis',
    desktopImage: '/images/banners/banner-favoritos-desktop.png',
    mobileImage: '/images/banners/banner-favoritos-mobile.png',
    action: {
      type: 'category',
      departmentId: 'equipamentos',
      categorySlug: 'raquetes',
    },
  },
];

interface HomeSlideBannerProps {
  onBannerAction?: (action: BannerAction) => void;
  onSelectDepartment?: (departmentId: string) => void;
  onSelectCategory?: (slug: string | null) => void;
  onOpenCart?: () => void;
}

export function HomeSlideBanner({
  onBannerAction,
  onSelectDepartment,
  onSelectCategory,
  onOpenCart,
}: HomeSlideBannerProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const totalSlides = BANNER_SLIDES.length;

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  // Autoplay com pausa ao passar o mouse ou interagir
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      nextSlide();
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide]);

  // Gestos de toque (swipe) no mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 40;

    if (diff > minSwipeDistance) {
      nextSlide();
    } else if (diff < -minSwipeDistance) {
      prevSlide();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleCardClick = (slide: CarouselSlide, displayIndex: number) => {
    const realIndex = displayIndex % totalSlides;
    // Se o usuário clicar no cartão que está espiando ao lado, desliza para ele
    if (realIndex !== currentSlide) {
      setCurrentSlide(realIndex);
      return;
    }

    if (onBannerAction) {
      onBannerAction(slide.action);
    } else if (slide.action.type === 'category' && slide.action.categorySlug && onSelectCategory) {
      onSelectCategory(slide.action.categorySlug);
    } else if (slide.action.type === 'department' && slide.action.departmentId && onSelectDepartment) {
      onSelectDepartment(slide.action.departmentId);
    } else if (slide.action.type === 'cart' && onOpenCart) {
      onOpenCart();
    }
  };

  // Cria trilho com repetição do primeiro slide no final para que sempre haja um cartão espiando à direita
  const trackSlides = [
    BANNER_SLIDES[0],
    BANNER_SLIDES[1],
    { ...BANNER_SLIDES[0], id: 'slide-leo-branco-peek' },
  ];

  // Deslocamento do trilho para exibir o cartão ativo e a prévia do próximo à direita
  const stepPercent = isMobile ? 88 : 74;

  return (
    <section
      aria-label="Carrossel de Destaques Zeiq"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full py-3.5 sm:py-6 overflow-hidden select-none"
    >
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-10 relative">
        
        {/* Trilho de Cartões com Prévia Lateral (Stage Carousel) */}
        <div className="overflow-visible">
          <div
            className="flex items-center gap-3 sm:gap-5 transition-transform duration-500 ease-out"
            style={{
              transform: `translateX(-${currentSlide * stepPercent}%)`,
            }}
          >
            {trackSlides.map((slide, index) => {
              const realIndex = index % totalSlides;
              const isActive = realIndex === currentSlide && index < 2;

              return (
                <div
                  key={`${slide.id}-${index}`}
                  onClick={() => handleCardClick(slide, index)}
                  className={`relative shrink-0 rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200/90 shadow-md transition-all duration-300 cursor-pointer group ${
                    isMobile ? 'w-[86%]' : 'w-[72%]'
                  } ${
                    isActive ? 'ring-1 ring-black/5 opacity-100 scale-100' : 'opacity-75 hover:opacity-95 scale-[0.98]'
                  }`}
                  style={{
                    height: isMobile ? '235px' : '390px',
                    maxHeight: isMobile ? '260px' : '430px',
                  }}
                >
                  {/* Banner Gráfico Oficial */}
                  <picture className="w-full h-full block">
                    <source media="(max-width: 640px)" srcSet={slide.mobileImage} />
                    <img
                      src={slide.desktopImage}
                      alt={slide.title}
                      className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-700 ease-out"
                    />
                  </picture>

                  {/* Botão de Chamada Flutuante Discreto e Elegante */}
                  <div className="absolute bottom-3.5 sm:bottom-6 right-3.5 sm:right-7 z-10">
                    <span className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-zeiq-black/85 hover:bg-zeiq-black text-white text-[11px] sm:text-xs font-bold backdrop-blur-md border border-white/15 shadow-lg group-hover:scale-105 transition-all">
                      <span>{slide.buttonText}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-zeiq-orange group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Setas de Navegação Circulares Flutuantes Conforme Referência (Desktop) */}
        <button
          type="button"
          onClick={prevSlide}
          aria-label="Slide anterior"
          className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white text-slate-800 shadow-xl border border-slate-200/90 hover:bg-slate-50 hover:scale-105 active:scale-95 transition-all hidden sm:flex items-center justify-center cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={nextSlide}
          aria-label="Próximo slide"
          className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white text-slate-800 shadow-xl border border-slate-200/90 hover:bg-slate-50 hover:scale-105 active:scale-95 transition-all hidden sm:flex items-center justify-center cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Indicadores de Slide (2 Dots / Pills) na Base */}
        <div className="flex items-center justify-center gap-2 mt-3.5 sm:mt-5">
          {BANNER_SLIDES.map((slide, idx) => {
            const isActive = idx === currentSlide;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                aria-label={`Ir para slide ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  isActive ? 'w-7 bg-zeiq-black' : 'w-2 bg-slate-300 hover:bg-slate-400'
                }`}
              />
            );
          })}
        </div>

      </div>
    </section>
  );
}
