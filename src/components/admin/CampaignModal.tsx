'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Upload, FileSpreadsheet, Check, AlertCircle, Trash2, ArrowRight, Loader2, Sparkles, Zap, Flame } from 'lucide-react';
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
  
  // Período oficial solicitado: 03/11/2026 até 30/11/2026 (fim do mês)
  const defaultStart = '2026-11-03';
  const defaultEnd = '2026-11-30';

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [pastedText, setPastedText] = useState('');
  const [activeTab, setActiveTab] = useState<'official' | 'upload' | 'paste'>('official');
  const [useOfficialFile, setUseOfficialFile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setStartDate(defaultStart);
      setEndDate(defaultEnd);
      setCampaignName('Campanha Black Friday');
      setUseOfficialFile(true);
      setActiveTab('official');
      setPastedText('');
    }
  }, [isOpen]);

  // Mapa de produtos por SKU para validação instantânea
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

  // Parser resiliente de linhas de planilha (suporta Tabulação do Excel, Ponto e Vírgula e Vírgula)
  const parseRows = (text: string): ParsedPromoRow[] => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed: ParsedPromoRow[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Ignora linha de cabeçalho comum
      if (i === 0 && (line.toLowerCase().includes('sku') || line.toLowerCase().includes('produto') || line.toLowerCase().includes('preço') || line.toLowerCase().includes('preco'))) {
        continue;
      }

      let tokens: string[] = [];
      if (line.includes('\t')) {
        tokens = line.split('\t').map((t) => t.trim());
      } else if (line.includes(';')) {
        tokens = line.split(';').map((t) => t.trim());
      } else if (line.includes(',')) {
        tokens = line.split(',').map((t) => t.trim());
      } else {
        tokens = line.split(/\s+/).map((t) => t.trim());
      }

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
          parsed.push({
            sku: skuToken,
            price: cleanNum,
            matchedProduct: matched,
          });
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
        setActiveTab('paste');
      }
    };

    reader.onerror = () => {
      setErrorMsg('Falha ao ler o arquivo selecionado.');
    };

    reader.readAsText(file, 'utf8');
  };

  const handlePresetDate = (type: 'black_friday' | 'novembro' | '30days' | 'continuous') => {
    if (type === 'black_friday') {
      setStartDate('2026-11-03');
      setEndDate('2026-11-30');
      setCampaignName('Campanha Black Friday');
    } else if (type === 'novembro') {
      setStartDate('2026-11-01');
      setEndDate('2026-11-30');
      setCampaignName('Novembro Promocional');
    } else if (type === '30days') {
      const today = new Date().toISOString().slice(0, 10);
      const next30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      setStartDate(today);
      setEndDate(next30);
      setCampaignName('Campanha 30 Dias');
    } else if (type === 'continuous') {
      setStartDate('');
      setEndDate('');
      setCampaignName('Promoção Contínua');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!useOfficialFile && parsedItems.length === 0) {
      setErrorMsg('Nenhum item válido identificado. Escolha a planilha oficial ou informe os itens.');
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
        throw new Error(data.error || 'Erro ao aplicar campanha promocional.');
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

  // Helper para formatar data em português sem popovers
  const formatDateLabel = (isoDate: string) => {
    if (!isoDate) return 'Não definida';
    const [year, month, day] = isoDate.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${day} de ${months[parseInt(month, 10) - 1]} de ${year}`;
  };

  // Status dinâmico da campanha
  const getStatusBadge = () => {
    if (!startDate && !endDate) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Ativa Continuamente (Sem prazo de encerramento)
        </span>
      );
    }
    const now = new Date().toISOString().slice(0, 10);
    if (startDate && now < startDate) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">
          ⏳ Agendada (iniciará em {formatDateLabel(startDate)})
        </span>
      );
    }
    if (endDate && now > endDate) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
          ⏹️ Período Encerrado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
        🔥 Campanha Ativa Agora (Vigente até 30 de Novembro)
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho de Alto Contraste Zeiq */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950 via-zinc-900 to-zeiq-black text-white flex items-center justify-between shrink-0 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl shadow-inner border border-emerald-500/30">
              🔥
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight flex items-center gap-2">
                <span>Campanha Promocional & Black Friday</span>
              </h3>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                Programe o período e configure a tabela de preços especiais para os lojistas.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Scroll Suave */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. SEÇÃO DE PERÍODO & ATALHOS RÁPIDOS DE 1 CLIQUE */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-bold text-zeiq-black text-xs flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                Período da Promoção (Ativação Automática)
              </span>
              <div>{getStatusBadge()}</div>
            </div>

            {/* Atalhos Rápidos - 1 Clique */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5">
                Atalhos de Período Rápido:
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePresetDate('black_friday')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    startDate === '2026-11-03' && endDate === '2026-11-30'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  ⚡ Black Friday Oficial (03/11 a 30/11)
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetDate('novembro')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    startDate === '2026-11-01' && endDate === '2026-11-30'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  📅 Mês de Novembro (01 a 30)
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetDate('30days')}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-white text-slate-700 border border-slate-200 hover:border-slate-300"
                >
                  🗓️ Próximos 30 dias
                </button>

                <button
                  type="button"
                  onClick={() => handlePresetDate('continuous')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    !startDate && !endDate
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  ♾️ Contínua (Sem data final)
                </button>
              </div>
            </div>

            {/* Painel Duplo com Visual Zeiq (Sem dependência do popover feio do navegador) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Início da Campanha
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-zeiq-black cursor-pointer"
                  />
                </div>
                <span className="text-[11px] text-emerald-700 font-semibold mt-1 block">
                  {formatDateLabel(startDate)}
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Término da Campanha
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-zeiq-black cursor-pointer"
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-semibold mt-1 block">
                  {formatDateLabel(endDate)}
                </span>
              </div>
            </div>
          </div>

          {/* 2. SELEÇÃO DA PLANILHA DE PREÇOS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-bold text-zeiq-black text-xs flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-zeiq-orange" />
                Planilha de Preços Promocionais (Coluna PREÇO NOVO)
              </span>

              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setUseOfficialFile(true);
                    setActiveTab('official');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    activeTab === 'official' ? 'bg-zeiq-black text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Planilha Oficial
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUseOfficialFile(false);
                    setActiveTab('upload');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    activeTab === 'upload' ? 'bg-zeiq-black text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Subir Arquivo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUseOfficialFile(false);
                    setActiveTab('paste');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    activeTab === 'paste' ? 'bg-zeiq-black text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Colar do Excel
                </button>
              </div>
            </div>

            {/* ABA 1: Planilha Oficial Revenda_Black.xlsx */}
            {activeTab === 'official' && (
              <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg shrink-0 shadow-xs">
                    📊
                  </div>
                  <div>
                    <strong className="block font-bold text-emerald-950 text-xs">
                      docs/Revenda_Black.xlsx (Planilha Oficial da Black Friday)
                    </strong>
                    <span className="text-[11px] text-emerald-800 block mt-0.5">
                      417 produtos mapeados no catálogo com os valores da coluna <strong>PREÇO NOVO</strong>.
                    </span>
                  </div>
                </div>

                <div className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-2xs">
                  <Check className="w-4 h-4" />
                  <span>Pronta para aplicar</span>
                </div>
              </div>
            )}

            {/* ABA 2: Upload de Novo Arquivo */}
            {activeTab === 'upload' && (
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl bg-slate-50/60 hover:bg-emerald-50/30 transition-all cursor-pointer text-center group">
                <Upload className="w-8 h-8 text-slate-400 group-hover:text-emerald-600 transition-colors mb-2" />
                <span className="font-bold text-slate-700 group-hover:text-emerald-950 text-xs">
                  Clique para selecionar outra planilha (.csv ou .txt)
                </span>
                <span className="text-[11px] text-slate-400 mt-1">
                  Colunas: Código do Produto e Preço Promocional
                </span>
                <input
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}

            {/* ABA 3: Colar direto do Excel */}
            {activeTab === 'paste' && (
              <div>
                <textarea
                  rows={5}
                  value={pastedText}
                  onChange={(e) => {
                    setPastedText(e.target.value);
                    setUseOfficialFile(false);
                  }}
                  placeholder={`Cole aqui as colunas copiadas do seu Excel:\n208.025\t49,90\n208.011\t49,90\n401.021\t49,90`}
                  className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Dica: Basta copiar as colunas de SKU e PREÇO NOVO no Excel e colar com Ctrl+V aqui.
                </span>
              </div>
            )}
          </div>

          {/* 3. RESUMO E PRÉ-VISUALIZAÇÃO */}
          {!useOfficialFile && parsedItems.length > 0 && (
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  {matchedCount} produtos reconhecidos no catálogo ({parsedItems.length} linhas na planilha)
                </span>
                {parsedItems.length > matchedCount && (
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    {parsedItems.length - matchedCount} SKUs não encontrados
                  </span>
                )}
              </div>

              <div className="max-h-36 overflow-y-auto bg-white rounded-xl border border-emerald-200 text-[11px]">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-1.5 px-3">SKU</th>
                      <th className="py-1.5 px-3">Produto Localizado</th>
                      <th className="py-1.5 px-3">Preço Regular</th>
                      <th className="py-1.5 px-3 text-right">Novo Promo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {parsedItems.slice(0, 6).map((it, idx) => (
                      <tr key={idx} className={it.matchedProduct ? 'hover:bg-slate-50/50' : 'bg-rose-50/40 text-rose-600'}>
                        <td className="py-1.5 px-3 font-bold">{it.sku}</td>
                        <td className="py-1.5 px-3 font-sans truncate max-w-xs">
                          {it.matchedProduct ? it.matchedProduct.name : 'SKU não localizado no catálogo'}
                        </td>
                        <td className="py-1.5 px-3 text-slate-400">
                          {it.matchedProduct?.price ? `R$ ${it.matchedProduct.price.toFixed(2).replace('.', ',')}` : '-'}
                        </td>
                        <td className="py-1.5 px-3 text-right font-black text-emerald-700">
                          R$ {it.price.toFixed(2).replace('.', ',')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Rodapé e Botões de Ação */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={handleClearAllPromotions}
              disabled={saving}
              className="px-3 py-2 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Encerrar / Limpar Promoções</span>
            </button>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving || (!useOfficialFile && parsedItems.length === 0)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer active:scale-95"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Aplicando...</span>
                  </>
                ) : (
                  <>
                    <span>Ativar Campanha para {matchedCount} Produtos</span>
                    <ArrowRight className="w-4 h-4" />
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
