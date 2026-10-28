'use client';

import React, { useState, useMemo } from 'react';
import { Header } from '@/components/Header';
import { HomeSlideBanner, BannerAction } from '@/components/HomeSlideBanner';
import { CatalogNav, isProductLancamento } from '@/components/CatalogNav';
import { ProductCard } from '@/components/ProductCard';
import { ProductModal } from '@/components/ProductModal';
import { HeroBanner } from '@/components/HeroBanner';
import { Footer } from '@/components/Footer';
import { Product, Category, BannerItem, StoreSettings } from '@/types';
import { useQuoteCart } from '@/lib/store/quote-cart';
import { DEPARTMENTS, Department, findDepartmentForCategory } from '@/lib/data/departments';
import { Search, ArrowDown, X, ShieldAlert } from 'lucide-react';
import { isProductOutOfStock } from '@/lib/utils/sizes';

export function normalizeSearchText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

interface CatalogClientProps {
  initialProducts: Product[];
  categories: Category[];
  initialDepartments?: Department[];
  initialBanners?: BannerItem[];
  initialSettings?: StoreSettings;
}

const ITEMS_PER_PAGE = 30; // Mais itens por página aproveitando o layout widescreen

export function CatalogClient({
  initialProducts,
  categories,
  initialDepartments,
  initialBanners,
  initialSettings,
}: CatalogClientProps) {
  const departments = initialDepartments && initialDepartments.length > 0 ? initialDepartments : DEPARTMENTS;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hideOutOfStock, setHideOutOfStock] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [adminNotice, setAdminNotice] = useState<string | null>(null);
  const setIsOpenCart = useQuoteCart((state) => state.setIsOpen);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('unauthorized_admin') === '1') {
        setAdminNotice(
          'Acesso Restrito: Sua conta de lojista parceiro tem acesso exclusivo ao catálogo e cotações no site.'
        );
        window.history.replaceState({}, '', window.location.pathname);
        const timer = setTimeout(() => setAdminNotice(null), 6500);
        return () => clearTimeout(timer);
      }

      // Abre modal de produto se houver ?product=...
      const productParam = params.get('product');
      if (productParam) {
        const found = initialProducts.find((p) => p.id === productParam || p.slug === productParam);
        if (found) {
          setActiveProduct(found);
        }
      }

      const deptParam = params.get('dept');
      if (deptParam) {
        setSelectedDepartment(deptParam);
      }

      const catParam = params.get('cat');
      if (catParam) {
        setSelectedCategory(catParam);
      }

      const searchParam = params.get('search');
      if (searchParam) {
        setSearchQuery(searchParam);
      }
    }
  }, [initialProducts]);

  // Filtra produtos por busca de texto, departamento e subcategoria selecionada
  const filteredProducts = useMemo(() => {
    let result = initialProducts;

    // 1. Filtragem se estiver no modo Lançamentos
    if (selectedDepartment === 'lancamentos') {
      result = result.filter(isProductLancamento);
      if (selectedCategory) {
        result = result.filter((p) =>
          p.categories?.some((c) => c.slug === selectedCategory)
        );
      }
    } else if (selectedCategory) {
      // 2. Filtragem por subcategoria específica
      result = result.filter((p) =>
        p.categories?.some((c) => c.slug === selectedCategory)
      );
    } else if (selectedDepartment && selectedDepartment !== 'all') {
      // 3. Filtragem por departamento completo (todas as categorias do departamento)
      const dept = departments.find((d) => d.id === selectedDepartment);
      if (dept) {
        const deptCatSlugs = categories
          .filter((cat) =>
            dept.categoryNames.some(
              (name) => name.toLowerCase().trim() === cat.name.toLowerCase().trim()
            )
          )
          .map((c) => c.slug);

        result = result.filter((p) =>
          p.categories?.some((c) => deptCatSlugs.includes(c.slug))
        );
      }
    }

    // 4. Filtragem por busca textual com normalização de acentos e suporte a multipalavras
    if (searchQuery.trim()) {
      const normalizedQuery = normalizeSearchText(searchQuery);
      const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

      if (queryTokens.length > 0) {
        result = result.filter((p) => {
          const normName = normalizeSearchText(p.name);
          const normSku = normalizeSearchText(p.code_sku);
          const normDesc = normalizeSearchText(p.description);
          const normTags = (p.tags || []).map(normalizeSearchText).join(' ');
          const normCategories = (p.categories || []).map((c) => normalizeSearchText(c.name)).join(' ');

          const fullSearchable = `${normName} ${normSku} ${normCategories} ${normTags} ${normDesc}`;

          // Todas as palavras digitadas precisam ser encontradas no produto
          return queryTokens.every((token) => fullSearchable.includes(token));
        });
      }
    }

    // 5. Filtragem por estoque (ocultar esgotados se ativado)
    if (hideOutOfStock) {
      result = result.filter((p) => !isProductOutOfStock(p));
    }

    // 6. Ordenação estrita por lançamentos e data: do mais recente para o mais antigo
    return [...result].sort((a, b) => {
      // Prioriza produtos marcados como destaque ou com tag de lançamento
      const aLanc = isProductLancamento(a) ? 1 : 0;
      const bLanc = isProductLancamento(b) ? 1 : 0;
      if (bLanc !== aLanc) return bLanc - aLanc;

      // Ordena por data mais recente
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;

      // Desempate por ID legado mais recente
      const idA = parseInt(a.legacy_id || '0', 10) || 0;
      const idB = parseInt(b.legacy_id || '0', 10) || 0;
      return idB - idA;
    });
  }, [initialProducts, categories, departments, selectedDepartment, selectedCategory, searchQuery, hideOutOfStock]);

  // Carrega parâmetros da URL (?search=..., ?dept=..., ?cat=...) se presentes
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('search');
      let dept = params.get('dept');
      const cat = params.get('cat');

      // Suporte a apelidos amigáveis
      if (dept === 'masculino') dept = 'vestuario-masculino';
      if (dept === 'feminino') dept = 'vestuario-feminino';

      let hasFilterFromUrl = false;

      if (q) {
        setSearchQuery(q);
        hasFilterFromUrl = true;
      }
      if (dept) {
        setSelectedDepartment(dept);
        hasFilterFromUrl = true;
      }
      if (cat) {
        setSelectedCategory(cat);
        hasFilterFromUrl = true;
      }

      if (hasFilterFromUrl) {
        setTimeout(() => {
          const gridElem = document.getElementById('catalog-products-grid');
          if (gridElem) {
            gridElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 180);
      }
    }
  }, []);

  // Produtos visíveis na página
  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  // Ao trocar de departamento, limpa a subcategoria anterior para exibir o departamento inteiro
  const handleDepartmentSelect = (deptId: string) => {
    setSelectedDepartment(deptId);
    setSelectedCategory(null);
    setVisibleCount(ITEMS_PER_PAGE);
  };

  // Ao selecionar uma subcategoria, identifica e sincroniza o departamento pai
  const handleCategorySelect = (slug: string | null) => {
    if (slug) {
      const cat = categories.find((c) => c.slug === slug);
      if (cat) {
        const dept = findDepartmentForCategory(cat.name, departments);
        if (dept && selectedDepartment !== 'lancamentos') {
          setSelectedDepartment(dept.id);
        }
      }
    }
    setSelectedCategory(slug);
    setVisibleCount(ITEMS_PER_PAGE);
  };

  // Handler de ações dos banners (produto, busca, categoria ou carrinho)
  const handleBannerAction = (action: BannerAction) => {
    // 1. Abertura direta do modal de produto específico
    if (action.type === 'product' && action.productId) {
      const found = initialProducts.find(
        (p) => p.id === action.productId || p.slug === action.productId
      );
      if (found) {
        setActiveProduct(found);
      }
      return;
    }

    // 2. Busca por palavra-chave ou coleção
    if (action.type === 'search' && action.query) {
      setSearchQuery(action.query);
      setSelectedDepartment('all');
      setSelectedCategory(null);
      setVisibleCount(ITEMS_PER_PAGE);
    } else if (action.type === 'category') {
      // 3. Filtragem por departamento e/ou subcategoria
      setSelectedDepartment(action.departmentId || 'all');
      setSelectedCategory(action.categorySlug || null);
      setSearchQuery('');
      setVisibleCount(ITEMS_PER_PAGE);
    } else if (action.type === 'department' && action.departmentId) {
      setSelectedDepartment(action.departmentId);
      setSelectedCategory(null);
      setSearchQuery('');
      setVisibleCount(ITEMS_PER_PAGE);
    } else if (action.type === 'cart') {
      setIsOpenCart(true);
      return;
    }

    // Rola suavemente até a vitrine de produtos
    const gridElem = document.getElementById('catalog-products-grid');
    if (gridElem) {
      gridElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setVisibleCount(ITEMS_PER_PAGE);

    // Se o usuário está buscando por texto, abre a busca para o catálogo todo
    if (query.trim() && (selectedDepartment !== 'all' || selectedCategory !== null)) {
      setSelectedDepartment('all');
      setSelectedCategory(null);
    }

    // Se digitou algo, rola suavemente para os resultados no catálogo
    if (query.trim().length >= 2) {
      const gridElem = document.getElementById('catalog-products-grid');
      if (gridElem) {
        gridElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  };

  const activeDepartmentObj = departments.find((d) => d.id === selectedDepartment);
  const currentCategoryName = categories.find((c) => c.slug === selectedCategory)?.name;

  const currentFilterTitle =
    selectedDepartment === 'lancamentos'
      ? currentCategoryName
        ? `Lançamentos › ${currentCategoryName}`
        : '🔥 Lançamentos & Novidades 2026'
      : currentCategoryName
      ? activeDepartmentObj
        ? `${activeDepartmentObj.shortName} › ${currentCategoryName}`
        : currentCategoryName
      : activeDepartmentObj
      ? activeDepartmentObj.name
      : 'Todos os Equipamentos e Vestuário';

  const isAnyFilterActive = selectedDepartment !== 'all' || selectedCategory !== null || searchQuery !== '' || hideOutOfStock;

  return (
    <div className="flex-1 flex flex-col">
      {/* Notificação de bloqueio ao painel administrativo para lojistas */}
      {adminNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92%] bg-amber-500 text-zeiq-black px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-3 font-semibold text-xs border border-amber-600/30 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 shrink-0 text-zeiq-black" />
            <span className="leading-snug">{adminNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setAdminNotice(null)}
            className="p-1 hover:bg-black/10 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Header Widescreen Fixo */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        products={initialProducts}
        onSelectProduct={setActiveProduct}
      />

      {/* 2. Banner Slide em Formato Stage Card com Prévia Lateral (Conforme Referência) */}
      <HomeSlideBanner
        banners={initialBanners}
        onBannerAction={handleBannerAction}
        onSelectDepartment={handleDepartmentSelect}
        onSelectCategory={handleCategorySelect}
        onOpenCart={() => setIsOpenCart(true)}
      />

      {/* 3. Navegação Moderna Departamental (Sticky e Fluida) */}
      <CatalogNav
        categories={categories}
        products={initialProducts}
        departments={departments}
        selectedDepartment={selectedDepartment}
        selectedCategory={selectedCategory}
        onSelectDepartment={handleDepartmentSelect}
        onSelectCategory={handleCategorySelect}
      />

      {/* 4. Vitrine Widescreen Fluida Preenchendo a Tela */}
      <main id="catalog-products-grid" className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 sm:pt-8 pb-8 sm:pb-12 flex-1 w-full scroll-mt-52 sm:scroll-mt-56">
        
        {/* Barra de Status do Filtro e Totalizador */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-zeiq-black tracking-tight">
                {currentFilterTitle}
              </h2>
              {(selectedDepartment !== 'all' || selectedCategory) && (
                <span className="text-xs font-bold uppercase tracking-wider bg-zeiq-black text-white px-2 py-0.5 rounded">
                  Filtrado
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Exibindo <strong>{visibleProducts.length}</strong> de <strong>{filteredProducts.length}</strong> produtos
              {hideOutOfStock && (
                <span className="text-emerald-700 font-semibold"> (apenas disponíveis)</span>
              )}
              {searchQuery && ` para busca "${searchQuery}"`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* Botão de Alternância: Ocultar Esgotados */}
            <button
              type="button"
              onClick={() => {
                setHideOutOfStock(!hideOutOfStock);
                setVisibleCount(ITEMS_PER_PAGE);
              }}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs cursor-pointer select-none active:scale-95 ${
                hideOutOfStock
                  ? 'bg-zeiq-black text-white border-zeiq-black shadow-xs'
                  : 'bg-white text-slate-700 hover:text-zeiq-black hover:bg-slate-50 border-slate-200'
              }`}
              title={hideOutOfStock ? 'Mostrando apenas itens disponíveis. Clique para ver todos.' : 'Clique para ocultar itens esgotados'}
            >
              <span className={`w-2 h-2 rounded-full transition-colors ${hideOutOfStock ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`} />
              <span>{hideOutOfStock ? 'Apenas com estoque' : 'Ocultar esgotados'}</span>
            </button>

            {isAnyFilterActive && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDepartment('all');
                  setSelectedCategory(null);
                  setSearchQuery('');
                  setHideOutOfStock(false);
                  setVisibleCount(ITEMS_PER_PAGE);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-zeiq-black hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer active:scale-95"
              >
                <X className="w-3.5 h-3.5 text-slate-500" />
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Grid Widescreen de 5 a 6 Colunas no Desktop */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center my-8 shadow-xs">
            <div className="w-14 h-14 rounded-lg bg-[#f8f9fa] flex items-center justify-center text-slate-400 mx-auto mb-3 border border-slate-200">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-zeiq-black mb-1">
              Nenhum produto encontrado
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
              Não encontramos nenhum produto correspondente aos filtros aplicados.
            </p>
            <button
              onClick={() => {
                setSelectedDepartment('all');
                setSelectedCategory(null);
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-md text-xs font-semibold transition-all shadow-xs"
            >
              Ver todos os {initialProducts.length} produtos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-6">
            {visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpenDetails={setActiveProduct}
              />
            ))}
          </div>
        )}

        {/* Botão Carregar Mais */}
        {visibleCount < filteredProducts.length && (
          <div className="flex justify-center mt-10 mb-6">
            <button
              onClick={handleLoadMore}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-slate-50 text-zeiq-black border border-slate-200 rounded-lg text-xs font-bold shadow-xs transition-all hover:border-slate-300 active:scale-95"
            >
              <ArrowDown className="w-4 h-4 text-slate-500" />
              Carregar mais produtos ({filteredProducts.length - visibleCount} restantes)
            </button>
          </div>
        )}
      </main>

      {/* 5. Faixa Comercial Zeiq na Parte Inferior */}
      <HeroBanner />

      {/* 6. Modal de Detalhes */}
      <ProductModal
        product={activeProduct}
        onClose={() => setActiveProduct(null)}
      />

      {/* 7. Rodapé */}
      <Footer settings={initialSettings} />
    </div>
  );
}
