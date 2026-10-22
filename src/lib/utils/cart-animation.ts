'use client';

import gsap from 'gsap';

export interface FlyToCartOptions {
  startElement?: HTMLElement | null;
  imageUrl?: string;
  count?: number;
  onImpact?: () => void;
}

/**
 * Animação balística de alta performance com GSAP:
 * Cria uma miniatura flutuante do produto que voa do ponto de clique até o ícone do carrinho no cabeçalho.
 */
export function flyToCartAnimation(options: FlyToCartOptions) {
  if (typeof window === 'undefined') return;

  const { startElement, imageUrl, onImpact } = options;

  // Respeita preferência do usuário por movimento reduzido
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Busca o elemento de destino (botão do carrinho no Header)
  const cartTarget = document.getElementById('header-cart-button') || document.getElementById('mobile-cart-button');

  if (!cartTarget) {
    if (onImpact) onImpact();
    window.dispatchEvent(new CustomEvent('cart-item-arrived'));
    return;
  }

  const targetRect = cartTarget.getBoundingClientRect();
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;

  // Se preferir movimento reduzido ou não tiver elemento de partida, faz impacto direto
  if (prefersReducedMotion || !startElement) {
    triggerCartImpact(cartTarget);
    if (onImpact) onImpact();
    window.dispatchEvent(new CustomEvent('cart-item-arrived'));
    return;
  }

  const startRect = startElement.getBoundingClientRect();
  const startX = startRect.left + startRect.width / 2;
  const startY = startRect.top + startRect.height / 2;

  // 1. Cria elemento voador no DOM
  const flyer = document.createElement('div');
  flyer.className = 'fixed z-[9999] pointer-events-none select-none rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center border-2 border-white/80 bg-white';
  flyer.style.width = '64px';
  flyer.style.height = '64px';
  flyer.style.left = `${startX - 32}px`;
  flyer.style.top = `${startY - 32}px`;
  flyer.style.willChange = 'transform, opacity';
  flyer.style.filter = 'drop-shadow(0 12px 24px rgba(0, 0, 0, 0.35))';

  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = '';
    img.className = 'w-full h-full object-contain p-1 mix-blend-multiply';
    flyer.appendChild(img);
  } else {
    flyer.innerHTML = `<svg class="w-7 h-7 text-zeiq-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>`;
  }

  // Efeito de aura brilhante ao redor
  const glow = document.createElement('div');
  glow.className = 'absolute -inset-1 rounded-2xl bg-gradient-to-tr from-zeiq-orange to-amber-300 opacity-60 blur-xs -z-10';
  flyer.appendChild(glow);

  document.body.appendChild(flyer);

  // Distância e cálculo da trajetória
  const deltaX = targetX - startX;
  const deltaY = targetY - startY;

  // Timeline balística GSAP com física natural
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

  // Fase 1: Pop inicial explosivo no botão de clique
  gsap.fromTo(
    startElement,
    { scale: 0.92 },
    { scale: 1, duration: 0.28, ease: 'back.out(2)' }
  );

  // Fase 2: Arco balístico e aceleração gravitacional em direção ao topo
  tl.fromTo(
    flyer,
    { scale: 0.4, opacity: 0, rotate: 0 },
    { scale: 1.15, opacity: 1, duration: 0.2, ease: 'back.out(2.2)' }
  )
    // Curva X com easing suave
    .to(
      flyer,
      {
        x: deltaX,
        duration: 0.72,
        ease: 'power2.inOut',
      },
      '-=0.08'
    )
    // Curva Y balística: primeiro sobe um pouco, depois desce acelerando até o alvo
    .to(
      flyer,
      {
        y: deltaY - 50,
        duration: 0.35,
        ease: 'power1.out',
      },
      '-=0.72'
    )
    .to(
      flyer,
      {
        y: deltaY,
        duration: 0.37,
        ease: 'power2.in',
      },
      '-=0.37'
    )
    // Encolhimento e rotação ao entrar na sacola
    .to(
      flyer,
      {
        scale: 0.22,
        rotate: deltaX > 0 ? 35 : -35,
        opacity: 0.6,
        duration: 0.32,
        ease: 'power2.in',
      },
      '-=0.32'
    );
}

/**
 * Reação elástica de impacto físico no botão do carrinho no Header
 */
export function triggerCartImpact(cartElement: HTMLElement) {
  if (!cartElement) return;

  const bagIcon = cartElement.querySelector('svg');
  const badge = cartElement.querySelector('span.rounded-full');

  // Impacto elástico com GSAP no container do botão
  gsap.timeline()
    .to(cartElement, {
      scale: 1.22,
      rotate: -5,
      duration: 0.12,
      ease: 'power2.out',
    })
    .to(cartElement, {
      scale: 0.94,
      rotate: 3,
      duration: 0.15,
      ease: 'power1.out',
    })
    .to(cartElement, {
      scale: 1,
      rotate: 0,
      duration: 0.45,
      ease: 'elastic.out(1.3, 0.35)',
    });

  // Vibração individual do ícone da sacola
  if (bagIcon) {
    gsap.fromTo(
      bagIcon,
      { rotate: -18, scale: 1.35 },
      { rotate: 0, scale: 1, duration: 0.6, ease: 'elastic.out(1.5, 0.4)' }
    );
  }

  // Pulso no badge numérico de contagem
  if (badge) {
    gsap.timeline()
      .fromTo(
        badge,
        { scale: 1.7, backgroundColor: '#f97316', color: '#000000', boxShadow: '0 0 16px rgba(249, 115, 22, 0.8)' },
        { scale: 1, backgroundColor: '#ffffff', color: '#000000', boxShadow: 'none', duration: 0.65, ease: 'back.out(2.2)' }
      );
  }
}
