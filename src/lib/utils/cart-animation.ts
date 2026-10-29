'use client';

import gsap from 'gsap';

export interface FlyToCartOptions {
  startElement?: HTMLElement | null;
  imageUrl?: string;
  count?: number;
  onImpact?: () => void;
}

/**
 * Animação fluida e orgânica de adição à sacola com física cinemática em GSAP.
 * Cria um token refinado do produto que decola com arco natural, afunila em direção
 * à sacola e produz uma resposta elástica amortecida no cabeçalho.
 */
export function flyToCartAnimation(options: FlyToCartOptions) {
  if (typeof window === 'undefined') return;

  const { startElement, imageUrl, count = 1, onImpact } = options;

  // Respeita preferência do usuário por movimento reduzido
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Localiza o botão da sacola no cabeçalho
  const cartTarget = document.getElementById('header-cart-button') || document.getElementById('mobile-cart-button');

  if (!cartTarget) {
    if (onImpact) onImpact();
    window.dispatchEvent(new CustomEvent('cart-item-arrived'));
    return;
  }

  const targetRect = cartTarget.getBoundingClientRect();
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;

  // Fallback rápido se não tiver elemento ou preferir sem movimento
  if (prefersReducedMotion || !startElement) {
    triggerCartImpact(cartTarget);
    if (onImpact) onImpact();
    window.dispatchEvent(new CustomEvent('cart-item-arrived'));
    return;
  }

  const startRect = startElement.getBoundingClientRect();
  const startX = startRect.left + startRect.width / 2;
  const startY = startRect.top + startRect.height / 2;

  // 1. Resposta tátil imediata no botão clicado (micro-compressão suave)
  gsap.fromTo(
    startElement,
    { scale: 0.94 },
    { scale: 1, duration: 0.25, ease: 'back.out(2)', clearProps: 'transform' }
  );

  // Determina tamanho generoso do token voador (altamente visível em mobile e PC)
  const isMobile = window.innerWidth < 640;
  const tokenSize = isMobile ? 54 : 62;
  const halfToken = tokenSize / 2;

  // 2. Criação do Token Voador com Halo Esportivo Zeiq Luminoso
  const flyer = document.createElement('div');
  flyer.className = 'fixed z-[100000] pointer-events-none select-none rounded-2xl overflow-visible bg-white border-2 border-zeiq-orange';
  flyer.style.width = `${tokenSize}px`;
  flyer.style.height = `${tokenSize}px`;
  flyer.style.left = `${startX - halfToken}px`;
  flyer.style.top = `${startY - halfToken}px`;
  flyer.style.boxShadow = '0 0 28px 6px rgba(255, 150, 0, 0.85), 0 16px 36px rgba(0, 0, 0, 0.5)';
  flyer.style.willChange = 'transform, opacity';

  // Container interno para manter a foto nítida e bem clipada
  const innerClip = document.createElement('div');
  innerClip.className = 'w-full h-full rounded-[14px] overflow-hidden bg-slate-50 flex items-center justify-center';

  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = '';
    img.className = 'w-full h-full object-cover object-top';
    innerClip.appendChild(img);
  } else {
    innerClip.innerHTML = `<svg class="w-6 h-6 text-zeiq-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>`;
  }
  flyer.appendChild(innerClip);

  // Badge numérico em alto contraste no topo caso seja grade ou pacote (> 1 peça)
  if (count > 1) {
    const badgeEl = document.createElement('span');
    badgeEl.className = 'absolute -top-2.5 -right-2.5 bg-zeiq-black text-zeiq-orange text-xs font-black px-2 py-0.5 rounded-full shadow-lg border-2 border-white tracking-tight';
    badgeEl.textContent = `+${count}`;
    flyer.appendChild(badgeEl);
  }

  document.body.appendChild(flyer);

  // Distâncias relativas
  const deltaX = targetX - startX;
  const deltaY = targetY - startY;

  // Altura do arco cinemático (mais pronunciado no mobile para voar com destaque)
  const arcLift = isMobile
    ? Math.min(-90, deltaY * 0.45)
    : Math.min(-75, deltaY * 0.38);

  // Timeline GSAP de trajetória visível, limpa e contínua (0.68s)
  const tl = gsap.timeline({
    onComplete: () => {
      if (flyer.parentNode) {
        flyer.parentNode.removeChild(flyer);
      }
      triggerCartImpact(cartTarget);
      if (onImpact) onImpact();
      window.dispatchEvent(new CustomEvent('cart-item-arrived'));

      // Vibração tátil sutil em dispositivos móveis
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([15, 30, 20]);
        } catch {}
      }
    },
  });

  // Decolagem: ganha escala e decola vigorosa
  tl.fromTo(
    flyer,
    { scale: 0.5, opacity: 0, rotate: -8 },
    { scale: 1.12, opacity: 1, rotate: 0, duration: 0.18, ease: 'back.out(2)' }
  );

  // Trajetória X contínua
  tl.to(
    flyer,
    {
      x: deltaX,
      duration: 0.52,
      ease: 'power2.inOut',
    },
    0.06
  );

  // Trajetória Y em arco parabólico: elevação inicial e atração em direção à sacola
  tl.to(
    flyer,
    {
      y: arcLift,
      duration: 0.28,
      ease: 'power1.out',
    },
    0.06
  ).to(
    flyer,
    {
      y: deltaY,
      duration: 0.28,
      ease: 'power2.in',
    },
    0.34
  );

  // Sucção final para a sacola (apenas nos últimos 0.1s para NUNCA sumir no meio)
  tl.to(
    flyer,
    {
      scale: 0.12,
      rotate: deltaX > 0 ? 25 : -25,
      opacity: 0,
      duration: 0.12,
      ease: 'power3.in',
    },
    0.56
  );
}

/**
 * Reação elástica e amortecida no botão da sacola ao absorver o item.
 */
export function triggerCartImpact(cartElement: HTMLElement) {
  if (!cartElement) return;

  // Interrompe animações pendentes para suportar cliques rápidos sucessivos
  gsap.killTweensOf(cartElement);

  const bagIcon = cartElement.querySelector('svg');
  const badge = cartElement.querySelector('span.rounded-full');

  if (bagIcon) gsap.killTweensOf(bagIcon);
  if (badge) gsap.killTweensOf(badge);

  const impactTl = gsap.timeline();

  // Onda de choque luminosa no botão da sacola (anel expansivo)
  gsap.fromTo(
    cartElement,
    { boxShadow: '0 0 0 0 rgba(255, 150, 0, 0.85)' },
    { boxShadow: '0 0 0 18px rgba(255, 150, 0, 0)', duration: 0.55, ease: 'power2.out', clearProps: 'boxShadow' }
  );

  // Salto elástico do botão da sacola
  impactTl.to(cartElement, {
    scale: 1.25,
    rotate: -6,
    duration: 0.12,
    ease: 'power2.out',
  }).to(cartElement, {
    scale: 1,
    rotate: 0,
    duration: 0.5,
    ease: 'elastic.out(1.2, 0.35)',
    clearProps: 'transform',
  });

  // Salto do badge numérico com realce luminoso
  if (badge) {
    gsap.fromTo(
      badge,
      {
        scale: 1.75,
        backgroundColor: '#ff9600',
        color: '#ffffff',
      },
      {
        scale: 1,
        backgroundColor: '#ffffff',
        color: '#0a0a0a',
        duration: 0.55,
        ease: 'back.out(2)',
        clearProps: 'transform,backgroundColor,color',
      }
    );
  }

  // Chacoalhada esportiva no ícone da sacola
  if (bagIcon) {
    gsap.timeline()
      .to(bagIcon, {
        rotate: -14,
        scale: 1.22,
        duration: 0.12,
        ease: 'power2.out',
      })
      .to(bagIcon, {
        rotate: 0,
        scale: 1,
        duration: 0.45,
        ease: 'elastic.out(1.2, 0.35)',
        clearProps: 'transform',
      });
  }
}
