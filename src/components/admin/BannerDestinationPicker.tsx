'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Product, Category } from '@/types';
import { Department, DEPARTMENTS } from '@/lib/data/departments';
import {
  Package,
  Layers,
  Search,
  Link2,
  Check,
  ChevronDown,
  Sparkles,
  ExternalLink,
  Info,
  Flame,
  Shirt,
  Dumbbell,
  Tag,
  CircleDot,
  X,
  ArrowRight,
  RefreshCw,
  Plus,
} from 'lucide-react';

interface BannerDestinationPickerProps {
  link?: string;
  onChange: (newLink: string) => void;
  products: Product[];
  categories: Category[];
  departments?: Department[];
}

type DestinationType = 'category' | 'product' | 'search' | 'custom';

export function BannerDestinationPicker({
  link = '',
  onChange,
  products = [],
  categories = [],
  departments = DEPARTMENTS,
}: BannerDestinationPickerProps) {
  // Detecta o modo inicial a partir do link gravado
  const detectInitialType = (val: string): DestinationType => {
    const clean = (val || '').trim();
    if (!clean) return 'category';
    if (clean.includes('product=') || clean.startsWith('product:')) return 'product';
    if (clean.includes('dept=') || clean.includes('cat=')) return 'category';
    if (clean.includes('search=')) return 'search';
    return 'custom';
  };

  const [activeType, setActiveType] = useState<DestinationType>(() => detectInitialType(link));
  
  // Estados para Produto Específico
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [isPickingProduct, setIsPickingProduct] = useState(false);

  // Estados para Linha / Conjunto / Categoria
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedCat, setSelectedCat] = useState('');
  const [catSearch, setCatSearch] = useState('');

  // Estados para Busca / Palavra-chave
  const [searchQuery, setSearchQuery] = useState('');

  // Estados para Link Livre
  const [customUrl, setCustomUrl] = useState('');

  // Toggle do parâmetro técnico
  const [showTechnicalUrl, setShowTechnicalUrl] = useState(false);

  // Sincroniza dados internos caso a prop `link` seja alterada externamente
  useEffect(() => {
    const clean = (link || '').trim();
    const detected = detectInitialType(clean);
    setActiveType(detected);

    if (detected === 'product') {
      const match = clean.match(/(?:product=|product:)([^&]+)/);
      if (match && match[1]) {
        setSelectedProductId(match[1]);
        setIsPickingProduct(false);
      }
    } else if (detected === 'category') {
      const qs = clean.includes('?') ? clean.substring(clean.indexOf('?') + 1) : clean;
      const params = new URLSearchParams(qs);
      setSelectedDept(params.get('dept') || 'all');
      setSelectedCat(params.get('cat') || '');
    } else if (detected === 'search') {
      const qs = clean.includes('?') ? clean.substring(clean.indexOf('?') + 1) : clean;
      const params = new URLSearchParams(qs);
      setSearchQuery(params.get('search') || '');
    } else if (detected === 'custom') {
      setCustomUrl(clean);
    }
  }, [link]);

  // Objeto do produto selecionado atualmente
  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find((p) => p.id === selectedProductId || p.slug === selectedProductId) || null;
  }, [selectedProductId, products]);

  // Lista de produtos filtrada para seleção na combobox
  const searchResults = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 30);
    const q = productSearch.toLowerCase().trim();
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || (p.code_sku && p.code_sku.toLowerCase().includes(q)))
      .slice(0, 50);
  }, [products, productSearch]);

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

  // Categoria atualmente selecionada como objeto
  const selectedCatObj = useMemo(() => {
    if (!selectedCat) return null;
    return categories.find((c) => c.slug === selectedCat || c.id === selectedCat) || null;
  }, [selectedCat, categories]);

  // Subcategorias filtradas pela busca por palavra digitada
  const filteredSubcategories = useMemo(() => {
    if (!catSearch.trim()) return [];
    const q = catSearch.toLowerCase().trim();
    return availableCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [availableCategories, catSearch]);

  // Quantidade de produtos que batem com o termo de busca atual
  const searchMatchCount = useMemo(() => {
    if (!searchQuery.trim()) return 0;
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => p.name.toLowerCase().includes(q)).length;
  }, [products, searchQuery]);

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
    setSelectedCat(''); // Reseta subcategoria ao trocar de linha

    if (deptId === 'all') {
      onChange('');
    } else {
      onChange(`?dept=${deptId}`);
    }
  };

  const handleSelectCategory = (catSlug: string) => {
    setSelectedCat(catSlug);

    const params = new URLSearchParams();
    if (selectedDept && selectedDept !== 'all') {
      params.set('dept', selectedDept);
    }
    if (catSlug) {
      params.set('cat', catSlug);
    }

    const queryStr = params.toString();
    onChange(queryStr ? `?${queryStr}` : '');
  };

  const handleApplySearch = (term: string) => {
    setSearchQuery(term);
    const clean = term.trim();
    if (clean) {
      onChange(`?search=${encodeURIComponent(clean)}`);
    } else {
      onChange('');
    }
  };

  const handleApplyCustomUrl = (url: string) => {
    setCustomUrl(url);
    onChange(url.trim());
  };

  // Helper para obter capa do produto
  const getProductCover = (p: Product) => {
    return (
      p.images?.find((img) => img.is_cover)?.public_url ||
      p.images?.[0]?.public_url ||
      p.images?.[0]?.legacy_url ||
      '/placeholder-product.svg'
    );
  };

  // Resumo inteligente da ação do banner
  const actionSummary = useMemo(() => {
    const clean = (link || '').trim();
    if (!clean) {
      return {
        badge: 'Sem Ação',
        title: 'Nenhum destino configurado',
        description: 'O banner será exibido na página inicial apenas como destaque visual, sem ação de clique.',
        isConfigured: false,
      };
    }

    if (clean.includes('product=') || clean.startsWith('product:')) {
      const prod = selectedProduct;
      return {
        badge: 'Produto Específico',
        title: prod ? prod.name : `Produto ID: ${selectedProductId}`,
        description: 'Ao tocar no banner na loja, abrirá imediatamente a janela de detalhes e tamanhos deste produto.',
        isConfigured: true,
      };
    }

    if (clean.includes('dept=') || clean.includes('cat=')) {
      const qs = clean.includes('?') ? clean.substring(clean.indexOf('?') + 1) : clean;
      const params = new URLSearchParams(qs);
      const deptId = params.get('dept');
      const catSlug = params.get('cat');
      const deptObj = departments.find((d) => d.id === deptId);
      const catObj = categories.find((c) => c.slug === catSlug);

      const parts: string[] = [];
      if (deptId === 'lancamentos') parts.push('🔥 Novidades & Lançamentos 2026');
      else if (deptObj) parts.push(deptObj.name);
      else if (deptId) parts.push(deptId);

      if (catObj) parts.push(catObj.name);

      return {
        badge: 'Conjunto de Produtos',
        title: parts.length > 0 ? parts.join(' → ') : 'Catálogo Geral Completo',
        description: 'Ao tocar no banner, a vitrine será filtrada para essa linha/categoria com rolagem suave até os produtos.',
        isConfigured: true,
      };
    }

    if (clean.includes('search=')) {
      const qs = clean.includes('?') ? clean.substring(clean.indexOf('?') + 1) : clean;
      const params = new URLSearchParams(qs);
      const term = params.get('search') || '';
      return {
        badge: 'Busca por Palavra-Chave',
        title: `Coleção / Termo: "${term}"`,
        description: `Ao tocar no banner, a vitrine buscará por "${term}" e rolará automaticamente até os itens encontrados (${searchMatchCount} produtos).`,
        isConfigured: true,
      };
    }

    return {
      badge: 'Link Externo / URL',
      title: clean,
      description: clean.startsWith('http')
        ? 'Abre o link externo em uma nova aba do navegador.'
        : 'Navega para a rota interna configurada na loja.',
      isConfigured: true,
    };
  }, [link, selectedProduct, selectedProductId, departments, categories, searchMatchCount]);

  return (
    <div className="bg-slate-50/80 rounded-2xl border border-slate-200/90 p-4 sm:p-5 space-y-4">
      
      {/* 1. CABEÇALHO DO SELETOR DE DESTINO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
        <div>
          <h4 className="text-xs sm:text-sm font-extrabold text-zeiq-black tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-zeiq-orange inline-block" />
            <span>Destino ao Clicar no Banner</span>
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Defina o que o cliente verá ao tocar neste banner na página inicial.
          </p>
        </div>

        {/* Status rápido do destino */}
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold self-start sm:self-auto ${
          actionSummary.isConfigured
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-slate-100 text-slate-500 border border-slate-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${actionSummary.isConfigured ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          <span>{actionSummary.badge}</span>
        </span>
      </div>

      {/* 2. ABAS DE MODALIDADE DE DESTINO (ESTILO PILULAS PREMIUM) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveType('category');
            if (selectedDept && selectedDept !== 'all') {
              handleSelectCategory(selectedCat);
            }
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
            activeType === 'category'
              ? 'bg-zeiq-black text-white border-zeiq-black shadow-md ring-2 ring-zeiq-orange/20'
              : 'bg-white text-slate-700 border-slate-200/80 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            activeType === 'category' ? 'bg-white/10 text-zeiq-orange' : 'bg-sky-50 text-sky-600'
          }`}>
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold block leading-snug">Linha & Categoria</span>
            <span className={`text-[10px] block leading-tight ${activeType === 'category' ? 'text-slate-300' : 'text-slate-400'}`}>
              Conjunto de produtos
            </span>
          </div>
        </button>

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
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
            activeType === 'product'
              ? 'bg-zeiq-black text-white border-zeiq-black shadow-md ring-2 ring-zeiq-orange/20'
              : 'bg-white text-slate-700 border-slate-200/80 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            activeType === 'product' ? 'bg-white/10 text-zeiq-orange' : 'bg-amber-50 text-amber-600'
          }`}>
            <Package className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold block leading-snug">Produto Específico</span>
            <span className={`text-[10px] block leading-tight ${activeType === 'product' ? 'text-slate-300' : 'text-slate-400'}`}>
              Abre o item na hora
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveType('search');
            if (searchQuery) handleApplySearch(searchQuery);
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
            activeType === 'search'
              ? 'bg-zeiq-black text-white border-zeiq-black shadow-md ring-2 ring-zeiq-orange/20'
              : 'bg-white text-slate-700 border-slate-200/80 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            activeType === 'search' ? 'bg-white/10 text-zeiq-orange' : 'bg-purple-50 text-purple-600'
          }`}>
            <Search className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold block leading-snug">Coleção & Busca</span>
            <span className={`text-[10px] block leading-tight ${activeType === 'search' ? 'text-slate-300' : 'text-slate-400'}`}>
              Termos e linhas
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveType('custom');
            onChange(customUrl);
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
            activeType === 'custom'
              ? 'bg-zeiq-black text-white border-zeiq-black shadow-md ring-2 ring-zeiq-orange/20'
              : 'bg-white text-slate-700 border-slate-200/80 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            activeType === 'custom' ? 'bg-white/10 text-zeiq-orange' : 'bg-emerald-50 text-emerald-600'
          }`}>
            <Link2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold block leading-snug">Link Externo / URL</span>
            <span className={`text-[10px] block leading-tight ${activeType === 'custom' ? 'text-slate-300' : 'text-slate-400'}`}>
              WhatsApp ou rota
            </span>
          </div>
        </button>
      </div>

      {/* 3. CONTEÚDO ESPECÍFICO DE CADA MODALIDADE */}

      {/* PAINEL 1: LINHA & CATEGORIA (CHIPS VISUAIS SEM NENHUM SELECT NATIVO) */}
      {activeType === 'category' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 animate-in fade-in duration-200">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-zeiq-black flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-slate-900 text-white font-mono text-[10px] flex items-center justify-center">1</span>
                <span>Escolha a Linha Esportiva:</span>
              </span>
              <span className="text-[11px] text-slate-400">Clique para selecionar</span>
            </div>

            {/* Chips de Linha */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleSelectDepartment('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedDept === 'all'
                    ? 'bg-zeiq-black text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>🌐 Catálogo Geral (Todas as Linhas)</span>
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
                <span>Novidades 2026</span>
              </button>

              {departments.map((dept) => {
                const isSelected = selectedDept === dept.id;
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => handleSelectDepartment(dept.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-zeiq-black text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{dept.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subcategoria Específica com Busca por Palavra (Clean & Despoluído) */}
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zeiq-black flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-slate-900 text-white font-mono text-[10px] flex items-center justify-center">2</span>
                <span>Subcategoria Específica (Opcional):</span>
              </span>
              <span className="text-[11px] text-slate-400">Busque por palavra para filtrar</span>
            </div>

            {/* Subcategoria Selecionada (se houver) */}
            {selectedCat ? (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-sky-50 border border-sky-200">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                  <span className="text-xs text-sky-950">
                    Subcategoria ativa: <strong className="font-bold text-sky-900">{selectedCatObj?.name || selectedCat}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleSelectCategory('');
                    setCatSearch('');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Remover subcategoria</span>
                </button>
              </div>
            ) : (
              /* Campo de busca por palavra para subcategoria */
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={catSearch}
                    onChange={(e) => setCatSearch(e.target.value)}
                    placeholder="Digite para buscar subcategoria (ex: Raquetes, Shorts, Camisetas, Mochilas)..."
                    className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                  {catSearch && (
                    <button
                      type="button"
                      onClick={() => setCatSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Resultados da busca digitada */}
                {catSearch.trim() ? (
                  <div className="flex flex-wrap gap-1.5 pt-1 animate-in fade-in duration-150">
                    {filteredSubcategories.length === 0 ? (
                      <span className="text-[11px] text-slate-400 italic">
                        Nenhuma subcategoria encontrada para "{catSearch}".
                      </span>
                    ) : (
                      filteredSubcategories.slice(0, 8).map((cat) => (
                        <button
                          key={cat.id || cat.slug}
                          type="button"
                          onClick={() => {
                            handleSelectCategory(cat.slug);
                            setCatSearch('');
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-800 border border-slate-200 hover:border-sky-300 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3 h-3 text-sky-600" />
                          <span>{cat.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                    <span>Todas as peças desta linha serão exibidas. Digite acima apenas se desejar filtrar por uma subcategoria específica.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAINEL 2: PRODUTO ESPECÍFICO COM CARD VISUAL E COMBOBOX */}
      {activeType === 'product' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 animate-in fade-in duration-200">
          {/* Card do Produto Selecionado */}
          {selectedProduct && !isPickingProduct ? (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/90">
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                  <img
                    src={getProductCover(selectedProduct)}
                    alt={selectedProduct.name}
                    className="w-full h-full object-contain p-0.5"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    {selectedProduct.code_sku && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-800">
                        {selectedProduct.code_sku}
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                      Produto Vinculado
                    </span>
                  </div>
                  <strong className="text-xs font-bold text-zeiq-black block line-clamp-1 mt-0.5">
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
                  Trocar Produto
                </button>
                <button
                  type="button"
                  onClick={handleClearProduct}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Remover vinculação"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Combobox de Busca de Produtos */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zeiq-black">
                  Buscar Produto no Catálogo:
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
                  placeholder="Digite o nome do produto ou código SKU..."
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

              {/* Lista Suspenso Visual com Miniatura, SKU e Título */}
              <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white shadow-inner">
                {searchResults.length === 0 ? (
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

                        <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-slate-100 group-hover:bg-zeiq-black text-slate-700 shrink-0">
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

      {/* PAINEL 3: COLEÇÃO & BUSCA */}
      {activeType === 'search' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 animate-in fade-in duration-200">
          <div>
            <label className="block text-xs font-bold text-zeiq-black mb-1.5">
              Termo ou Palavra-Chave para Busca no Catálogo:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleApplySearch(e.target.value)}
                placeholder="Ex: Leo Branco, Carbono 3K, Pro Dry, Beach Flex..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
              />
            </div>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block mb-1.5">Coleções frequentes (clique para aplicar):</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {['Leo Branco', 'Carbono 3K', 'Carbono 18k', 'Pro Dry', 'Beach Flex', 'Advanced'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleApplySearch(tag)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    searchQuery.toLowerCase() === tag.toLowerCase()
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {searchQuery && (
            <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 pt-1 border-t border-slate-100">
              <Check className="w-3.5 h-3.5" />
              <span>{searchMatchCount} produto(s) localizado(s) no catálogo com o termo "{searchQuery}".</span>
            </p>
          )}
        </div>
      )}

      {/* PAINEL 4: LINK EXTERNO / URL */}
      {activeType === 'custom' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 animate-in fade-in duration-200">
          <div>
            <label className="block text-xs font-bold text-zeiq-black mb-1.5">
              URL Externa ou Rota Interna do Catálogo:
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
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleApplyCustomUrl('/portal')}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                Portal do Lojista (/portal)
              </button>
              <button
                type="button"
                onClick={() => handleApplyCustomUrl('https://wa.me/5516991667020')}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors cursor-pointer"
              >
                WhatsApp Oficial Zeiq
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. CARD DE PRÉVIA VISUAL DA AÇÃO DO BANNER */}
      <div className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
        actionSummary.isConfigured
          ? 'bg-gradient-to-r from-zinc-900 to-slate-900 text-white border-zinc-800 shadow-md'
          : 'bg-white text-slate-700 border-slate-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
              actionSummary.isConfigured ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-100 text-slate-400'
            }`}>
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.2 rounded ${
                  actionSummary.isConfigured ? 'bg-white/10 text-zeiq-orange' : 'bg-slate-200 text-slate-600'
                }`}>
                  {actionSummary.badge}
                </span>
                <strong className={`text-xs sm:text-sm font-bold block ${actionSummary.isConfigured ? 'text-white' : 'text-zeiq-black'}`}>
                  {actionSummary.title}
                </strong>
              </div>
              <p className={`text-[11px] mt-0.5 leading-snug ${actionSummary.isConfigured ? 'text-slate-300' : 'text-slate-500'}`}>
                {actionSummary.description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowTechnicalUrl(!showTechnicalUrl)}
            className={`text-[11px] font-mono px-2 py-1 rounded transition-colors whitespace-nowrap self-start sm:self-auto cursor-pointer ${
              actionSummary.isConfigured ? 'text-slate-400 hover:text-white bg-white/5' : 'text-slate-500 hover:text-zeiq-black bg-slate-100'
            }`}
          >
            {showTechnicalUrl ? 'Ocultar URL' : 'Ver URL Técnica'}
          </button>
        </div>

        {/* Parâmetro técnico expansível */}
        {showTechnicalUrl && (
          <div className="mt-3 pt-2.5 border-t border-white/10 text-xs">
            <label className="block text-[10px] font-mono text-slate-400 mb-1">
              Link técnico gravado no banco de dados:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={link}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Link bruto"
                className="flex-1 px-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-lg text-emerald-300 font-mono focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
