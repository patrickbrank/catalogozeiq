import React from 'react';

export interface AdminAvatar {
  id: string;
  name: string;
  emoji: string;
  theme: string;
  bgColor: string; // Fundo pastel suave estilo Apple
  borderColor: string; // Borda sutil de acabamento
  textColor?: string;
}

export const ADMIN_AVATARS: AdminAvatar[] = [
  {
    id: 'avatar-lightning',
    name: 'Raio Zeiq',
    emoji: '⚡',
    theme: 'Potência & Energia',
    bgColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  {
    id: 'avatar-tennis',
    name: 'Beach Tennis',
    emoji: '🎾',
    theme: 'Esporte & Precisão',
    bgColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  {
    id: 'avatar-trophy',
    name: 'Troféu Campeão',
    emoji: '🏆',
    theme: 'Vitória & Conquistas',
    bgColor: '#FEF9C3',
    borderColor: '#FEF08A',
  },
  {
    id: 'avatar-fire',
    name: 'Fogo & Foco',
    emoji: '🔥',
    theme: 'Dedicação & Alta Intensidade',
    bgColor: '#FFEDD5',
    borderColor: '#FED7AA',
  },
  {
    id: 'avatar-lion',
    name: 'Leão Zeiq',
    emoji: '🦁',
    theme: 'Garra & Liderança',
    bgColor: '#FDF2F8',
    borderColor: '#FBCFE8',
  },
  {
    id: 'avatar-sunglasses',
    name: 'Beach Vibes',
    emoji: '😎',
    theme: 'Lifestyle & Praia',
    bgColor: '#E0F2FE',
    borderColor: '#BAE6FD',
  },
  {
    id: 'avatar-rocket',
    name: 'Foguete',
    emoji: '🚀',
    theme: 'Crescimento & Velocidade',
    bgColor: '#E0E7FF',
    borderColor: '#C7D2FE',
  },
  {
    id: 'avatar-crown',
    name: 'Coroa Master',
    emoji: '👑',
    theme: 'Gestão & Autoridade',
    bgColor: '#F3E8FF',
    borderColor: '#E9D5FF',
  },
  {
    id: 'avatar-target',
    name: 'Alvo & Metas',
    emoji: '🎯',
    theme: 'Foco nos Resultados',
    bgColor: '#FFE4E6',
    borderColor: '#FECDD3',
  },
  {
    id: 'avatar-palm',
    name: 'Beach Life',
    emoji: '🌴',
    theme: 'Arena & Verão',
    bgColor: '#CCFBF1',
    borderColor: '#99F6E4',
  },
  {
    id: 'avatar-medal',
    name: 'Medalha 1º',
    emoji: '🥇',
    theme: 'Top Performance',
    bgColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  {
    id: 'avatar-star',
    name: 'Estrela',
    emoji: '⭐',
    theme: 'Destaque & Brilho',
    bgColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
];

// Mapa de compatibilidade para IDs legados
const LEGACY_AVATAR_MAP: Record<string, string> = {
  'avatar-cyber': 'avatar-tennis',
  'avatar-emerald': 'avatar-trophy',
  'avatar-fire': 'avatar-fire',
};

// Calcula o tamanho ideal do emoji proporcional ao diâmetro do círculo estilo Apple (~60% da área)
function getAutoEmojiSize(className: string): string {
  if (className.includes('w-16') || className.includes('h-16')) return 'text-4xl';
  if (className.includes('w-14') || className.includes('h-14')) return 'text-3xl';
  if (className.includes('w-12') || className.includes('h-12')) return 'text-2xl';
  if (className.includes('w-11') || className.includes('h-11')) return 'text-2xl';
  if (className.includes('w-10') || className.includes('h-10')) return 'text-xl';
  if (className.includes('w-8') || className.includes('h-8')) return 'text-lg';
  if (className.includes('w-7') || className.includes('h-7')) return 'text-base';
  if (className.includes('w-6') || className.includes('h-6')) return 'text-sm';
  return 'text-xl';
}

/**
 * Renderiza o avatar estilo Apple com fundo pastel suave e emoji centralizado e destacado
 */
export function AvatarIcon({
  avatarId,
  className = 'w-9 h-9',
  emojiClassName,
}: {
  avatarId?: string;
  className?: string;
  emojiClassName?: string;
}) {
  const resolvedId = avatarId && LEGACY_AVATAR_MAP[avatarId] ? LEGACY_AVATAR_MAP[avatarId] : avatarId;
  const current = ADMIN_AVATARS.find((a) => a.id === resolvedId) || ADMIN_AVATARS[0];
  const autoSize = emojiClassName || getAutoEmojiSize(className);

  return (
    <div
      className={`${className} rounded-full flex items-center justify-center shrink-0 select-none shadow-xs transition-transform`}
      style={{
        backgroundColor: current.bgColor,
        border: `1.5px solid ${current.borderColor}`,
      }}
      title={`${current.name} (${current.theme})`}
    >
      <span className={`${autoSize} flex items-center justify-center select-none leading-none`} style={{ lineHeight: 1 }}>
        {current.emoji}
      </span>
    </div>
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
