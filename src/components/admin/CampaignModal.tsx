'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Upload, FileSpreadsheet, Check, AlertCircle, Trash2, ArrowRight, Loader2, Sparkles } from 'lucide-react';
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
  
  // Período padrão: Hoje até +30 dias (1 mês completo)
  const defaultStart = new Date().toISOString().slice(0, 10);
  const defaultEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [pastedText, setPastedText] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
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
        // O preço pode ser o segundo token ou o último token
        let priceStr = tokens[tokens.length - 1].replace(/^"|"$/g, '').trim();
        // Se o último token não parecer número, tenta o segundo
        if (!/[0-9]/.test(priceStr) && tokens.length > 2) {
          priceStr = tokens[1].replace(/^"|"$/g, '').trim();
        }

        const cleanNum = parseFloat(priceStr.replace(/R\$|\$/g, '').trim().replace(/\./g, '').replace(',', '.'));
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
    return parseRows(pastedText);
  }, [pastedText, productBySkuMap]);

  const matchedCount = parsedItems.filter((it) => !!it.matchedProduct).length;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    const reader = new FileReader();

    reader.onload = (evt) => {
      const content = evt.target?.result;
      if (typeof content === 'string') {
        setPastedText(content);
        setActiveTab('paste');
      }
    };

    reader.onerror = () => {
      setErrorMsg('Falha ao ler o arquivo selecionado.');
    };

    reader.readAsText(file, 'utf8');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedItems.length === 0) {
      setErrorMsg('Nenhum item válido identificado na planilha. Verifique as colunas de SKU e Preço.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const payload = {
        campaign_name: campaignName.trim() || 'Campanha Black Friday',
        promo_start_at: startDate ? new Date(`${startDate}T00:00:00`).toISOString() : null,
        promo_end_at: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : null,
        items: parsedItems.map((it) => ({
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

      onSuccess(data.message || `${matchedCount} produtos atualizados com sucesso!`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950 via-zinc-900 to-zeiq-black text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl shadow-inner border border-white/10">
              🔥
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight flex items-center gap-2">
                <span>Campanha Promocional & Black Friday</span>
              </h3>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                Programe o período e importe a planilha de preços especiais para os lojistas.
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

        {/* Corpo com Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Nome e Período de Vigência da Campanha (1 Mês ou Personalizado) */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zeiq-black text-xs flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                Vigência & Período da Campanha (Ativação Automática)
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
                Sugerido: 1 Mês
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Nome da Campanha
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Ex: Black Friday 2026"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Data de Início
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Data de Término
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Durante este intervalo, os lojistas verão os preços promocionais como o valor oficial de compra no catálogo. Após a data final, o catálogo volta automaticamente aos preços normais.
            </p>
          </div>

          {/* 2. Importação da Planilha de Preços */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-bold text-zeiq-black text-xs flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-zeiq-orange" />
                Planilha de Preços Promocionais (SKU e Novo Preço)
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    activeTab === 'upload' ? 'bg-zeiq-black text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Subir Arquivo
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('paste')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    activeTab === 'paste' ? 'bg-zeiq-black text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Colar do Excel
                </button>
              </div>
            </div>

            {activeTab === 'upload' ? (
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl bg-slate-50/60 hover:bg-emerald-50/30 transition-all cursor-pointer text-center group">
                <Upload className="w-8 h-8 text-slate-400 group-hover:text-emerald-600 transition-colors mb-2" />
                <span className="font-bold text-slate-700 group-hover:text-emerald-950 text-xs">
                  Clique para selecionar sua planilha (.csv ou .txt)
                </span>
                <span className="text-[11px] text-slate-400 mt-1">
                  Colunas esperadas: SKU / Código e Preço Promocional
                </span>
                <input
                  type="file"
                  accept=".csv,.txt,.tsv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            ) : (
              <div>
                <textarea
                  rows={5}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`Cole aqui as colunas copiadas do seu Excel:\n208.025\t49,90\n208.011\t49,90\n401.021\t49,90`}
                  className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Dica: Basta copiar as 2 colunas no Excel (SKU e Preço Promocional) e colar com Ctrl+V aqui.
                </span>
              </div>
            )}
          </div>

          {/* 3. Pré-visualização e Cruzamento dos Produtos */}
          {parsedItems.length > 0 && (
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

              {/* Tabela de Preview (Primeiros 5 itens) */}
              <div className="max-h-40 overflow-y-auto bg-white rounded-xl border border-emerald-200 text-[11px]">
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
                    {parsedItems.slice(0, 8).map((it, idx) => (
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
                disabled={saving || parsedItems.length === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer active:scale-95"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Aplicando...</span>
                  </>
                ) : (
                  <>
                    <span>Aplicar {matchedCount} Preços de Campanha</span>
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
