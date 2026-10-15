import { ProductHighlight } from '@/types';

export function parseProductSpecifications(
  description?: string | null,
  explicitHighlights?: ProductHighlight[]
): {
  highlights: ProductHighlight[];
  cleanDescription: string;
} {
  // Se o administrador já cadastrou destaques explícitos no painel
  if (explicitHighlights && explicitHighlights.length > 0) {
    const validExplicit = explicitHighlights.filter(
      (h) => h.label?.trim() && h.value?.trim()
    );
    if (validExplicit.length > 0) {
      let clean = description || '';
      clean = clean.replace(/Especifica[çc][õo]es\s*T[ée]cnicas:?[^\n\r]*/gi, '');
      return {
        highlights: validExplicit.slice(0, 6),
        cleanDescription: clean.trim(),
      };
    }
  }

  if (!description) {
    return { highlights: [], cleanDescription: '' };
  }

  // 1. Normalização prévia: separa palavras-chave coladas sem quebra de linha
  const splitKeywordsRegex = /(Peso|Comprimento\s+Empunhadura|Comprimento|Espessura|Largura|Face|EVA|N[uú]cleo|Sistema|Cores\s+predominantes|Cores|N[ií]vel\s+de\s+jogo|N[ií]vel|Material|Acompanha|Diferencial):/gi;
  let normalized = description.replace(splitKeywordsRegex, '\n$1:');

  const knownSpecs = [
    { regex: /Peso:\s*([^\n\r]+)/i, label: 'Peso' },
    { regex: /Comprimento\s+Empunhadura:\s*([^\n\r]+)/i, label: 'Empunhadura' },
    { regex: /Comprimento:\s*([^\n\r]+)/i, label: 'Comprimento' },
    { regex: /Espessura:\s*([^\n\r]+)/i, label: 'Espessura' },
    { regex: /Largura:\s*([^\n\r]+)/i, label: 'Largura' },
    { regex: /Face:\s*([^\n\r]+)/i, label: 'Face' },
    { regex: /EVA:\s*([^\n\r]+)/i, label: 'Núcleo EVA' },
    { regex: /N[uú]cleo:\s*([^\n\r]+)/i, label: 'Núcleo' },
    { regex: /Sistema:\s*([^\n\r]+)/i, label: 'Sistema' },
    { regex: /Cores(?:\s+predominantes)?:\s*([^\n\r]+)/i, label: 'Cores' },
    { regex: /N[ií]vel(?:\s+de\s+jogo)?:\s*([^\n\r]+)/i, label: 'Nível' },
    { regex: /Material:\s*([^\n\r]+)/i, label: 'Material' },
    { regex: /Acompanha:\s*([^\n\r]+)/i, label: 'Acessório' },
    { regex: /Acompanha capa protetora/i, label: 'Acessório', fixedVal: 'Capa Protetora' },
  ];

  const highlights: ProductHighlight[] = [];
  let cleanText = normalized;

  for (const item of knownSpecs) {
    const match = cleanText.match(item.regex);
    if (match) {
      const val = item.fixedVal || match[1].replace(/^[•\-\s]+/, '').trim();
      highlights.push({ label: item.label, value: val });
      cleanText = cleanText.replace(match[0], '');
    }
  }

  // Remove títulos e resíduos de formatação
  cleanText = cleanText.replace(/Especifica[çc][õo]es\s*T[ée]cnicas:?/gi, '');
  cleanText = cleanText.replace(/^[•\-\s\n\r]+/, '');
  cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();

  return {
    highlights: highlights.slice(0, 6),
    cleanDescription: cleanText,
  };
}
