'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
} from 'lucide-react';

interface BannerDestinationPickerProps {
  link?: string;
  onChange: (newLink: string) => void;
  products: Product[];
  categories: Category[];
  departments?: Department[];
}

type DestinationType = 'product' | 'category' | 'search' | 'custom';

export function BannerDestinationPicker({
  link = '',
  onChange,
  products,
  categories,
  departments = DEPARTMENTS,
}: BannerDestinationPickerProps) {
  // Determina o tipo inicial a partir do link existente
  const detectInitialType = (val: string): DestinationType => {
    const clean = val.trim();
    if (!clean) return 'category';
    if (clean.includes('product=') || clean.startsWith('product:')) return 'product';
    if (clean.includes('dept=') || clean.includes('cat=')) return 'category';
    if (clean.includes('search=')) return 'search';
    return 'custom';
  };

  const [activeType, setActiveType] = useState<DestinationType>(() => detectInitialType(link));
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedCat, setSelectedCat] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [showAdvancedLink, setShowAdvancedLink] = useState(false);

  // Sincroniza estados internos quando a prop `link` mudar
  useEffect(() => {
    const clean = (link || '').trim();
    const detected = detectInitialType(clean);
    setActiveType(detected);

    if (detected === 'product') {
      const match = clean.match(/(?:product=|product:)([^&]+)/);
      if (match && match[1]) {
        setSelectedProductId(match[1]);
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

  // Lista de produtos filtrada para seleção rápida
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 150);
    const q = productSearch.toLowerCase().trim();
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || (p.code_sku && p.code_sku.toLowerCase().includes(q)))
      .slice(0, 100);
  }, [products, productSearch]);

  // Subcategorias disponíveis para o departamento selecionado
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

  // Handlers para cada modalidade
  const handleSelectProduct = (pId: string) => {
    setSelectedProductId(pId);
    if (pId) {
      onChange(`?product=${pId}`);
    } else {
      onChange('');
    }
  };

  const handleUpdateCategory = (dept: string, cat: string) => {
    setSelectedDept(dept);
    setSelectedCat(cat);

    if (dept === 'all' && !cat) {
      onChange('');
      return;
    }

    const params = new URLSearchParams();
    if (dept && dept !== 'all') params.set('dept', dept);
    if (cat) params.set('cat', cat);
    onChange(`?${params.toString()}`);
  };

  const handleUpdateSearch = (q: string) => {
    setSearchQuery(q);
    if (q.trim()) {
      onChange(`?search=${encodeURIComponent(q.trim())}`);
    } else {
      onChange('');
    }
  };

  const handleUpdateCustomUrl = (url: string) => {
    setCustomUrl(url);
    onChange(url.trim());
  };

  // Resumo amigável do destino atual
  const destinationSummary = useMemo(() => {
    const clean = (link || '').trim();
    if (!clean) return { title: 'Nenhum destino configurado', desc: 'O banner não terá ação de clique' };

    if (clean.includes('product=') || clean.startsWith('product:')) {
      const id = clean.replace(/^\/?\?product=/, '').replace(/^product:/, '');
      const prod = products.find((p) => p.id === id || p.slug === id);
      return {
        title: prod ? `Produto: ${prod.name}` : `Produto ID: ${id}`,
        desc: 'Ao clicar no banner, a vitrine abre imediatamente a janela de detalhes e tamanhos deste produto.',
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
      if (deptId === 'lancamentos') parts.push('🔥 Novidades 2026');
      else if (deptObj) parts.push(deptObj.name);
      if (catObj) parts.push(catObj.name);
      return {
        title: `Conjunto: ${parts.length > 0 ? parts.join(' > ') : 'Todas as Linhas'}`,
        desc: 'Ao clicar no banner, a vitrine filtra esses produtos e rola a tela suavemente até a grade.',
      };
    }

    if (clean.includes('search=')) {
      const qs = clean.includes('?') ? clean.substring(clean.indexOf('?') + 1) : clean;
      const params = new URLSearchParams(qs);
      const q = params.get('search') || '';
      return {
        title: `Busca no Catálogo: "${q}"`,
        desc: 'Ao clicar no banner, a vitrine pesquisa por esse termo e exibe todos os produtos relacionados.',
      };
    }

    return {
      title: `Link Externo / URL: ${clean}`,
      desc: clean.startsWith('http') ? 'Abre o link externo em uma nova aba.' : 'Navega para a página interna configurada.',
    };
  }, [link, products, departments, categories]);

  return (
    <div className="space-y-3 bg-[#f8f9fa] p-3.5 sm:p-4 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-zeiq-black flex items-center gap-1.5">
          <span>Destino ao Clicar no Banner</span>
        </label>
        <span className="text-[11px] text-slate-500">Escolha o produto ou conjunto de produtos</span>
      </div>

      {/* 1. SELETOR DE MODALIDADE */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-200/80 rounded-xl">
        <button
          type="button"
          onClick={() => {
            setActiveType('product');
            if (selectedProductId) onChange(`?product=${selectedProductId}`);
          }}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeType === 'product'
              ? 'bg-white text-zeiq-black shadow-2xs'
              : 'text-slate-600 hover:text-zeiq-black'
          }`}
        >
          <Package className="w-3.5 h-3.5 text-zeiq-orange shrink-0" />
          <span>Produto</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveType('category');
            handleUpdateCategory(selectedDept, selectedCat);
          }}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeType === 'category'
              ? 'bg-white text-zeiq-black shadow-2xs'
              : 'text-slate-600 hover:text-zeiq-black'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span>Conjunto / Linha</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveType('search');
            if (searchQuery) onChange(`?search=${encodeURIComponent(searchQuery)}`);
          }}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeType === 'search'
              ? 'bg-white text-zeiq-black shadow-2xs'
              : 'text-slate-600 hover:text-zeiq-black'
          }`}
        >
          <Search className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Coleção / Busca</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveType('custom');
            onChange(customUrl);
          }}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeType === 'custom'
              ? 'bg-white text-zeiq-black shadow-2xs'
              : 'text-slate-600 hover:text-zeiq-black'
          }`}
        >
          <Link2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Link Livre</span>
        </button>
      </div>

      {/* 2. CAMPOS DE CONFIGURAÇÃO DE ACORDO COM O TIPO */}
      {activeType === 'product' && (
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Filtrar por nome ou SKU..."
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
              />
            </div>

            <div>
              <select
                value={selectedProductId}
                onChange={(e) => handleSelectProduct(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black font-medium"
              >
                <option value="">-- Selecione o Produto no Catálogo --</option>
                {filteredProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.code_sku ? `(${p.code_sku})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Dica: Ao clicar no banner na loja, abre diretamente a visualização completa do produto.
          </p>
        </div>
      )}

      {activeType === 'category' && (
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Linha Esportiva / Coleção
              </label>
              <select
                value={selectedDept}
                onChange={(e) => handleUpdateCategory(e.target.value, '')}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black font-medium"
              >
                <option value="all">Todas as Linhas (Catálogo Geral)</option>
                <option value="lancamentos">🔥 Novidades & Lançamentos 2026</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Subcategoria (Opcional)
              </label>
              <select
                value={selectedCat}
                onChange={(e) => handleUpdateCategory(selectedDept, e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black font-medium"
              >
                <option value="">Todas as subcategorias da linha</option>
                {availableCategories.map((c) => (
                  <option key={c.id || c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Filtra automaticamente o catálogo para exibir todos os produtos desse departamento/categoria.
          </p>
        </div>
      )}

      {activeType === 'search' && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleUpdateSearch(e.target.value)}
              placeholder="Ex: Leo Branco, Carbono 3K, Pro Dry, Beach Flex..."
              className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400">Sugestões:</span>
            {['Leo Branco', 'Carbono 3K', 'Carbono 18k', 'Pro Dry', 'Beach Flex'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleUpdateSearch(tag)}
                className="px-2 py-0.5 rounded text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeType === 'custom' && (
        <div className="space-y-2 pt-1">
          <input
            type="text"
            value={customUrl}
            onChange={(e) => handleUpdateCustomUrl(e.target.value)}
            placeholder="Ex: https://wa.me/5516991667020 ou /portal"
            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-zeiq-black font-mono focus:outline-none focus:ring-1 focus:ring-zeiq-black"
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400">Atalhos:</span>
            <button
              type="button"
              onClick={() => handleUpdateCustomUrl('/portal')}
              className="px-2 py-0.5 rounded text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
            >
              Portal do Lojista (/portal)
            </button>
          </div>
        </div>
      )}

      {/* 3. RESUMO VISUAL DO DESTINO */}
      <div className="p-2.5 rounded-lg bg-white border border-slate-200/90 text-xs flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
            <Check className="w-3.5 h-3.5" />
          </div>
          <div>
            <strong className="text-zeiq-black block font-bold leading-snug">
              {destinationSummary.title}
            </strong>
            <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
              {destinationSummary.desc}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvancedLink(!showAdvancedLink)}
          className="text-[11px] text-slate-400 hover:text-zeiq-black transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {showAdvancedLink ? 'Ocultar URL' : 'Ver URL'}
        </button>
      </div>

      {/* Campo Técnico Avançado (Ocultável) */}
      {showAdvancedLink && (
        <div className="pt-1">
          <label className="block text-[10px] font-mono text-slate-400 mb-0.5">
            URL / Parâmetro técnico gravado:
          </label>
          <input
            type="text"
            value={link}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Link bruto"
            className="w-full px-2.5 py-1 text-[11px] bg-slate-100 border border-slate-200 rounded text-slate-700 font-mono focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}
