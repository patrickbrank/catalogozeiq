'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Category, Product } from '@/types';
import { DEPARTMENTS, Department } from '@/lib/data/departments';
import { ChevronDown, X, ArrowRight, Sparkles } from 'lucide-react';

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
  const [hoveredDeptId, setHoveredDeptId] = useState<string | null>(null);
  const [dropdownLeft, setDropdownLeft] = useState<number>(16);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const navInnerRef = useRef<HTMLDivElement | null>(null);

  // Fecha qualquer submenu ao clicar fora ou ao pressionar Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navContainerRef.current && !navContainerRef.current.contains(event.target as Node)) {
        setHoveredDeptId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHoveredDeptId(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleMouseEnter = (deptId: string, event?: React.MouseEvent<HTMLElement>) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredDeptId(deptId);

    if (event && navInnerRef.current) {
      const buttonRect = event.currentTarget.getBoundingClientRect();
      const containerRect = navInnerRef.current.getBoundingClientRect();

      const cats = deptId === 'lancamentos'
        ? lancamentosCategories
        : (departmentCategoriesMap[deptId] || []);
      const dropdownWidth = cats.length > 6 ? 480 : 360;

      const buttonLeftInContainer = buttonRect.left - containerRect.left;
      const buttonRightInContainer = buttonRect.right - containerRect.left;
      const buttonCenterInContainer = buttonLeftInContainer + (buttonRect.width / 2);

      let targetLeft: number;

      // Para botões da direita (Acessórios e Infantil), alinha a borda direita da janela com a borda direita do botão
      if (deptId === 'acessorios' || deptId === 'vestuario-infantil') {
        targetLeft = buttonRightInContainer - dropdownWidth;
      } else if (deptId === 'lancamentos' || deptId === 'equipamentos') {
        // Para botões da esquerda (Lançamentos e Equipamentos), alinha pela esquerda do botão
        targetLeft = buttonLeftInContainer;
      } else {
        // Para botões centrais (Feminino e Masculino), centraliza sob o botão
        targetLeft = buttonCenterInContainer - (dropdownWidth / 2);
      }

      // Garante limites seguros dentro do container interno sem estourar as margens
      const minLeft = 16;
      const maxLeft = Math.max(16, containerRect.width - dropdownWidth - 16);
      setDropdownLeft(Math.max(minLeft, Math.min(targetLeft, maxLeft)));
    }
  };

  const handleDropdownEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredDeptId(null);
    }, 240);
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

  // Subcategorias com lançamentos em ordem alfabética
  const lancamentosCategories = useMemo(() => {
    const catSlugsWithLancamentos = new Set<string>();
    lancamentosProducts.forEach((p) => {
      p.categories?.forEach((c) => catSlugsWithLancamentos.add(c.slug));
    });
    return categories
      .filter((cat) => catSlugsWithLancamentos.has(cat.slug))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [categories, lancamentosProducts]);

  // Contagem de produtos por departamento
  const departmentCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: products.length,
      lancamentos: lancamentosCount,
    };

    activeDepartments.forEach((dept) => {
      const deptCats = categories.filter((cat) =>
        dept.categoryNames.some(
          (name) => name.toLowerCase().trim() === cat.name.toLowerCase().trim()
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

  // Subcategorias organizadas por departamento em ORDEM ALFABÉTICA
  const departmentCategoriesMap = useMemo(() => {
    const map: Record<string, Category[]> = {};

    activeDepartments.forEach((dept) => {
      map[dept.id] = categories
        .filter((cat) =>
          dept.categoryNames.some(
            (name) => name.toLowerCase().trim() === cat.name.toLowerCase().trim()
          )
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    });

    return map;
  }, [categories, activeDepartments]);

  // Subcategorias ativas para a barra de pílulas rápidas de nível 2
  const activeSubcategories = useMemo(() => {
    if (selectedDepartment === 'lancamentos') {
      return lancamentosCategories;
    }
    if (selectedDepartment && selectedDepartment !== 'all') {
      return departmentCategoriesMap[selectedDepartment] || [];
    }
    return [];
  }, [selectedDepartment, lancamentosCategories, departmentCategoriesMap]);

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
    onSelectCategory(null);
    setHoveredDeptId(null);
    scrollToGrid();
  };

  const handleSubcategoryClick = (deptId: string, slug: string | null) => {
    onSelectDepartment(deptId);
    onSelectCategory(slug);
    setHoveredDeptId(null);
    scrollToGrid();
  };

  const handleClearAll = () => {
    onSelectDepartment('all');
    onSelectCategory(null);
    setHoveredDeptId(null);
  };

  const hoveredDeptObj = activeDepartments.find((d) => d.id === hoveredDeptId);
  const hoveredCategories = hoveredDeptId === 'lancamentos'
    ? lancamentosCategories
    : (hoveredDeptId ? departmentCategoriesMap[hoveredDeptId] || [] : []);

  return (
    <div
      ref={navContainerRef}
      onMouseLeave={handleMouseLeave}
      className="sticky top-16 sm:top-20 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs font-sans z-30"
    >
      <div ref={navInnerRef} className="max-w-[1720px] mx-auto px-0 lg:px-10 relative">
        
        {/* NÍVEL 1: Barra Principal com os 6 Departamentos Oficiais Zeiq */}
        <div className="flex items-center justify-between gap-3 pt-2 sm:pt-2.5 pb-2">
          
          <nav
            aria-label="Departamentos do Catálogo"
            className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth w-full px-4 sm:px-6 lg:px-0"
          >
            {/* 1. LANÇAMENTOS COM SUBMENU */}
            <button
              type="button"
              onMouseEnter={(e) => handleMouseEnter('lancamentos', e)}
              onClick={() => handleDepartmentClick('lancamentos')}
              className={`whitespace-nowrap px-3.5 sm:px-4 lg:px-5 py-2 lg:py-2.5 rounded-xl text-xs sm:text-[13px] lg:text-sm font-extrabold transition-all shrink-0 flex items-center gap-1.5 lg:gap-2 active:scale-95 cursor-pointer ${
                selectedDepartment === 'lancamentos' && !selectedCategory
                  ? 'bg-zeiq-black text-white shadow-xs ring-1 ring-amber-400/50'
                  : selectedDepartment === 'lancamentos'
                  ? 'bg-amber-100/90 text-amber-950 font-bold'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200/80'
              }`}
              title="Ver produtos recém-lançados no catálogo"
            >
              <span className="text-xs sm:text-sm">🔥</span>
              <span>Lançamentos</span>
              <span
                className={`px-1.5 lg:px-2 py-0.2 lg:py-0.5 rounded-full text-[10px] lg:text-xs font-mono font-bold ${
                  selectedDepartment === 'lancamentos' && !selectedCategory
                    ? 'bg-zeiq-orange text-zeiq-black'
                    : 'bg-white text-amber-900 border border-amber-200/90'
                }`}
              >
                {departmentCounts.lancamentos}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 lg:w-4 lg:h-4 ml-0.5 transition-transform duration-200 hidden md:inline-block ${
                  hoveredDeptId === 'lancamentos' ? 'rotate-180 text-amber-600' : 'text-amber-700/60'
                }`}
              />
            </button>

            {/* 2 a 6. OS 5 DEPARTAMENTOS OFICIAIS COM SUBMENUS INDIVIDUAIS */}
            {activeDepartments.map((dept) => {
              const isActive = selectedDepartment === dept.id;
              const count = departmentCounts[dept.id] || 0;
              const isHovered = hoveredDeptId === dept.id;
              const deptCats = departmentCategoriesMap[dept.id] || [];

              return (
                <button
                  key={dept.id}
                  type="button"
                  onMouseEnter={(e) => handleMouseEnter(dept.id, e)}
                  onClick={() => handleDepartmentClick(dept.id)}
                  className={`whitespace-nowrap px-3.5 sm:px-4 lg:px-5 py-2 lg:py-2.5 rounded-xl text-xs sm:text-[13px] lg:text-sm font-bold transition-all shrink-0 flex items-center gap-1.5 lg:gap-2 active:scale-95 cursor-pointer ${
                    isActive && !selectedCategory
                      ? 'bg-zeiq-black text-white shadow-xs'
                      : isActive
                      ? 'bg-slate-200/90 text-zeiq-black font-extrabold'
                      : 'bg-slate-100 hover:bg-slate-200/90 text-slate-800 hover:text-zeiq-black border border-transparent'
                  }`}
                >
                  <span>{dept.name}</span>
                  <span
                    className={`px-1.5 lg:px-2 py-0.2 lg:py-0.5 rounded-full text-[10px] lg:text-xs font-mono font-bold ${
                      isActive && !selectedCategory
                        ? 'bg-white/20 text-white'
                        : 'bg-white text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                  {deptCats.length > 0 && (
                    <ChevronDown
                      className={`w-3.5 h-3.5 lg:w-4 lg:h-4 ml-0.5 transition-transform duration-200 hidden md:inline-block ${
                        isHovered ? 'rotate-180 text-zeiq-orange' : 'text-slate-400'
                      }`}
                    />
                  )}
                </button>
              );
            })}

            {/* Espaçador de respiro lateral no mobile/tablet para rolagem fluida */}
            <div className="w-4 sm:w-6 shrink-0 lg:hidden" aria-hidden="true" />
          </nav>

          {/* Botão Limpar Filtros quando algum departamento ou subcategoria estiver ativo */}
          {(selectedDepartment !== 'all' || selectedCategory !== null) && (
            <button
              type="button"
              onClick={handleClearAll}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 whitespace-nowrap border border-slate-200"
              title="Voltar para todos os produtos"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar filtros</span>
            </button>
          )}

        </div>

        {/* Janelinha Suspensa Flutuante no Hover das Categorias (Escala Confortável e Ampla no Desktop) */}
        {hoveredDeptId && hoveredCategories.length > 0 && (
          <div
            onMouseEnter={handleDropdownEnter}
            onMouseLeave={handleMouseLeave}
            className="hidden md:block absolute top-full mt-1.5 bg-white rounded-3xl border border-slate-200 shadow-2xl p-4 sm:p-5 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
            style={{
              left: `${dropdownLeft}px`,
              width: hoveredCategories.length > 6 ? '480px' : '360px',
              maxWidth: 'calc(100vw - 32px)',
            }}
          >
            <div className="pb-3 mb-2.5 border-b border-slate-100 flex items-center justify-between px-1">
              <span className="text-xs font-black uppercase tracking-wider text-zeiq-black flex items-center gap-2">
                {hoveredDeptId === 'lancamentos' ? (
                  <span className="text-amber-600 flex items-center gap-1">
                    <span>🔥</span>
                    <span>Lançamentos Oficiais</span>
                  </span>
                ) : (
                  <span>{hoveredDeptObj?.name}</span>
                )}
              </span>
              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {hoveredDeptId === 'lancamentos' ? lancamentosCount : (hoveredDeptObj ? departmentCounts[hoveredDeptObj.id] : 0)} itens
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleDepartmentClick(hoveredDeptId)}
              className="w-full text-left py-2 px-3 rounded-xl mb-2 text-xs sm:text-sm font-bold bg-slate-50 hover:bg-zeiq-black hover:text-white text-zeiq-black border border-slate-200/80 flex items-center justify-between transition-colors group cursor-pointer"
            >
              <span>{hoveredDeptId === 'lancamentos' ? 'Ver Todos os Lançamentos' : `Ver Todos de ${hoveredDeptObj?.shortName || ''}`}</span>
              <ArrowRight className="w-4 h-4 opacity-60 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <div className={`overflow-y-auto no-scrollbar max-h-80 ${
              hoveredCategories.length > 6 ? 'grid grid-cols-2 gap-1.5' : 'space-y-1'
            }`}>
              {hoveredCategories.map((cat) => {
                const count = categoryCounts[cat.slug] || categoryCounts[cat.name] || 0;
                const isSelected = selectedDepartment === hoveredDeptId && selectedCategory === cat.slug;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSubcategoryClick(hoveredDeptId, cat.slug)}
                    className={`w-full text-left py-2 px-2.5 rounded-xl text-xs sm:text-sm transition-colors flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-zeiq-black text-white font-bold'
                        : 'text-slate-700 hover:text-zeiq-black hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate pr-1.5">{cat.name}</span>
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md shrink-0 ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* NÍVEL 2: Faixa Contextual de Subcategorias em ORDEM ALFABÉTICA (Escala Confortável no Desktop) */}
        {activeSubcategories.length > 0 && (
          <div className="pt-2 pb-2.5 border-t border-slate-100 flex items-center gap-1.5 lg:gap-2 overflow-x-auto no-scrollbar scroll-smooth w-full px-4 sm:px-6 lg:px-0">
            
            {/* Pílula de "Ver Todos" do Departamento ou Lançamentos Selecionado */}
            {selectedDepartment === 'lancamentos' && (
              <button
                type="button"
                onClick={() => onSelectCategory(null)}
                className={`whitespace-nowrap px-3 lg:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                  selectedCategory === null
                    ? 'bg-amber-400 text-amber-950 font-extrabold shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <span>🔥 Ver Todos os Lançamentos</span>
                <span className="text-[10px] lg:text-xs opacity-80 font-mono">({lancamentosCount})</span>
              </button>
            )}

            {selectedDepartment !== 'all' && selectedDepartment !== 'lancamentos' && activeDepartmentObj && (
              <button
                type="button"
                onClick={() => onSelectCategory(null)}
                className={`whitespace-nowrap px-3 lg:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                  selectedCategory === null
                    ? 'bg-zeiq-orange text-zeiq-black font-extrabold shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <span>Ver Todos de {activeDepartmentObj.shortName}</span>
                <span className="text-[10px] lg:text-xs opacity-80 font-mono">({departmentCounts[selectedDepartment]})</span>
              </button>
            )}

            {/* Pílulas das Subcategorias em Ordem Alfabética Rigorosa */}
            {activeSubcategories.map((cat) => {
              const isCatSelected = selectedCategory === cat.slug;
              const count = categoryCounts[cat.slug] || categoryCounts[cat.name] || 0;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelectCategory(cat.slug)}
                  className={`whitespace-nowrap px-3 lg:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                    isCatSelected
                      ? 'bg-zeiq-black text-white font-bold shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span
                    className={`text-[10px] lg:text-xs font-mono font-bold px-1.5 py-0.2 rounded ${
                      isCatSelected ? 'bg-white/20 text-white' : 'text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Espaçador de respiro lateral no mobile/tablet */}
            <div className="w-3 sm:w-5 shrink-0 lg:hidden" aria-hidden="true" />
          </div>
        )}

      </div>
    </div>
  );
}
