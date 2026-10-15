'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Category, Product } from '@/types';
import { DEPARTMENTS, Department, findDepartmentForCategory } from '@/lib/data/departments';
import { ChevronDown, X, ArrowRight, Grid, Layers, Sparkles } from 'lucide-react';

interface CatalogNavProps {
  categories: Category[];
  products: Product[];
  departments?: Department[];
  selectedDepartment: string;
  selectedCategory: string | null;
  onSelectDepartment: (departmentId: string) => void;
  onSelectCategory: (categorySlug: string | null) => void;
}

export function isProductLancamento(product: Product): boolean {
  return Boolean(
    product.tags?.some((t) => t.toLowerCase().includes('lança')) || product.is_featured
  );
}

export function CatalogNav({
  categories,
  products,
  departments: customDepartments,
  selectedDepartment,
  selectedCategory,
  onSelectDepartment,
  onSelectCategory,
}: CatalogNavProps) {
  const activeDepartments = customDepartments && customDepartments.length > 0 ? customDepartments : DEPARTMENTS;
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  // Fecha o menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
        setIsMegaMenuOpen(false);
      }
    };
    if (isMegaMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMegaMenuOpen]);

  // Fecha o menu ao pressionar Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMegaMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handlers para hover no desktop com delay para evitar fechamentos acidentais
  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsMegaMenuOpen(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsMegaMenuOpen(false);
    }, 280);
  };

  // Contagem de produtos por categoria
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      p.categories?.forEach((c) => {
        counts[c.slug] = (counts[c.slug] || 0) + 1;
        counts[c.name] = (counts[c.name] || 0) + 1;
      });
    });
    return counts;
  }, [products]);

  // Produtos e contagem de Lançamentos
  const lancamentosProducts = useMemo(() => {
    return products.filter(isProductLancamento);
  }, [products]);
  const lancamentosCount = lancamentosProducts.length;

  // Contagem de produtos por departamento
  const departmentCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: products.length,
      lancamentos: lancamentosCount,
    };

    activeDepartments.forEach((dept) => {
      const deptCats = categories.filter((cat) =>
        dept.categoryNames.some(
          (name) => name.toLowerCase() === cat.name.toLowerCase()
        )
      );
      const catSlugs = deptCats.map((c) => c.slug);

      const count = products.filter((p) =>
        p.categories?.some((c) => catSlugs.includes(c.slug))
      ).length;

      counts[dept.id] = count;
    });

    return counts;
  }, [products, categories, activeDepartments, lancamentosCount]);

  // Categorias organizadas por departamento para o Mega-Menu
  const departmentCategoriesMap = useMemo(() => {
    const map: Record<string, Category[]> = {};

    activeDepartments.forEach((dept) => {
      map[dept.id] = categories
        .filter((cat) =>
          dept.categoryNames.some(
            (name) => name.toLowerCase() === cat.name.toLowerCase()
          )
        )
        .sort((a, b) => {
          const countA = categoryCounts[a.slug] || 0;
          const countB = categoryCounts[b.slug] || 0;
          return countB - countA;
        });
    });

    return map;
  }, [categories, activeDepartments, categoryCounts]);

  // Subcategorias disponíveis para a barra de pílulas rápidas
  const activeSubcategories = useMemo(() => {
    if (selectedDepartment === 'lancamentos') {
      // Exibe somente categorias que possuem lançamentos
      const catSlugsWithLancamentos = new Set<string>();
      lancamentosProducts.forEach((p) => {
        p.categories?.forEach((c) => catSlugsWithLancamentos.add(c.slug));
      });
      return categories
        .filter((cat) => catSlugsWithLancamentos.has(cat.slug))
        .sort((a, b) => {
          const countA = categoryCounts[a.slug] || 0;
          const countB = categoryCounts[b.slug] || 0;
          return countB - countA;
        });
    }

    if (selectedDepartment === 'all') {
      return [...categories]
        .sort((a, b) => {
          const countA = categoryCounts[a.slug] || 0;
          const countB = categoryCounts[b.slug] || 0;
          return countB - countA;
        })
        .slice(0, 14);
    }

    return departmentCategoriesMap[selectedDepartment] || [];
  }, [categories, selectedDepartment, departmentCategoriesMap, categoryCounts, lancamentosProducts]);

  const activeDepartmentObj = activeDepartments.find((d) => d.id === selectedDepartment);

  const scrollToGrid = () => {
    const gridElem = document.getElementById('catalog-products-grid');
    if (gridElem) {
      const rect = gridElem.getBoundingClientRect();
      if (rect.top < 120 || rect.top > 380) {
        gridElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleDepartmentClick = (deptId: string) => {
    onSelectDepartment(deptId);
    setIsMegaMenuOpen(false);
    scrollToGrid();
  };

  const handleSubcategoryClick = (slug: string | null) => {
    onSelectCategory(slug);
    setIsMegaMenuOpen(false);
    scrollToGrid();
  };

  const handleClearAll = () => {
    onSelectDepartment('all');
    onSelectCategory(null);
    setIsMegaMenuOpen(false);
  };

  return (
    <div
      ref={menuContainerRef}
      onMouseLeave={handleMouseLeave}
      className={`sticky top-16 sm:top-20 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs font-sans ${
        isMegaMenuOpen ? 'z-50' : 'z-30'
      }`}
    >
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-10">
        
        {/* NÍVEL 1: Barra Principal de Departamentos com Design Editorial Monocromático */}
        <div className="flex items-center justify-between gap-3 pt-2 sm:pt-2.5 pb-2">
          
          <nav
            aria-label="Departamentos do Catálogo"
            className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth w-full"
          >
            {/* Botão de Todas as Categorias com Dropdown Mega-Menu */}
            <div
              className="relative shrink-0"
              onMouseEnter={handleMouseEnter}
            >
              <button
                type="button"
                onClick={() => {
                  if (isMegaMenuOpen) {
                    setIsMegaMenuOpen(false);
                  } else {
                    setIsMegaMenuOpen(true);
                  }
                }}
                className={`whitespace-nowrap px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-[13px] font-extrabold transition-all shrink-0 flex items-center gap-1.5 active:scale-95 ${
                  isMegaMenuOpen
                    ? 'bg-zeiq-black text-white shadow-xs'
                    : selectedDepartment === 'all' && !selectedCategory
                    ? 'bg-zeiq-black text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200/90 text-zeiq-black border border-transparent'
                }`}
                title="Abrir painel com todas as categorias"
                aria-expanded={isMegaMenuOpen}
              >
                <Grid className="w-3.5 h-3.5 text-current" />
                <span>Todas as Categorias</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    isMegaMenuOpen || (selectedDepartment === 'all' && !selectedCategory)
                      ? 'bg-white/20 text-white'
                      : 'bg-white text-slate-700'
                  }`}
                >
                  {departmentCounts.all}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 ml-0.5 transition-transform duration-200 ${
                    isMegaMenuOpen ? 'rotate-180 text-zeiq-orange' : 'text-slate-400'
                  }`}
                />
              </button>
            </div>

            {/* Botão de Destaque Lançamentos */}
            <button
              type="button"
              onClick={() => handleDepartmentClick('lancamentos')}
              className={`whitespace-nowrap px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-[13px] font-extrabold transition-all shrink-0 flex items-center gap-1.5 active:scale-95 ${
                selectedDepartment === 'lancamentos' && !selectedCategory
                  ? 'bg-zeiq-black text-white shadow-xs ring-1 ring-amber-400/50'
                  : selectedDepartment === 'lancamentos'
                  ? 'bg-amber-100/80 text-amber-950 font-bold'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200/80'
              }`}
              title="Ver produtos recém-lançados no catálogo"
            >
              <span className="text-xs">🔥</span>
              <span>Lançamentos</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  selectedDepartment === 'lancamentos' && !selectedCategory
                    ? 'bg-zeiq-orange text-zeiq-black'
                    : 'bg-white text-amber-900 border border-amber-200/90'
                }`}
              >
                {departmentCounts.lancamentos}
              </span>
            </button>

            {/* Departamentos Específicos com Estética Sóbria e Monocromática */}
            {activeDepartments.map((dept) => {
              const isActive = selectedDepartment === dept.id;
              const count = departmentCounts[dept.id] || 0;

              return (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => handleDepartmentClick(dept.id)}
                  className={`whitespace-nowrap px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-[13px] font-bold transition-all shrink-0 flex items-center gap-1.5 active:scale-95 ${
                    isActive
                      ? 'bg-zeiq-black text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200/90 text-slate-800 hover:text-zeiq-black border border-transparent'
                  }`}
                >
                  <span>{dept.name}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Botão de Limpar Filtros quando algo estiver selecionado */}
          {(selectedDepartment !== 'all' || selectedCategory !== null) && (
            <button
              type="button"
              onClick={handleClearAll}
              className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 whitespace-nowrap"
              title="Voltar para todos os produtos"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar filtros</span>
            </button>
          )}

        </div>

        {/* NÍVEL 2: Faixa Contextual de Subcategorias (Pílulas Rápidas de Rolagem Fluida) */}
        {activeSubcategories.length > 0 && (
          <div className="pt-1.5 pb-2.5 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
            
            {/* Pílula de "Ver Todos" do Departamento ou Lançamentos Selecionado */}
            {selectedDepartment === 'lancamentos' && (
              <button
                type="button"
                onClick={() => handleSubcategoryClick(null)}
                className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1 active:scale-95 ${
                  selectedCategory === null
                    ? 'bg-amber-400 text-amber-950 font-extrabold shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <span>🔥 Ver Todos os Lançamentos</span>
                <span className="text-[10px] opacity-80">({lancamentosCount})</span>
              </button>
            )}

            {selectedDepartment !== 'all' && selectedDepartment !== 'lancamentos' && activeDepartmentObj && (
              <button
                type="button"
                onClick={() => handleSubcategoryClick(null)}
                className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1 active:scale-95 ${
                  selectedCategory === null
                    ? 'bg-zeiq-orange text-zeiq-black font-extrabold shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <span>Ver Todos de {activeDepartmentObj.shortName}</span>
                <span className="text-[10px] opacity-80">({departmentCounts[selectedDepartment]})</span>
              </button>
            )}

            {/* Pílulas das Subcategorias */}
            {activeSubcategories.map((cat) => {
              const isCatSelected = selectedCategory === cat.slug;
              const count = categoryCounts[cat.slug] || categoryCounts[cat.name] || 0;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSubcategoryClick(cat.slug)}
                  className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1 active:scale-95 ${
                    isCatSelected
                      ? 'bg-zeiq-black text-white font-bold shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span
                    className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                      isCatSelected ? 'bg-white/20 text-white' : 'text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

      </div>

      {/* Backdrop Sutil ao Abrir o Mega-Menu */}
      {isMegaMenuOpen && (
        <div
          onClick={() => setIsMegaMenuOpen(false)}
          className="fixed inset-0 bg-black/45 z-30 transition-opacity"
        />
      )}

      {/* SESSÃO SUSPENSA (MEGA-MENU) DE TODAS AS CATEGORIAS POR DEPARTAMENTO COM FUNDO 100% SÓLIDO */}
      {isMegaMenuOpen && (
        <div
          onMouseEnter={handleMouseEnter}
          className="absolute left-0 right-0 top-full bg-white border-b border-slate-300 shadow-2xl z-40 transition-all duration-200 animate-in fade-in slide-in-from-top-1 max-h-[82vh] overflow-y-auto"
        >
          <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
            
            {/* Cabeçalho do Mega-Menu */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-zeiq-black tracking-tight flex items-center gap-2">
                  <Grid className="w-4 h-4 text-zeiq-orange" />
                  <span>Índice Completo do Catálogo ({products.length} itens em 35 categorias)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Selecione uma subcategoria ou clique no departamento para ver todos os produtos daquela linha.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-zeiq-black hover:bg-slate-100 transition-colors"
                >
                  Ver Catálogo Inteiro
                </button>
                <button
                  type="button"
                  onClick={() => setIsMegaMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-zeiq-black hover:bg-slate-100 transition-colors"
                  aria-label="Fechar índice"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Banner de Acesso Rápido a Lançamentos no Mega-Menu */}
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center font-bold text-lg shrink-0">
                  🔥
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-zeiq-black flex items-center gap-2">
                    <span>Novidades & Lançamentos Oficiais</span>
                    <span className="text-[10px] bg-amber-500 text-black font-extrabold px-1.5 py-0.2 rounded">
                      NOVO
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Confira as {lancamentosCount} novas peças e equipamentos recém-adicionados ao catálogo de revenda.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDepartmentClick('lancamentos')}
                className="px-4 py-2 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-xs active:scale-95"
              >
                <span>Ver Todos os Lançamentos ({lancamentosCount})</span>
                <ArrowRight className="w-3.5 h-3.5 text-zeiq-orange" />
              </button>
            </div>

            {/* Grid de Colunas Nítidas e Bem Estruturadas por Departamento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {activeDepartments.map((dept) => {
                const deptCats = departmentCategoriesMap[dept.id] || [];
                const totalDept = departmentCounts[dept.id] || 0;

                return (
                  <div
                    key={dept.id}
                    className="flex flex-col bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs"
                  >
                    {/* Cabeçalho da Coluna com Link Direto para o Departamento */}
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-zeiq-black uppercase tracking-wider">
                          {dept.name}
                        </h4>
                        <span className="text-[11px] font-mono text-slate-500 font-semibold">
                          {totalDept} {totalDept === 1 ? 'produto' : 'produtos'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDepartmentClick(dept.id)}
                        className="p-1.5 text-xs font-bold text-zeiq-black hover:text-zeiq-orange transition-colors flex items-center gap-1"
                        title={`Ver todos de ${dept.name}`}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Botão de Ver Todos do Departamento */}
                    <button
                      type="button"
                      onClick={() => handleDepartmentClick(dept.id)}
                      className="w-full text-left py-1.5 px-2.5 rounded-lg mb-2 text-xs font-bold bg-white hover:bg-zeiq-black hover:text-white transition-all border border-slate-200 text-zeiq-black flex items-center justify-between group shadow-2xs"
                    >
                      <span>Ver Todos de {dept.shortName}</span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    {/* Lista de Subcategorias da Coluna - Sem mini-scrollbars internas */}
                    <ul className="space-y-1">
                      {deptCats.map((cat) => {
                        const count = categoryCounts[cat.slug] || categoryCounts[cat.name] || 0;
                        const isSelected = selectedCategory === cat.slug;

                        return (
                          <li key={cat.id}>
                            <button
                              type="button"
                              onClick={() => handleSubcategoryClick(cat.slug)}
                              className={`w-full text-left py-1.5 px-2.5 rounded-lg text-xs transition-all flex items-center justify-between group ${
                                isSelected
                                  ? 'bg-zeiq-black text-white font-bold'
                                  : 'text-slate-700 hover:text-zeiq-black hover:bg-white'
                              }`}
                            >
                              <span className="truncate group-hover:translate-x-0.5 transition-transform">
                                {cat.name}
                              </span>
                              <span
                                className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded shrink-0 ml-2 ${
                                  isSelected
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-200 text-slate-700 group-hover:bg-slate-300'
                                }`}
                              >
                                {count}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
