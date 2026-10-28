import React from 'react';

export interface AdminAvatar {
  id: string;
  name: string;
  theme: string;
  primaryColor: string;
  secondaryColor: string;
  badgeBg: string;
  badgeBorder: string;
}

export const ADMIN_AVATARS: AdminAvatar[] = [
  {
    id: 'avatar-fire',
    name: 'Zeiq Fire',
    theme: 'Energia & Foco',
    primaryColor: '#FF5500',
    secondaryColor: '#FFAA00',
    badgeBg: 'bg-orange-500/10',
    badgeBorder: 'border-orange-500/30',
  },
  {
    id: 'avatar-cyber',
    name: 'Cyber Pro',
    theme: 'Alta Performance',
    primaryColor: '#0066FF',
    secondaryColor: '#00D2FF',
    badgeBg: 'bg-blue-500/10',
    badgeBorder: 'border-blue-500/30',
  },
  {
    id: 'avatar-emerald',
    name: 'Champion Gold',
    theme: 'Vitória & Conquista',
    primaryColor: '#059669',
    secondaryColor: '#10B981',
    badgeBg: 'bg-emerald-500/10',
    badgeBorder: 'border-emerald-500/30',
  },
];

export function AvatarIcon({ avatarId, className = 'w-9 h-9' }: { avatarId?: string; className?: string }) {
  const current = ADMIN_AVATARS.find((a) => a.id === avatarId) || ADMIN_AVATARS[0];

  if (current.id === 'avatar-cyber') {
    return (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${className} shrink-0 drop-shadow-md select-none`}
      >
        <defs>
          <linearGradient id="cyber-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0052D4" />
            <stop offset="50%" stopColor="#4364F7" />
            <stop offset="100%" stopColor="#6FB1FC" />
          </linearGradient>
          <linearGradient id="cyber-glow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00D2FF" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0052D4" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="#0c1017" stroke="url(#cyber-glow)" strokeWidth="3" />
        <circle cx="50" cy="50" r="44" fill="url(#cyber-grad)" fillOpacity="0.2" />
        {/* Hexágono Tech */}
        <path
          d="M50 18 L76 33 L76 67 L50 82 L24 67 L24 33 Z"
          fill="none"
          stroke="#00D2FF"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeOpacity="0.7"
        />
        {/* Cabeça / Capacete de Performance */}
        <circle cx="50" cy="40" r="13" fill="url(#cyber-grad)" stroke="#FFFFFF" strokeWidth="2" />
        {/* Ombros / Corpo Atlético */}
        <path
          d="M28 72 C32 58 40 54 50 54 C60 54 68 58 72 72 Z"
          fill="url(#cyber-grad)"
          stroke="#00D2FF"
          strokeWidth="2"
        />
        {/* Badge Tech Central */}
        <circle cx="50" cy="40" r="4" fill="#FFFFFF" />
      </svg>
    );
  }

  if (current.id === 'avatar-emerald') {
    return (
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${className} shrink-0 drop-shadow-md select-none`}
      >
        <defs>
          <linearGradient id="emerald-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#047857" />
            <stop offset="50%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
          <linearGradient id="gold-crown" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#FDE68A" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="#08140e" stroke="#10B981" strokeWidth="3" />
        <circle cx="50" cy="50" r="44" fill="url(#emerald-grad)" fillOpacity="0.2" />
        {/* Coroa de Campeão */}
        <path
          d="M36 28 L43 36 L50 25 L57 36 L64 28 L62 40 L38 40 Z"
          fill="url(#gold-crown)"
          stroke="#D97706"
          strokeWidth="1.5"
        />
        {/* Cabeça do Atleta Campeão */}
        <circle cx="50" cy="45" r="12" fill="url(#emerald-grad)" stroke="#FFFFFF" strokeWidth="2" />
        {/* Ombros / Peitoral de Vitória */}
        <path
          d="M28 75 C32 60 40 57 50 57 C60 57 68 60 72 75 Z"
          fill="url(#emerald-grad)"
          stroke="#F59E0B"
          strokeWidth="2"
        />
        {/* Estrela de Campeão */}
        <polygon points="50,60 52,65 57,65 53,68 55,73 50,70 45,73 47,68 43,65 48,65" fill="#FDE68A" />
      </svg>
    );
  }

  // Padrão: Avatar 1 (Zeiq Fire - Laranja & Ouro)
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} shrink-0 drop-shadow-md select-none`}
    >
      <defs>
        <linearGradient id="fire-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF3B00" />
          <stop offset="50%" stopColor="#FF5500" />
          <stop offset="100%" stopColor="#FFAA00" />
        </linearGradient>
        <linearGradient id="fire-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF8800" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#FF3B00" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="#140b08" stroke="url(#fire-glow)" strokeWidth="3" />
      <circle cx="50" cy="50" r="44" fill="url(#fire-grad)" fillOpacity="0.25" />
      {/* Raio Esportivo Zeiq no Fundo */}
      <path
        d="M48 14 L36 44 L48 44 L44 76 L66 40 L52 40 Z"
        fill="#FF5500"
        fillOpacity="0.3"
      />
      {/* Cabeça do Atleta de Foco */}
      <circle cx="50" cy="38" r="13" fill="url(#fire-grad)" stroke="#FFFFFF" strokeWidth="2" />
      {/* Ombros / Peitoral Forte */}
      <path
        d="M26 72 C30 56 40 52 50 52 C60 52 70 56 74 72 Z"
        fill="url(#fire-grad)"
        stroke="#FFAA00"
        strokeWidth="2"
      />
      {/* Ponto de Energia Central */}
      <circle cx="50" cy="38" r="4" fill="#FFFFFF" />
    </svg>
  );
}
