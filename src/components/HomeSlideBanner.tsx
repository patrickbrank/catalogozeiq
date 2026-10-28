'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BannerItem } from '@/types';

export interface BannerAction {
  type: 'search' | 'category' | 'department' | 'cart' | 'scroll' | 'product' | 'tag';
  query?: string;
  departmentId?: string;
  categorySlug?: string;
  productId?: string;
  tag?: string;
}

export interface CarouselSlide {
  id: string;
  title: string;
  desktopImage: string;
  mobileImage: string;
  link?: string;
  action?: BannerAction;
}

export const DEFAULT_BANNERS_DATA: CarouselSlide[] = [
  {
    id: 'slide-leo-branco',
    title: 'Black Edition Light • Leo Branco',
    desktopImage: '/images/banners/banner-leo-branco-desktop.webp',
    mobileImage: '/images/banners/banner-leo-branco-mobile.webp',
    link: '?search=Leo+Branco',
    action: {
      type: 'search',
      query: 'Leo Branco',
    },
  },
  {
    id: 'slide-favoritos',
    title: 'Favoritos dos Atletas • Zeiq Sports',
    desktopImage: '/images/banners/banner-favoritos-desktop.webp',
    mobileImage: '/images/banners/banner-favoritos-mobile.webp',
    link: '?dept=equipamentos&cat=raquetes',
    action: {
      type: 'category',
      departmentId: 'equipamentos',
      categorySlug: 'raquetes',
    },
  },
];

interface HomeSlideBannerProps {
  banners?: BannerItem[];
  onBannerAction?: (action: BannerAction) => void;
  onSelectDepartment?: (departmentId: string) => void;
  onSelectCategory?: (slug: string | null) => void;
  onOpenCart?: () => void;
}

export function HomeSlideBanner({
  banners,
  onBannerAction,
  onSelectDepartment,
  onSelectCategory,
  onOpenCart,
}: HomeSlideBannerProps) {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const [slideStepPixels, setSlideStepPixels] = useState(0);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const didSwipe = useRef(false);

  useEffect(() => {
    const updateDimensions = () => {
      setIsMobile(window.innerWidth < 640);
      if (trackRef.current && trackRef.current.firstElementChild) {
        const firstEl = trackRef.current.firstElementChild as HTMLElement;
        const gap = window.innerWidth < 640 ? 12 : 20;
        setSlideStepPixels(firstEl.offsetWidth + gap);
      }
    };
    updateDimensions();
    // Pequeno timeout para garantir medição correta após carregamento de layout
    const timer = setTimeout(updateDimensions, 100);
    window.addEventListener('resize', updateDimensions);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Converte banners recebidos (até 5) ou usa os padrões
  const slides: CarouselSlide[] = React.useMemo(() => {
    if (banners && banners.length > 0) {
      const active = banners.filter((b) => b.isActive !== false);
      if (active.length > 0) {
        return active.map((b) => ({
          id: b.id,
          title: b.title || 'Destaque Zeiq Sports',
          desktopImage: b.desktopImage,
          mobileImage: b.mobileImage || b.desktopImage,
          link: b.link || '',
        }));
      }
    }
    return DEFAULT_BANNERS_DATA;
  }, [banners]);

  const totalSlides = slides.length;

  // Garante que o slide atual esteja dentro dos limites
  useEffect(() => {
    if (currentSlide >= totalSlides) {
      setCurrentSlide(0);
    }
  }, [currentSlide, totalSlides]);

  const nextSlide = useCallback(() => {
    if (totalSlides <= 1) return;
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    if (totalSlides <= 1) return;
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  // Autoplay com pausa ao passar o mouse ou interagir
  useEffect(() => {
    if (isPaused || totalSlides <= 1) return;
    const interval = setInterval(() => {
      nextSlide();
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide, totalSlides]);

  // Gestos de toque (swipe) no mobile com detecção limpa sem engolir cliques
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    didSwipe.current = false;
  };

  const handleTouchMove = () => {
    // Não bloqueia o clique precocemente no touchmove
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const endY = e.changedTouches[0]?.clientY ?? (touchStartY.current ?? 0);

    const diffX = touchStartX.current - endX;
    const diffY = (touchStartY.current ?? 0) - endY;
    const minSwipeDistance = 35;

    // Apenas se for um gesto horizontal predominante com distância mínima
    if (Math.abs(diffX) > minSwipeDistance && Math.abs(diffX) > Math.abs(diffY)) {
      didSwipe.current = true;
      if (diffX > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
      setTimeout(() => {
        didSwipe.current = false;
      }, 250);
    } else {
      didSwipe.current = false;
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  const executeActionFromQueryOrPath = (pathname: string, searchStr: string, rawLink: string = '') => {
    const qs = searchStr.replace(/^\?/, '');
    const params = new URLSearchParams(qs);

    // 1. Destino para Produto Específico
    const prodParam = params.get('product') || params.get('produto');
    if (prodParam) {
      if (onBannerAction) onBannerAction({ type: 'product', productId: decodeURIComponent(prodParam).trim() });
      return;
    }
    if (rawLink.startsWith('product:') || rawLink.startsWith('produto:')) {
      const rawId = rawLink.replace(/^(?:product:|produto:)/, '').trim();
      if (onBannerAction) onBannerAction({ type: 'product', productId: decodeURIComponent(rawId) });
      return;
    }

    // 2. Destino para Tag / Coleção
    const tagParam = params.get('tag');
    if (tagParam) {
      if (onBannerAction) onBannerAction({ type: 'tag', tag: decodeURIComponent(tagParam).trim() });
      return;
    }
    if (rawLink.startsWith('tag:')) {
      const rawTag = rawLink.replace(/^tag:/, '').trim();
      if (onBannerAction) onBannerAction({ type: 'tag', tag: decodeURIComponent(rawTag) });
      return;
    }

    // 3. Destino para Busca / Palavra-chave no Catálogo
    const searchParam = params.get('search') || params.get('busca');
    if (searchParam) {
      if (onBannerAction) onBannerAction({ type: 'search', query: decodeURIComponent(searchParam).trim() });
      return;
    }

    // 4. Destino para Linha / Departamento e/ou Categoria
    const deptId = params.get('dept') || params.get('linha') || params.get('department') || undefined;
    const catSlug = params.get('cat') || params.get('categoria') || params.get('category') || undefined;
    if (deptId || catSlug) {
      if (onBannerAction) {
        onBannerAction({
          type: 'category',
          departmentId: deptId ? decodeURIComponent(deptId).trim() : undefined,
          categorySlug: catSlug ? decodeURIComponent(catSlug).trim() : undefined,
        });
        return;
      }
      if (deptId && onSelectDepartment) onSelectDepartment(decodeURIComponent(deptId).trim());
      if (catSlug && onSelectCategory) onSelectCategory(decodeURIComponent(catSlug).trim());
      return;
    }

    // 5. Rolagem suave para o catálogo
    if (rawLink.includes('#catalog-products-grid') || rawLink.includes('#catalogo')) {
      if (onBannerAction) {
        onBannerAction({ type: 'scroll' });
        return;
      }
      const gridElem = document.getElementById('catalog-products-grid');
      if (gridElem) gridElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // 6. Rota interna pura (ex: /portal, /login)
    if (pathname && pathname !== '/' && !pathname.includes('?')) {
      router.push(pathname);
      return;
    }

    // 7. Se for apenas "/"
    if (pathname === '/' && !searchStr) {
      const gridElem = document.getElementById('catalog-products-grid');
      if (gridElem) gridElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
  };

  const handleCardClick = (slide: CarouselSlide, displayIndex: number) => {
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }

    const realIndex = displayIndex % totalSlides;
    // Se o usuário clicar no cartão que está espiando ao lado, desliza para ele
    if (realIndex !== currentSlide) {
      setCurrentSlide(realIndex);
      return;
    }

    // Se o banner tiver link configurado
    if (slide.link) {
      const link = slide.link.trim();
      if (!link) return;

      // 1. WhatsApp wa.me direto
      if (link.startsWith('wa.me')) {
        window.open(`https://${link}`, '_blank', 'noopener,noreferrer');
        return;
      }

      // 2. URLs completas (http:// ou https://)
      if (link.startsWith('http://') || link.startsWith('https://')) {
        try {
          const parsed = new URL(link);
          const isSameHost = typeof window !== 'undefined' && parsed.hostname === window.location.hostname;
          if (isSameHost) {
            // Se for do mesmo domínio da aplicação, processa internamente via query params ou pathname
            executeActionFromQueryOrPath(parsed.pathname, parsed.search, link);
            return;
          }
        } catch {}

        // Link externo real (redes sociais, outro site, etc.)
        window.open(link, '_blank', 'noopener,noreferrer');
        return;
      }

      // 3. Link interno, âncora ou query param
      const pathname = link.includes('?') ? link.substring(0, link.indexOf('?')) : (link.startsWith('/') ? link : '');
      const search = link.includes('?') ? link.substring(link.indexOf('?')) : (link.startsWith('?') ? link : `?${link}`);

      executeActionFromQueryOrPath(pathname, search, link);
      return;
    }

    // Ação herdada se existir
    if (slide.action && onBannerAction) {
      onBannerAction(slide.action);
    }
  };

  // Trilho com repetição do primeiro slide para o efeito de espiar lateralmente
  const trackSlides = totalSlides > 1 ? [...slides, { ...slides[0], id: `${slides[0].id}-peek` }] : slides;
  const stepPercent = isMobile ? 88 : 74;

  return (
    <section
      aria-label="Carrossel de Destaques Zeiq"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full py-3 sm:py-5 overflow-hidden select-none"
    >
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-10 relative">
        
        {/* Trilho de Cartões com Prévia Lateral (Stage Carousel) */}
        <div className="overflow-visible">
          <div
            ref={trackRef}
            className="flex items-center gap-3 sm:gap-5 transition-transform duration-500 ease-out"
            style={{
              transform: totalSlides > 1 && slideStepPixels > 0
                ? `translateX(-${currentSlide * slideStepPixels}px)`
                : totalSlides > 1
                ? `translateX(-${currentSlide * stepPercent}%)`
                : 'none',
            }}
          >
            {trackSlides.map((slide, index) => {
              const realIndex = index % totalSlides;
              const isActive = realIndex === currentSlide && index < totalSlides;

              return (
                <div
                  key={`${slide.id}-${index}`}
                  onClick={() => handleCardClick(slide, index)}
                  className={`relative shrink-0 rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200/90 shadow-md transition-all duration-300 cursor-pointer group ${
                    totalSlides > 1 ? (isMobile ? 'w-[86%]' : 'w-[72%]') : 'w-full'
                  } ${
                    isActive ? 'ring-1 ring-black/5 opacity-100 scale-100' : 'opacity-75 hover:opacity-95 scale-[0.98]'
                  }`}
                  style={{
                    height: isMobile ? '235px' : '390px',
                    maxHeight: isMobile ? '260px' : '430px',
                  }}
                  title={slide.title}
                >
                  {/* Banner Gráfico Oficial Limpo (Sem botões sobrepostos) */}
                  <picture className="w-full h-full block">
                    <source media="(max-width: 640px)" srcSet={slide.mobileImage} type="image/webp" />
                    <img
                      src={slide.desktopImage}
                      alt={slide.title}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      decoding={index === 0 ? 'sync' : 'async'}
                      className="w-full h-full object-cover object-center group-hover:scale-[1.015] transition-transform duration-700 ease-out"
                    />
                  </picture>
                </div>
              );
            })}
          </div>
        </div>

        {/* Setas de Navegação (Apenas se houver mais de 1 slide) */}
        {totalSlides > 1 && (
          <>
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Slide anterior"
              className="absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/90 text-slate-800 shadow-xl border border-slate-200/90 hover:bg-white hover:scale-105 active:scale-95 transition-all hidden sm:flex items-center justify-center cursor-pointer backdrop-blur-xs"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={nextSlide}
              aria-label="Próximo slide"
              className="absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/90 text-slate-800 shadow-xl border border-slate-200/90 hover:bg-white hover:scale-105 active:scale-95 transition-all hidden sm:flex items-center justify-center cursor-pointer backdrop-blur-xs"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Indicadores de Slide (Dots / Pills) */}
            <div className="flex items-center justify-center gap-2 mt-3.5 sm:mt-5">
              {slides.map((slide, idx) => {
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
          </>
        )}

      </div>
    </section>
  );
}
