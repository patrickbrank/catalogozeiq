'use client';

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import gsap from 'gsap';

interface PanelLoadingScreenProps {
  title?: string;
  subtitle?: string;
}

export function PanelLoadingScreen({
  title = 'PAINEL DO REVENDEDOR',
  subtitle = 'Sincronizando carteira comercial e pedidos...',
}: PanelLoadingScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const outerRingRef = useRef<SVGSVGElement>(null);
  const innerRingRef = useRef<SVGSVGElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // 1. Rotação contínua do anel orbital externo
      if (outerRingRef.current) {
        gsap.to(outerRingRef.current, {
          rotation: 360,
          duration: 3,
          repeat: -1,
          ease: 'none',
          transformOrigin: '50% 50%',
        });
      }

      // 2. Contrarotação do anel interno com velocidade alternada
      if (innerRingRef.current) {
        gsap.to(innerRingRef.current, {
          rotation: -360,
          duration: 5.5,
          repeat: -1,
          ease: 'none',
          transformOrigin: '50% 50%',
        });
      }

      // 3. Pulsação orgânica da logo Zeiq (breathing scale)
      if (logoRef.current) {
        gsap.to(logoRef.current, {
          scale: 1.06,
          duration: 1.4,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }

      // 4. Brilho ambiente pulsante em degradê laranja Zeiq
      if (glowRef.current) {
        gsap.to(glowRef.current, {
          opacity: 0.65,
          scale: 1.25,
          duration: 1.6,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      }

      // 5. Barra de progresso atlética fluida
      if (progressBarRef.current) {
        gsap.fromTo(
          progressBarRef.current,
          { width: '8%' },
          {
            width: '94%',
            duration: 2.2,
            repeat: -1,
            yoyo: true,
            ease: 'power2.inOut',
          }
        );
      }

      // 6. Revelação de entrada suave dos textos
      if (textContainerRef.current) {
        gsap.fromTo(
          textContainerRef.current,
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }
        );
      }
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-[#070707] text-white flex flex-col items-center justify-center p-6 select-none relative overflow-hidden"
    >
      {/* Iluminação ambiente esportiva centralizada */}
      <div
        ref={glowRef}
        className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-gradient-to-tr from-zeiq-orange/20 via-orange-600/10 to-transparent blur-3xl opacity-40 pointer-events-none"
      />

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Núcleo Gráfico Orbital GSAP */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center mb-6">
          
          {/* Anel Orbital Externo Rotativo */}
          <svg
            ref={outerRingRef}
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="2"
            />
            {/* Arco esportivo em laranja Zeiq com terminadores suaves */}
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="#ff9600"
              strokeWidth="3"
              strokeDasharray="70 220"
              strokeLinecap="round"
            />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeDasharray="20 270"
              strokeLinecap="round"
              className="opacity-70"
            />
          </svg>

          {/* Anel Interno em Contrarotação */}
          <svg
            ref={innerRingRef}
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            <circle
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke="rgba(255, 150, 0, 0.25)"
              strokeWidth="1.5"
              strokeDasharray="40 180"
              strokeLinecap="round"
            />
          </svg>

          {/* Emblema Central Zeiq com Pulsação Suave */}
          <div
            ref={logoRef}
            className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-black/80 border border-white/15 flex items-center justify-center p-3 shadow-2xl backdrop-blur-md"
          >
            <div className="relative w-full h-full brightness-0 invert flex items-center justify-center">
              <Image
                src="/images/logo-zeiq-icon.png"
                alt="Zeiq"
                width={40}
                height={40}
                priority
                className="w-auto h-full max-h-8 object-contain"
                onError={(e) => {
                  // Fallback para logo padrão se ícone não carregar
                  const target = e.target as HTMLImageElement;
                  target.src = '/images/logo-zeiq.png';
                }}
              />
            </div>
          </div>
        </div>

        {/* Textos de Estado e Marca */}
        <div ref={textContainerRef} className="space-y-2 max-w-xs">
          <div className="flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zeiq-orange animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">
              {title}
            </span>
          </div>

          <p className="text-xs text-slate-400 font-medium leading-relaxed">
            {subtitle}
          </p>

          {/* Linha Atlética de Progresso GSAP */}
          <div className="pt-2">
            <div className="w-48 sm:w-56 h-1 rounded-full bg-white/10 mx-auto overflow-hidden">
              <div
                ref={progressBarRef}
                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-zeiq-orange to-orange-500 shadow-[0_0_12px_rgba(255,150,0,0.6)]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}