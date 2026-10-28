'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Product, Category } from '@/types';
import { Department, DEPARTMENTS } from '@/lib/data/departments';
import {
  Package,
  Layers,
  Tag,
  Link2,
  Check,
  Search,
  X,
  Flame,
  MessageCircle,
  ExternalLink,
  Ban,
  ArrowRight,
  Loader2,
  Plus,
} from 'lucide-react';

interface BannerDestinationPickerProps {
  link?: string;
  onChange: (newLink: string) => void;
  products: Product[];
  categories: Category[];
  departments?: Department[];
}

type DestinationType = 'line' | 'product' | 'tag' | 'custom' | 'none';

export function BannerDestinationPicker({
  link = '',
  onChange,
  products = [],
  categories = [],
  departments = DEPARTMENTS,
}: BannerDestinationPickerProps) {
  // Detecta o tipo a partir do link gravado
  const detectType = (val: string): DestinationType => {
    const clean = (val || '').trim();
    if (!clean) return 'none';
    if (
      clean.includes('product=') ||
      clean.includes('produto=') ||
      clean.startsWith('product:') ||
      clean.startsWith('produto:')
    ) {
      return 'product';
    }
    if (clean.includes('tag=') || clean.startsWith('tag:')) {
      return 'tag';
    }
    if (
      clean.includes('dept=') ||
      clean.includes('linha=') ||
      clean.includes('cat=') ||
      clean.includes('categoria=')
    ) {
      return 'line';
    }
    if (clean.includes('search=') || clean.startsWith('search:')) {
      return 'tag';
    }
    return 'custom';
  };

  const [activeType, setActiveType] = useState<DestinationType>(() => detectType(link));

  // Produtos locais com fallback caso a prop chegue vazia
  const [localProducts, setLocalProducts] = useState<Product[]>(products || []);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (products && products.length > 0) {
      setLocalProducts(products);
    } else {
      setLoadingProducts(true);
      fetch('/api/admin/products')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.products) && data.products.length > 0) {
            setLocalProducts(data.products);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingProducts(false));
    }
  }, [products]);

  const activeProducts = localProducts.length > 0 ? localProducts : products;

  // Estados locais para cada modalidade
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [isPickingProduct, setIsPickingProduct] = useState(false);

  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedCat, setSelectedCat] = useState('');

  const [selectedTag, setSelectedTag] = useState('');
  const [tagInput, setTagInput] = useState('');

  const [customUrl, setCustomUrl] = useState('');
  const [showTechnicalUrl, setShowTechnicalUrl] = useState(false);

  // Sincroniza estados a partir do link gravado
  useEffect(() => {
    const clean = (link || '').trim();
    const type = detectType(clean);
    setActiveType(type);

    if (type === 'product') {
      const qs = clean.includes('?') ? clean.substring(clean.indexOf('?') + 1) : clean;
      const params = new URLSearchParams(qs);
      const pid =
        params.get('product') ||
        params.get('produto') ||
        clean.replace(/^(?:\/|\?|product:|produto:)/, '').split('&')[0];
      setSelectedProductId(pid ? decodeURIComponent(pid).trim() : '');
      setIsPickingProduct(false);
    } else if (type === 'tag') {
      const qs = clean.includes('?') ? clean.substring(clean.indexOf('?') + 1) : clean;
      const params = new URLSearchParams(qs);
      const t =
        params.get('tag') ||
        params.get('search') ||
        clean.replace(/^(?:\/|\?|tag:|search:)/, '').split('&')[0];
      const decodedTag = t ? decodeURIComponent(t).trim() : '';
      setSelectedTag(decodedTag);
      setTagInput(decodedTag);
    } else if (type === 'line') {
      const qs = clean.includes('?') ? clean.substring(clean.indexOf('?') + 1) : clean;
      const params = new URLSearchParams(qs);
      setSelectedDept(params.get('dept') || params.get('linha') || 'all');
      setSelectedCat(params.get('cat') || params.get('categoria') || '');
    } else if (type === 'custom') {
      setCustomUrl(clean);
    }
  }, [link]);

  // Lista de todas as tags reais extraídas dos produtos do catálogo
  const catalogTags = useMemo(() => {
    const map = new Map<string, number>();
    activeProducts.forEach((p) => {
      (p.tags || []).forEach((t) => {
        const clean = t.trim();
        if (clean) {
          map.set(clean, (map.get(clean) || 0) + 1);
        }
      });
    });

    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [activeProducts]);

  // Tags filtradas pelo que o usuário digita
  const filteredTags = useMemo(() => {
    if (!tagInput.trim()) return catalogTags;
    const q = tagInput.toLowerCase().trim();
    return catalogTags.filter((t) => t.name.toLowerCase().includes(q));
  }, [catalogTags, tagInput]);

  // Produto selecionado atualmente
  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    const clean = selectedProductId.toLowerCase();
    return (
      activeProducts.find(
        (p) =>
          p.id?.toLowerCase() === clean ||
          p.slug?.toLowerCase() === clean ||
          p.code_sku?.toLowerCase() === clean ||
          String(p.legacy_id || '').toLowerCase() === clean
      ) || null
    );
  }, [selectedProductId, activeProducts]);

  // Busca de produtos por nome ou SKU
  const searchResults = useMemo(() => {
    if (!productSearch.trim()) return activeProducts.slice(0, 24);

    const q = productSearch.toLowerCase().trim();
    const tokens = q.split(/\s+/).filter(Boolean);

    return activeProducts
      .filter((p) => {
        const name = (p.name || '').toLowerCase();
        const sku = (p.code_sku || '').toLowerCase();
        const cat = (p.categories || []).map((c) => c.name.toLowerCase()).join(' ');
        const full = `${name} ${sku} ${cat}`;
        return tokens.every((token) => full.includes(token));
      })
      .slice(0, 30);
  }, [activeProducts, productSearch]);

  // Subcategorias disponíveis para a linha selecionada
  const availableCategories = useMemo(() => {
    if (!selectedDept || selectedDept === 'all' || selectedDept === 'lancamentos') {
      return categories;
    }
    const deptObj = departments.find((d) => d.id === selectedDept);
    if (!deptObj) return categories;
    return categories.filter((c) =>
      deptObj.categoryNames.some((n) => n.toLowerCase().trim() === c.name.toLowerCase().trim())
    );
  }, [categories, departments, selectedDept]);

  // Capa do produto
  const getProductCover = (p: Product) => {
    return (
      p.images?.find((img) => img.is_cover)?.public_url ||
      p.images?.[0]?.public_url ||
      p.images?.[0]?.legacy_url ||
      '/placeholder-product.svg'
    );
  };

  // Handlers para ações
  const handleSelectProduct = (p: Product) => {
    setSelectedProductId(p.id);
    setIsPickingProduct(false);
    setProductSearch('');
    onChange(`?product=${p.id}`);
  };

  const handleClearProduct = () => {
    setSelectedProductId('');
    setIsPickingProduct(true);
    onChange('');
  };

  const handleSelectDepartment = (deptId: string) => {
    setSelectedDept(deptId);
    setSelectedCat('');

    if (deptId === 'all') {
      onChange('?dept=all');
    } else {
      onChange(`?dept=${deptId}`);
    }
  };

  const handleToggleCategory = (catSlug: string) => {
    const nextCat = selectedCat === catSlug ? '' : catSlug;
    setSelectedCat(nextCat);

    const params = new URLSearchParams();
    if (selectedDept && selectedDept !== 'all') {
      params.set('dept', selectedDept);
    }
    if (nextCat) {
      params.set('cat', nextCat);
    }

    const query = params.toString();
    onChange(query ? `?${query}` : '?dept=all');
  };

  const handleSelectTag = (tagName: string) => {
    setSelectedTag(tagName);
    setTagInput(tagName);
    onChange(`?tag=${encodeURIComponent(tagName)}`);
  };

  const handleApplyCustomTag = () => {
    const clean = tagInput.trim();
    if (clean) {
      setSelectedTag(clean);
      onChange(`?tag=${encodeURIComponent(clean)}`);
    } else {
      setSelectedTag('');
      onChange('');
    }
  };

  const handleApplyCustomUrl = (url: string) => {
    setCustomUrl(url);
    onChange(url.trim());
  };

  const handleSetNone = () => {
    setActiveType('none');
    onChange('');
  };

  // Resumo inteligente da ação configurada
  const actionSummary = useMemo(() => {
    const clean = (link || '').trim();
    if (!clean) {
      return {
        badge: 'Apenas Imagem',
        title: 'Sem ação de clique',
        description: 'O banner será exibido na loja apenas como elemento visual decorativo.',
        isConfigured: false,
      };
    }

    if (
      clean.includes('product=') ||
      clean.includes('produto=') ||
      clean.startsWith('product:') ||
      clean.startsWith('produto:')
    ) {
      const prod = selectedProduct;
      return {
        badge: 'Produto',
        title: prod ? prod.name : `Produto (${selectedProductId})`,
        description:
          'Ao clicar no banner, abrirá imediatamente a janela de detalhes e tamanhos deste produto.',
        isConfigured: true,
      };
    }

    if (clean.includes('tag=') || clean.startsWith('tag:')) {
      const qs = clean.includes('?') ? clean.substring(clean.indexOf('?') + 1) : clean;
      const params = new URLSearchParams(qs);
      const tag = params.get('tag') || clean.replace(/^(?:\/|\?|tag:)/, '');
      const count = activeProducts.filter((p) =>
        (p.tags || []).some((t) => t.toLowerCase().trim() === tag.toLowerCase().trim())
      ).length;
      return {
        badge: 'Tag / Coleção',
        title: `Tag: "${tag}"`,
        description: `Ao clicar no banner, a vitrine será filtrada para os produtos com esta tag (${count} itens) e rolará automaticamente.`,
        isConfigured: true,
      };
    }

    if (clean.includes('dept=') || clean.includes('linha=') || clean.includes('cat=')) {
      const qs = clean.includes('?') ? clean.substring(clean.indexOf('?') + 1) : clean;
      const params = new URLSearchParams(qs);
      const deptId = params.get('dept') || params.get('linha');
      const catSlug = params.get('cat');

      const deptObj = departments.find((d) => d.id === deptId);
      const catObj = categories.find((c) => c.slug === catSlug);

      const parts: string[] = [];
      if (deptId === 'lancamentos') parts.push('🔥 Novidades & Lançamentos 2026');
      else if (deptId === 'all') parts.push('🌐 Todas as Linhas (Catálogo Geral)');
      else if (deptObj) parts.push(deptObj.name);

      if (catObj) parts.push(catObj.name);

      return {
        badge: 'Linha / Categoria',
        title: parts.length > 0 ? parts.join(' → ') : 'Catálogo Geral',
        description:
          'Ao clicar no banner, a vitrine será filtrada para esta linha/categoria com rolagem suave.',
        isConfigured: true,
      };
    }

    if (clean.startsWith('wa.me') || clean.includes('whatsapp') || clean.includes('wa.me')) {
      return {
        badge: 'WhatsApp',
        title: clean,
        description: 'Abre o WhatsApp Comercial da loja em uma nova janela para atendimento direto.',
        isConfigured: true,
      };
    }

    return {
      badge: 'Link Externo / URL',
      title: clean,
      description: clean.startsWith('http')
        ? 'Abre o link externo em uma nova aba do navegador.'
        : 'Navega para a rota configurada na loja.',
      isConfigured: true,
    };
  }, [link, selectedProduct, selectedProductId, departments, categories, activeProducts]);

  return (
    <div className="bg-slate-50/90 rounded-2xl border border-slate-200/90 p-4 sm:p-5 space-y-4">
      {/* 1. CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
        <div>
          <h4 className="text-xs sm:text-sm font-extrabold text-zeiq-black tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-zeiq-orange inline-block" />
            <span>Destino ao Clicar no Banner</span>
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Escolha o que acontece quando o cliente tocar neste banner na página inicial.
          </p>
        </div>

        {/* Status rápido */}
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold self-start sm:self-auto ${
            actionSummary.isConfigured
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-slate-100 text-slate-500 border border-slate-200'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              actionSummary.isConfigured ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
          />
          <span>{actionSummary.badge}</span>
        </span>
      </div>

      {/* 2. BOTÕES DE MODALIDADE (5 OPÇÕES SIMPLES E DIRETAS) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {/* Opção 1: Linha / Categoria */}
        <button
          type="button"
          onClick={() => {
            setActiveType('line');
            if (selectedDept) handleSelectDepartment(selectedDept);
          }}
          className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
            activeType === 'line'
              ? 'bg-zeiq-black text-white border-zeiq-black shadow-md ring-2 ring-zeiq-orange/20'
              : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50'
          }`}
        >
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              activeType === 'line' ? 'bg-white/10 text-zeiq-orange' : 'bg-sky-50 text-sky-600'
            }`}
          >
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold block leading-snug">Linha / Cat.</span>
            <span
              className={`text-[10px] block leading-tight ${
                activeType === 'line' ? 'text-slate-300' : 'text-slate-400'
              }`}
            >
              Conjunto
            </span>
          </div>
        </button>

        {/* Opção 2: Produto Específico */}
        <button
          type="button"
          onClick={() => {
            setActiveType('product');
            if (selectedProductId) {
              onChange(`?product=${selectedProductId}`);
            } else {
              setIsPickingProduct(true);
            }
          }}
          className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
            activeType === 'product'
              ? 'bg-zeiq-black text-white border-zeiq-black shadow-md ring-2 ring-zeiq-orange/20'
              : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50'
          }`}
        >
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              activeType === 'product' ? 'bg-white/10 text-zeiq-orange' : 'bg-amber-50 text-amber-600'
            }`}
          >
            <Package className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold block leading-snug">Produto</span>
            <span
              className={`text-[10px] block leading-tight ${
                activeType === 'product' ? 'text-slate-300' : 'text-slate-400'
              }`}
            >
              Abre direto
            </span>
          </div>
        </button>

        {/* Opção 3: Tag / Coleção */}
        <button
          type="button"
          onClick={() => {
            setActiveType('tag');
            if (selectedTag) handleSelectTag(selectedTag);
          }}
          className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
            activeType === 'tag'
              ? 'bg-zeiq-black text-white border-zeiq-black shadow-md ring-2 ring-zeiq-orange/20'
              : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50'
          }`}
        >
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              activeType === 'tag' ? 'bg-white/10 text-zeiq-orange' : 'bg-purple-50 text-purple-600'
            }`}
          >
            <Tag className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold block leading-snug">Tag / Coleção</span>
            <span
              className={`text-[10px] block leading-tight ${
                activeType === 'tag' ? 'text-slate-300' : 'text-slate-400'
              }`}
            >
              Filtro de tag
            </span>
          </div>
        </button>

        {/* Opção 4: Link / WhatsApp */}
        <button
          type="button"
          onClick={() => {
            setActiveType('custom');
            onChange(customUrl || 'https://wa.me/5516991667020');
          }}
          className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
            activeType === 'custom'
              ? 'bg-zeiq-black text-white border-zeiq-black shadow-md ring-2 ring-zeiq-orange/20'
              : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50'
          }`}
        >
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              activeType === 'custom' ? 'bg-white/10 text-zeiq-orange' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            <Link2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold block leading-snug">Link / Zap</span>
            <span
              className={`text-[10px] block leading-tight ${
                activeType === 'custom' ? 'text-slate-300' : 'text-slate-400'
              }`}
            >
              URL externa
            </span>
          </div>
        </button>

        {/* Opção 5: Sem Link (Apenas Imagem) */}
        <button
          type="button"
          onClick={handleSetNone}
          className={`p-2.5 sm:p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 col-span-2 sm:col-span-1 ${
            activeType === 'none'
              ? 'bg-zeiq-black text-white border-zeiq-black shadow-md ring-2 ring-zeiq-orange/20'
              : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50'
          }`}
        >
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              activeType === 'none' ? 'bg-white/10 text-zeiq-orange' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <Ban className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold block leading-snug">Sem Link</span>
            <span
              className={`text-[10px] block leading-tight ${
                activeType === 'none' ? 'text-slate-300' : 'text-slate-400'
              }`}
            >
              Apenas foto
            </span>
          </div>
        </button>
      </div>

      {/* 3. PAINEL DE CONTEÚDO DE ACORDO COM A OPÇÃO */}

      {/* PAINEL 1: LINHA OU CATEGORIA */}
      {activeType === 'line' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 animate-in fade-in duration-150">
          <div>
            <label className="text-xs font-bold text-zeiq-black block mb-2">
              1. Selecione a Linha Esportiva:
            </label>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => handleSelectDepartment('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedDept === 'all'
                    ? 'bg-zeiq-black text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                🌐 Catálogo Geral (Todas as Linhas)
              </button>

              <button
                type="button"
                onClick={() => handleSelectDepartment('lancamentos')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedDept === 'lancamentos'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5 fill-current" />
                <span>Novidades & Lançamentos 2026</span>
              </button>

              {departments.map((dept) => {
                const isSelected = selectedDept === dept.id;
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => handleSelectDepartment(dept.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-zeiq-black text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {dept.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subcategorias disponíveis */}
          {availableCategories.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-zeiq-black">
                  2. Filtrar por Categoria Específica (Opcional):
                </label>
                {selectedCat && (
                  <button
                    type="button"
                    onClick={() => handleToggleCategory(selectedCat)}
                    className="text-xs text-rose-600 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Limpar categoria</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1 bg-slate-50/70 rounded-xl border border-slate-200/80">
                {availableCategories.map((cat) => {
                  const isSelected = selectedCat === cat.slug;
                  return (
                    <button
                      key={cat.id || cat.slug}
                      type="button"
                      onClick={() => handleToggleCategory(cat.slug)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-sky-600 text-white font-bold shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PAINEL 2: PRODUTO ESPECÍFICO */}
      {activeType === 'product' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 animate-in fade-in duration-150">
          {selectedProduct && !isPickingProduct ? (
            /* Card do produto selecionado */
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                  <img
                    src={getProductCover(selectedProduct)}
                    alt={selectedProduct.name}
                    className="w-full h-full object-contain p-0.5"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {selectedProduct.code_sku && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-800">
                        SKU: {selectedProduct.code_sku}
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      Produto Vinculado
                    </span>
                  </div>
                  <strong className="text-xs sm:text-sm font-bold text-zeiq-black block truncate mt-0.5">
                    {selectedProduct.name}
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPickingProduct(true)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  Trocar
                </button>
                <button
                  type="button"
                  onClick={handleClearProduct}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Remover produto"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Busca de produtos */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zeiq-black">
                  Buscar Produto por Nome ou SKU:
                </label>
                {selectedProduct && (
                  <button
                    type="button"
                    onClick={() => setIsPickingProduct(false)}
                    className="text-xs text-slate-500 hover:underline cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Ex: Raquete Carbono 3K, 0214, Leo Branco, Camiseta..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => setProductSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Lista suspensa de produtos */}
              <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
                {loadingProducts && searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-zeiq-orange" />
                    <span>Carregando produtos...</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Nenhum produto localizado para "{productSearch}".
                  </div>
                ) : (
                  searchResults.map((p) => {
                    const isSelected = selectedProductId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProduct(p)}
                        className={`w-full p-2 text-left flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                          isSelected ? 'bg-amber-50/70' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-md bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                            <img
                              src={getProductCover(p)}
                              alt={p.name}
                              className="w-full h-full object-contain p-0.5"
                            />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-zeiq-black block truncate">
                              {p.name}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              {p.code_sku && <span className="font-mono">SKU: {p.code_sku}</span>}
                              {p.categories?.[0] && <span>• {p.categories[0].name}</span>}
                            </div>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 hover:bg-zeiq-black hover:text-white text-slate-700 shrink-0 transition-colors">
                          Selecionar
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PAINEL 3: TAG OU COLEÇÃO */}
      {activeType === 'tag' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 animate-in fade-in duration-150">
          <div>
            <label className="text-xs font-bold text-zeiq-black block mb-1.5">
              Escolha ou digite uma Tag para vincular ao banner:
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyCustomTag();
                    }
                  }}
                  placeholder="Ex: Leo Branco, Carbono 3K, Lançamentos, Beach Tennis..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
              </div>
              <button
                type="button"
                onClick={handleApplyCustomTag}
                className="px-3.5 py-2 rounded-xl bg-zeiq-black text-white text-xs font-bold hover:bg-zeiq-charcoal transition-colors cursor-pointer shrink-0"
              >
                Aplicar Tag
              </button>
            </div>
          </div>

          {/* Nuvem de tags reais do catálogo */}
          <div>
            <span className="text-[11px] text-slate-400 block mb-1.5">
              Tags cadastradas nos produtos (clique para selecionar):
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-1 bg-slate-50/70 rounded-xl border border-slate-200/80">
              {filteredTags.length === 0 ? (
                <span className="text-xs text-slate-400 italic p-1">
                  Nenhuma tag encontrada para "{tagInput}". Pressione "Aplicar Tag" para usar este termo.
                </span>
              ) : (
                filteredTags.map((t) => {
                  const isSelected = selectedTag.toLowerCase() === t.name.toLowerCase();
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => handleSelectTag(t.name)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-purple-600 text-white font-bold shadow-xs'
                          : 'bg-white hover:bg-purple-50 hover:text-purple-900 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <span>{t.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                          isSelected ? 'bg-purple-800 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {t.count}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* PAINEL 4: LINK LIVRE OU WHATSAPP */}
      {activeType === 'custom' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 animate-in fade-in duration-150">
          <div>
            <label className="text-xs font-bold text-zeiq-black block mb-1.5">
              URL Externa ou Rota Interna da Loja:
            </label>
            <div className="relative">
              <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={customUrl}
                onChange={(e) => handleApplyCustomUrl(e.target.value)}
                placeholder="Ex: https://wa.me/5516991667020 ou /portal"
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-zeiq-black font-mono focus:outline-none focus:ring-1 focus:ring-zeiq-black"
              />
            </div>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block mb-1.5">Atalhos rápidos:</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleApplyCustomUrl('https://wa.me/5516991667020')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp Comercial Zeiq</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyCustomUrl('/portal')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                Portal do Lojista (/portal)
              </button>
              <button
                type="button"
                onClick={() => handleApplyCustomUrl('#catalog-products-grid')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                Rolar para o Catálogo (#catalogo)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAINEL 5: SEM LINK (APENAS IMAGEM) */}
      {activeType === 'none' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center space-y-1 animate-in fade-in duration-150">
          <p className="text-xs font-bold text-slate-700">Banner sem ação de clique configurada.</p>
          <p className="text-[11px] text-slate-400">
            O banner será exibido na página inicial apenas como destaque visual.
          </p>
        </div>
      )}

      {/* 4. RESUMO INTELIGENTE & PREVIEW DA AÇÃO */}
      <div
        className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
          actionSummary.isConfigured
            ? 'bg-gradient-to-r from-zinc-900 to-slate-900 text-white border-zinc-800 shadow-md'
            : 'bg-white text-slate-700 border-slate-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                actionSummary.isConfigured
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.2 rounded ${
                    actionSummary.isConfigured
                      ? 'bg-white/10 text-zeiq-orange'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {actionSummary.badge}
                </span>
                <strong
                  className={`text-xs sm:text-sm font-bold block ${
                    actionSummary.isConfigured ? 'text-white' : 'text-zeiq-black'
                  }`}
                >
                  {actionSummary.title}
                </strong>
              </div>
              <p
                className={`text-[11px] mt-0.5 leading-snug ${
                  actionSummary.isConfigured ? 'text-slate-300' : 'text-slate-500'
                }`}
              >
                {actionSummary.description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowTechnicalUrl(!showTechnicalUrl)}
            className={`text-[11px] font-mono px-2 py-1 rounded transition-colors whitespace-nowrap self-start sm:self-auto cursor-pointer ${
              actionSummary.isConfigured
                ? 'text-slate-400 hover:text-white bg-white/5'
                : 'text-slate-500 hover:text-zeiq-black bg-slate-100'
            }`}
          >
            {showTechnicalUrl ? 'Ocultar Link' : 'Ver Link Bruto'}
          </button>
        </div>

        {/* Input manual técnico expansível */}
        {showTechnicalUrl && (
          <div className="mt-3 pt-2.5 border-t border-white/10 text-xs">
            <label className="block text-[10px] font-mono text-slate-400 mb-1">
              Link técnico gravado no banco de dados:
            </label>
            <input
              type="text"
              value={link}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Link bruto (ex: ?product=..., ?tag=..., https://...)"
              className="w-full px-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-lg text-emerald-300 font-mono focus:outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}
