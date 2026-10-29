import React from 'react';

export interface AdminAvatar {
  id: string;
  name: string;
  theme: string;
  symbolLabel: string;
  primaryColor: string;
  secondaryColor: string;
  badgeBg: string;
  badgeBorder: string;
}

export const ADMIN_AVATARS: AdminAvatar[] = [
  {
    id: 'avatar-fire',
    name: 'Raio & Raquete',
    theme: 'Potência & Beach Tennis',
    symbolLabel: 'Zeiq Flash Racket',
    primaryColor: '#FF5500',
    secondaryColor: '#FFAA00',
    badgeBg: 'bg-orange-500/10',
    badgeBorder: 'border-orange-500/30',
  },
  {
    id: 'avatar-cyber',
    name: 'Bola Speed',
    theme: 'Precisão & Velocidade',
    symbolLabel: 'Velocity Ball',
    primaryColor: '#0066FF',
    secondaryColor: '#00D2FF',
    badgeBg: 'bg-blue-500/10',
    badgeBorder: 'border-blue-500/30',
  },
  {
    id: 'avatar-emerald',
    name: 'Troféu Campeão',
    theme: 'Vitória & Liderança',
    symbolLabel: 'Victory Trophy',
    primaryColor: '#059669',
    secondaryColor: '#F59E0B',
    badgeBg: 'bg-emerald-500/10',
    badgeBorder: 'border-emerald-500/30',
  },
];

/**
 * Renderiza os 3 símbolos esportivos minimalistas da Zeiq
 */
export function AvatarIcon({ avatarId, className = 'w-9 h-9' }: { avatarId?: string; className?: string }) {
  const current = ADMIN_AVATARS.find((a) => a.id === avatarId) || ADMIN_AVATARS[0];

  // Símbolo 2: Bola de Beach Tennis / Aerodinâmica Speed (Azul & Ciano)
  if (current.id === 'avatar-cyber') {
    return (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${className} shrink-0 select-none`}
      >
        <defs>
          <linearGradient id="cyber-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#08101a" />
            <stop offset="100%" stopColor="#0d1b2a" />
          </linearGradient>
          <linearGradient id="cyber-ball" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00D2FF" />
            <stop offset="100%" stopColor="#0052D4" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#cyber-bg)" stroke="#00D2FF" strokeWidth="2.5" />
        {/* Bola de Beach Tennis com Costuras Aerodinâmicas */}
        <circle cx="50" cy="50" r="28" fill="url(#cyber-ball)" stroke="#FFFFFF" strokeWidth="2" />
        <path
          d="M32 38 C42 42 42 58 32 62"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M68 38 C58 42 58 58 68 62"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Linhas de Velocidade Esportivas */}
        <path d="M20 28 L14 28" stroke="#00D2FF" strokeWidth="2" strokeLinecap="round" />
        <path d="M22 72 L16 72" stroke="#00D2FF" strokeWidth="2" strokeLinecap="round" />
        <path d="M84 32 L78 32" stroke="#00D2FF" strokeWidth="2" strokeLinecap="round" />
        <path d="M86 68 L80 68" stroke="#00D2FF" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // Símbolo 3: Troféu & Brasão de Vitória (Verde Esmeralda & Ouro)
  if (current.id === 'avatar-emerald') {
    return (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${className} shrink-0 select-none`}
      >
        <defs>
          <linearGradient id="emerald-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#061a12" />
            <stop offset="100%" stopColor="#0a261a" />
          </linearGradient>
          <linearGradient id="gold-trophy" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#emerald-bg)" stroke="#10B981" strokeWidth="2.5" />
        {/* Cálice do Troféu */}
        <path
          d="M34 26 L66 26 L64 48 C64 57 58 64 50 64 C42 64 36 57 36 48 Z"
          fill="url(#gold-trophy)"
          stroke="#FFFFFF"
          strokeWidth="1.5"
        />
        {/* Alças Laterais */}
        <path
          d="M34 30 C26 30 26 44 34 44"
          fill="none"
          stroke="url(#gold-trophy)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M66 30 C74 30 74 44 66 44"
          fill="none"
          stroke="url(#gold-trophy)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Haste e Base */}
        <rect x="47" y="64" width="6" height="10" fill="url(#gold-trophy)" />
        <rect x="36" y="74" width="28" height="6" rx="2" fill="url(#gold-trophy)" />
        {/* Estrela da Vitória */}
        <polygon points="50,34 52,39 57,39 53,42 55,47 50,44 45,47 47,42 43,39 48,39" fill="#FFFFFF" />
      </svg>
    );
  }

  // Símbolo 1 (Padrão): Raquete & Raio Zeiq (Laranja Zeiq & Fogo Esportivo)
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} shrink-0 select-none`}
    >
      <defs>
        <linearGradient id="fire-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a0d06" />
          <stop offset="100%" stopColor="#2a1208" />
        </linearGradient>
        <linearGradient id="racket-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFAA00" />
          <stop offset="100%" stopColor="#FF5500" />
        </linearGradient>
        <linearGradient id="bolt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#FFCC00" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#fire-bg)" stroke="#FF5500" strokeWidth="2.5" />
      {/* Cabeça Oval da Raquete de Beach Tennis */}
      <ellipse
        cx="50"
        cy="42"
        rx="22"
        ry="25"
        fill="none"
        stroke="url(#racket-grad)"
        strokeWidth="3.5"
      />
      {/* Furação Geométrica de Beach Tennis */}
      <circle cx="43" cy="36" r="1.8" fill="#FF5500" />
      <circle cx="50" cy="33" r="1.8" fill="#FF5500" />
      <circle cx="57" cy="36" r="1.8" fill="#FF5500" />
      <circle cx="43" cy="46" r="1.8" fill="#FF5500" />
      <circle cx="50" cy="48" r="1.8" fill="#FF5500" />
      <circle cx="57" cy="46" r="1.8" fill="#FF5500" />
      {/* Cabo da Raquete */}
      <path d="M48 67 L46 82 L54 82 L52 67 Z" fill="url(#racket-grad)" />
      {/* Raio Dinâmico Cortando a Raquete */}
      <path
        d="M56 18 L38 46 L49 46 L44 70 L64 38 L51 38 Z"
        fill="url(#bolt-grad)"
        stroke="#1a0d06"
        strokeWidth="1.2"
      />
    </svg>
  );
}

/**
 * Máscara brasileira de telefone/WhatsApp:
 * Formata para: (16) 9 9665-5050 ou (16) 3333-4444
 */
export function formatPhoneBR(phone?: string | null): string {
  if (!phone) return '—';
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return '—';

  // Remove DDI 55 se presente
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  // Celular com 9 dígitos: (16) 9 9665-5050
  if (digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const n9 = digits.slice(2, 3);
    const p1 = digits.slice(3, 7);
    const p2 = digits.slice(7);
    return `(${ddd}) ${n9} ${p1}-${p2}`;
  }

  // Fixo ou antigo com 8 dígitos: (16) 3333-4444
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const p1 = digits.slice(2, 6);
    const p2 = digits.slice(6);
    return `(${ddd}) ${p1}-${p2}`;
  }

  return phone;
}
