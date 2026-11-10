'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Upload, FileSpreadsheet, Check, AlertCircle, Trash2, ArrowRight, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '@/types';
import { cleanSkuKey } from '@/lib/utils/pricing';

interface CampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSuccess: (msg?: string) => void;
}

interface ParsedPromoRow {
  sku: string;
  price: number;
  matchedProduct?: Product;
}

export function CampaignModal({ isOpen, onClose, products, onSuccess }: CampaignModalProps) {
  const [campaignName, setCampaignName] = useState('Campanha Black Friday');

  // Período oficial: 03/11/2026 até 30/11/2026
  const [startDate, setStartDate] = useState('2026-11-03');
  const [endDate, setEndDate] = useState('2026-11-30');

  // Controle de visualização do calendário customizado
  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(10); // 10 = Novembro (0-indexed)

  const [useOfficialFile, setUseOfficialFile] = useState(true);
  const [showCustomUpload, setShowCustomUpload] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setStartDate('2026-11-03');
      setEndDate('2026-11-30');
      setViewYear(2026);
      setViewMonth(10);
      setUseOfficialFile(true);
      setShowCustomUpload(false);
      setPastedText('');
    }
  }, [isOpen]);

  // Mapa de produtos por SKU para validação rápida
  const productBySkuMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => {
      if (p.code_sku) {
        map.set(cleanSkuKey(p.code_sku), p);
      }
      const m = p.name.match(/^([A-Z0-9\.\_\-]+)\s*[-–—]/i);
      if (m) {
        map.set(cleanSkuKey(m[1]), p);
      }
    });
    return map;
  }, [products]);

  // Parser de linhas para upload manual
  const parseRows = (text: string): ParsedPromoRow[] => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed: ParsedPromoRow[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0 && (line.toLowerCase().includes('sku') || line.toLowerCase().includes('produto') || line.toLowerCase().includes('preço') || line.toLowerCase().includes('preco'))) {
        continue;
      }

      let tokens: string[] = [];
      if (line.includes('\t')) tokens = line.split('\t').map((t) => t.trim());
      else if (line.includes(';')) tokens = line.split(';').map((t) => t.trim());
      else if (line.includes(',')) tokens = line.split(',').map((t) => t.trim());
      else tokens = line.split(/\s+/).map((t) => t.trim());

      if (tokens.length >= 2) {
        const skuToken = tokens[0].replace(/^"|"$/g, '').trim();
        let priceStr = tokens[tokens.length - 1].replace(/^"|"$/g, '').trim();
        if (!/[0-9]/.test(priceStr) && tokens.length > 2) {
          priceStr = tokens[1].replace(/^"|"$/g, '').trim();
        }

        const cleanStr = priceStr.replace(/R\$|\$/g, '').trim();
        const cleanNum = cleanStr.includes(',')
          ? parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'))
          : parseFloat(cleanStr);

        if (!isNaN(cleanNum) && cleanNum > 0 && skuToken) {
          const matched = productBySkuMap.get(cleanSkuKey(skuToken));
          parsed.push({ sku: skuToken, price: cleanNum, matchedProduct: matched });
        }
      }
    }
    return parsed;
  };

  const parsedItems = useMemo(() => {
    if (useOfficialFile) return [];
    return parseRows(pastedText);
  }, [pastedText, useOfficialFile, productBySkuMap]);

  const matchedCount = useOfficialFile ? 417 : parsedItems.filter((it) => !!it.matchedProduct).length;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result;
      if (typeof content === 'string') {
        setPastedText(content);
        setUseOfficialFile(false);
      }
    };
    reader.onerror = () => setErrorMsg('Falha ao ler o arquivo selecionado.');
    reader.readAsText(file, 'utf8');
  };

  // Navegação do Calendário Customizado Zeiq
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Cálculo da matriz de dias do calendário
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Domingo
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const handleDaySelect = (dayNum: number) => {
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(dayNum).padStart(2, '0');
    const clickedDate = `${viewYear}-${mStr}-${dStr}`;

    if (!startDate || (startDate && endDate)) {
      setStartDate(clickedDate);
      setEndDate('');
    } else if (startDate && !endDate) {
      if (clickedDate < startDate) {
        setEndDate(startDate);
        setStartDate(clickedDate);
      } else {
        setEndDate(clickedDate);
      }
    }
  };

  const formatDateShort = (iso?: string | null) => {
    if (!iso) return '--/--/----';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!useOfficialFile && parsedItems.length === 0) {
      setErrorMsg('Nenhum item válido identificado. Utilize a planilha oficial ou informe os itens.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const payload = {
        campaign_name: campaignName.trim() || 'Campanha Black Friday',
        promo_start_at: startDate ? new Date(`${startDate}T00:00:00`).toISOString() : null,
        promo_end_at: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : null,
        use_official_file: useOfficialFile,
        items: useOfficialFile ? [] : parsedItems.map((it) => ({
          sku: it.sku,
          id: it.matchedProduct?.id,
          promotional_price: it.price,
        })),
      };

      const res = await fetch('/api/admin/promotions/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao aplicar campanha.');
      }

      onSuccess(data.message || `Campanha ativada para ${matchedCount} produtos com sucesso!`);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar campanha.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearAllPromotions = async () => {
    if (!confirm('Deseja realmente encerrar a campanha e limpar todos os preços promocionais dos produtos?')) {
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/admin/promotions/batch', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao encerrar promoções.');
      }

      onSuccess('Todas as promoções foram canceladas com sucesso.');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao encerrar promoções.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Limpo Zeiq */}
        <div className="px-5 py-4 bg-zeiq-black text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🔥</span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight leading-none">
                Campanha Black Friday
              </h3>
              <p className="text-[11px] text-zinc-400 mt-1">
                Configure as datas e ative os preços promocionais no catálogo.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário Enxuto e Otimizado */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. SEÇÃO DE PERÍODO COM CALENDÁRIO VISUAL CUSTOMIZADO (ZERO POPUPS NATIVOS) */}
          <div className="p-4 bg-[#f8f9fa] rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                Vigência da Promoção
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                {startDate && endDate ? `${formatDateShort(startDate)} a ${formatDateShort(endDate)}` : 'Período Contínuo'}
              </span>
            </div>

            {/* Painel do Calendário Customizado Zeiq */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
              {/* Barra do Mês / Navegação */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="font-bold text-slate-900 text-xs">
                  {monthNames[viewMonth]} de {viewYear}
                </span>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Dias da Semana */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>D</span>
                <span>S</span>
                <span>T</span>
                <span>Q</span>
                <span>Q</span>
                <span>S</span>
                <span>S</span>
              </div>

              {/* Grade dos Dias do Mês */}
              <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 text-center text-xs">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`blank-${i}`} className="h-7" />
                ))}

                {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const mStr = String(viewMonth + 1).padStart(2, '0');
                  const dStr = String(dayNum).padStart(2, '0');
                  const thisDate = `${viewYear}-${mStr}-${dStr}`;

                  const isStart = thisDate === startDate;
                  const isEnd = thisDate === endDate;
                  const inRange = startDate && endDate && thisDate > startDate && thisDate < endDate;

                  return (
                    <button
                      key={`day-${dayNum}`}
                      type="button"
                      onClick={() => handleDaySelect(dayNum)}
                      className={`h-7 text-[11px] font-bold transition-colors cursor-pointer select-none flex items-center justify-center ${
                        isStart && isEnd
                          ? 'bg-emerald-600 text-white rounded-md shadow-xs'
                          : isStart
                          ? 'bg-emerald-600 text-white rounded-l-md shadow-xs'
                          : isEnd
                          ? 'bg-emerald-600 text-white rounded-r-md shadow-xs'
                          : inRange
                          ? 'bg-emerald-50 text-emerald-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-100 rounded-md'
                      }`}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Clique no 1º dia e no último dia para ajustar o intervalo.</span>
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('2026-11-03');
                    setEndDate('2026-11-30');
                    setViewMonth(10);
                    setViewYear(2026);
                  }}
                  className="font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Restaurar 03/11 a 30/11
                </button>
              </div>
            </div>
          </div>

          {/* 2. SEÇÃO DE PLANILHA (SEM DUPLICIDADES OU TEXTOS REPETIDOS) */}
          <div className="p-4 bg-[#f8f9fa] rounded-2xl border border-slate-200/80 space-y-2.5">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-zeiq-orange" />
              Tabela de Preços Promocionais
            </span>

            {/* Card Único e Direto da Planilha Oficial */}
            <div className="p-3 bg-white rounded-xl border border-emerald-300 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xl shrink-0">📊</span>
                <div className="min-w-0">
                  <span className="font-bold text-slate-900 block truncate text-xs">
                    Revenda_Black.xlsx
                  </span>
                  <span className="text-[11px] text-emerald-800 font-medium block">
                    {matchedCount} produtos mapeados com a coluna <strong>PREÇO NOVO</strong>
                  </span>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px] shrink-0">
                ✓ Pronta
              </span>
            </div>

            {/* Opção Secundária Discreta (Upload manual caso queira trocar) */}
            <div className="pt-1">
              {!showCustomUpload ? (
                <button
                  type="button"
                  onClick={() => setShowCustomUpload(true)}
                  className="text-[11px] text-slate-500 hover:text-zeiq-black font-semibold underline cursor-pointer"
                >
                  + Deseja subir outra planilha ou colar dados do Excel?
                </button>
              ) : (
                <div className="mt-2 p-3 bg-white rounded-xl border border-slate-200 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">Subir Arquivo Personalizado</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomUpload(false);
                        setUseOfficialFile(true);
                      }}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <input
                    type="file"
                    accept=".csv,.txt,.tsv"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                  />

                  <textarea
                    rows={3}
                    value={pastedText}
                    onChange={(e) => {
                      setPastedText(e.target.value);
                      setUseOfficialFile(false);
                    }}
                    placeholder="Ou cole aqui (SKU e Preço Promocional):&#10;208.025	49,90"
                    className="w-full p-2 font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Rodapé e Botões de Ação */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleClearAllPromotions}
              disabled={saving}
              className="text-rose-600 hover:text-rose-800 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Encerrar Campanha</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving || (!useOfficialFile && parsedItems.length === 0)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Ativando...</span>
                  </>
                ) : (
                  <>
                    <span>Ativar Black Friday ({matchedCount} Produtos)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
