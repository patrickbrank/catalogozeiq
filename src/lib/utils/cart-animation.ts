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
    { scale: 0.95 },
    { scale: 1, duration: 0.24, ease: 'power2.out', clearProps: 'transform' }
  );

  // 2. Criação do Token Voador Refinado (48x48, cantos suaves, sombra realista)
  const flyer = document.createElement('div');
  flyer.className = 'fixed z-[9999] pointer-events-none select-none rounded-xl overflow-visible bg-white border border-slate-200/90';
  flyer.style.width = '48px';
  flyer.style.height = '48px';
  flyer.style.left = `${startX - 24}px`;
  flyer.style.top = `${startY - 24}px`;
  flyer.style.boxShadow = '0 12px 28px -4px rgba(0, 0, 0, 0.22), 0 4px 10px -2px rgba(0, 0, 0, 0.1)';
  flyer.style.willChange = 'transform, opacity, filter';

  // Container interno para manter a imagem perfeitamente clipada
  const innerClip = document.createElement('div');
  innerClip.className = 'w-full h-full rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center';

  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = '';
    img.className = 'w-full h-full object-cover object-top';
    innerClip.appendChild(img);
  } else {
    innerClip.innerHTML = `<svg class="w-5 h-5 text-zeiq-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>`;
  }
  flyer.appendChild(innerClip);

  // Badge numérico discreto no topo caso seja grade ou pacote (> 1 peça)
  if (count > 1) {
    const badgeEl = document.createElement('span');
    badgeEl.className = 'absolute -top-2 -right-2 bg-zeiq-black text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md border border-white tracking-tight';
    badgeEl.textContent = `+${count}`;
    flyer.appendChild(badgeEl);
  }

  document.body.appendChild(flyer);

  // Distâncias relativas
  const deltaX = targetX - startX;
  const deltaY = targetY - startY;

  // Altura do arco (elevação fluida proporcional à distância)
  const arcLift = Math.min(-60, deltaY * 0.35);

  // Timeline GSAP de trajetória fluida e contínua (0.58s total)
  const tl = gsap.timeline({
    onComplete: () => {
      if (flyer.parentNode) {
        flyer.parentNode.removeChild(flyer);
      }
      triggerCartImpact(cartTarget);
      if (onImpact) onImpact();
      window.dispatchEvent(new CustomEvent('cart-item-arrived'));
    },
  });

  // Decolagem: surge suave e ganha escala no ponto de partida
  tl.fromTo(
    flyer,
    { scale: 0.7, opacity: 0, rotate: 0 },
    { scale: 1, opacity: 1, duration: 0.16, ease: 'power2.out' }
  );

  // Trajetória X contínua com suavização orgânica
  tl.to(
    flyer,
    {
      x: deltaX,
      duration: 0.52,
      ease: 'power3.inOut',
    },
    0.04
  );

  // Trajetória Y em arco cinético: elevação inicial e atração em direção à sacola
  tl.to(
    flyer,
    {
      y: arcLift,
      duration: 0.24,
      ease: 'power2.out',
    },
    0.04
  ).to(
    flyer,
    {
      y: deltaY,
      duration: 0.32,
      ease: 'power3.in',
    },
    0.28
  );

  // Entrada final na sacola: afunilação natural, rotação suave e fade
  tl.to(
    flyer,
    {
      scale: 0.15,
      rotate: deltaX > 0 ? 18 : -18,
      opacity: 0.2,
      filter: 'blur(1px)',
      duration: 0.22,
      ease: 'power2.in',
    },
    0.38
  );
}

/**
 * Reação elástica e amortecida no botão da sacola ao absorver o item.
 * Evita saltos duros ou conflitos com transições do React.
 */
export function triggerCartImpact(cartElement: HTMLElement) {
  if (!cartElement) return;

  // Interrompe animações pendentes para suportar cliques rápidos sucessivos
  gsap.killTweensOf(cartElement);

  const bagIcon = cartElement.querySelector('svg');
  const badge = cartElement.querySelector('span.rounded-full');

  if (bagIcon) gsap.killTweensOf(bagIcon);
  if (badge) gsap.killTweensOf(badge);

  // Timeline de absorção amortecida no botão (simula absorção física de peso)
  const impactTl = gsap.timeline();

  // Compressão tátil inicial
  impactTl.to(cartElement, {
    scaleY: 0.94,
    scaleX: 1.05,
    y: 1.5,
    duration: 0.09,
    ease: 'power2.out',
  });

  // Expansão elástica e retorno ao repouso com amortecimento fluido
  impactTl.to(cartElement, {
    scaleY: 1,
    scaleX: 1,
    y: 0,
    duration: 0.48,
    ease: 'elastic.out(1.15, 0.4)',
    clearProps: 'transform',
  });

  // Inclinação orgânica no ícone da sacola
  if (bagIcon) {
    gsap.timeline()
      .to(bagIcon, {
        rotate: -10,
        y: -1.5,
        scale: 1.15,
        duration: 0.12,
        ease: 'power2.out',
      })
      .to(bagIcon, {
        rotate: 0,
        y: 0,
        scale: 1,
        duration: 0.42,
        ease: 'back.out(2)',
        clearProps: 'transform',
      });
  }

  // Pulso refinado no badge numérico (elevação e realce luminoso discreto)
  if (badge) {
    gsap.fromTo(
      badge,
      {
        y: 3,
        scale: 1.3,
        backgroundColor: '#f97316',
        color: '#000000',
      },
      {
        y: 0,
        scale: 1,
        backgroundColor: '#ffffff',
        color: '#000000',
        duration: 0.45,
        ease: 'back.out(1.8)',
        clearProps: 'transform,backgroundColor,color',
      }
    );
  }
}
