'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Search, ShoppingBag, X, Package, ArrowRight, Sparkles, LogOut, User, ShieldCheck, ChevronDown, Briefcase } from 'lucide-react';
import { AvatarIcon } from '@/lib/constants/avatars';
import { useQuoteCart } from '@/lib/store/quote-cart';
import { Product } from '@/types';
import { normalizeSearchText } from '@/components/CatalogClient';
import { createClient } from '@/lib/supabase/client';
import { triggerCartImpact } from '@/lib/utils/cart-animation';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  products?: Product[];
  onSelectProduct?: (product: Product) => void;
}

export function Header({ searchQuery, onSearchChange, products = [], onSelectProduct }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userAvatarStyle, setUserAvatarStyle] = useState('avatar-fire');

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const items = useQuoteCart((state) => state.items);
  const setIsOpen = useQuoteCart((state) => state.setIsOpen);

  useEffect(() => {
    const handleCartArrived = () => {
      const cartBtn = document.getElementById('header-cart-button');
      if (cartBtn) {
        triggerCartImpact(cartBtn);
      }
    };

    window.addEventListener('cart-item-arrived', handleCartArrived);
    return () => window.removeEventListener('cart-item-arrived', handleCartArrived);
  }, []);

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('zeiq_admin_avatar');
      if (saved) setUserAvatarStyle(saved);
    }
  }, []);

  const totalItems = mounted ? items.reduce((acc, item) => acc + item.quantity, 0) : 0;

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Produtos correspondentes para o dropdown ao vivo
  const previewMatches = React.useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    if (!q || q.length < 2 || !products || products.length === 0) return [];

    const tokens = q.split(/\s+/).filter(Boolean);
    return products.filter((p) => {
      const normName = normalizeSearchText(p.name);
      const normSku = normalizeSearchText(p.code_sku);
      const normTags = (p.tags || []).map(normalizeSearchText).join(' ');
      const normCategories = (p.categories || []).map((c) => normalizeSearchText(c.name)).join(' ');
      const searchable = `${normName} ${normSku} ${normCategories} ${normTags}`;
      return tokens.every((token) => searchable.includes(token));
    });
  }, [searchQuery, products]);

  const handleInputChange = (val: string) => {
    onSearchChange(val);
    if (val.trim().length >= 2) {
      setIsDropdownOpen(true);
    } else {
      setIsDropdownOpen(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsDropdownOpen(false);

    if (pathname !== '/') {
      router.push(`/?search=${encodeURIComponent(searchQuery)}`);
      return;
    }

    const gridElem = document.getElementById('catalog-products-grid');
    if (gridElem) {
      gridElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSelectPreviewProduct = (product: Product) => {
    setIsDropdownOpen(false);
    if (onSelectProduct) {
      onSelectProduct(product);
    } else {
      onSearchChange(product.code_sku || product.name);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zeiq-muted">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-3 lg:gap-4">
          
          {/* Logo Oficial Zeiq em Proporção Perfeita */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div
              className="relative h-8 sm:h-9 w-28 sm:w-36 transition-opacity hover:opacity-85 flex items-center"
              style={{ position: 'relative', width: '130px', height: '36px', maxWidth: '100%' }}
            >
              <Image
                src="/images/logo-zeiq.png"
                alt="Zeiq Sports"
                width={130}
                height={36}
                priority
                className="h-full w-auto object-contain object-left"
                style={{ width: 'auto', height: '100%', maxHeight: '36px', objectFit: 'contain' }}
              />
            </div>
            <div className="hidden xl:flex flex-col border-l border-zeiq-muted pl-3">
              <span className="text-xs font-bold tracking-wider text-zeiq-black uppercase">
                Revenda B2B
              </span>
              <span className="text-xs font-medium text-slate-500">
                Catálogo Oficial
              </span>
            </div>
          </Link>

          {/* Campo de Busca em Tempo Real com Dropdown Autocomplete (Desktop & Tablet) */}
          <div ref={searchContainerRef} className="flex-1 min-w-0 md:max-w-[200px] lg:max-w-sm xl:max-w-lg hidden md:block relative">
            <form onSubmit={handleSearchSubmit} className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onFocus={() => {
                  if (searchQuery.trim().length >= 2) setIsDropdownOpen(true);
                }}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="Pesquisar por modelo, código SKU ou categoria..."
                className="w-full h-10 pl-10 pr-9 py-2 text-xs sm:text-sm bg-zeiq-light border border-zeiq-muted rounded-xl text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black focus:border-zeiq-black transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange('');
                    setIsDropdownOpen(false);
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-zeiq-black transition-colors"
                  aria-label="Limpar pesquisa"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </form>

            {/* Dropdown de Resultados Rápidos ao Vivo */}
            {isDropdownOpen && searchQuery.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden z-50">
                <div className="bg-[#f8f9fa] px-4 py-2 border-b border-slate-200/80 flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span>Resultados da busca ({previewMatches.length})</span>
                  <span>Pressione Enter para ver tudo</span>
                </div>

                {previewMatches.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    <p className="font-semibold text-slate-600">Nenhum produto correspondente</p>
                    <p className="text-xs text-slate-400 mt-0.5">Tente buscar por &quot;camiseta&quot;, &quot;raquete&quot;, &quot;bone&quot; ou pelo código SKU.</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {previewMatches.slice(0, 5).map((prod) => {
                      const cover = prod.images && prod.images.length > 0 ? prod.images[0].public_url : '/placeholder-product.svg';
                      return (
                        <div
                          key={prod.id}
                          onClick={() => handleSelectPreviewProduct(prod)}
                          className="p-3 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-3 group"
                        >
                          <div className="w-11 h-11 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                            <img src={cover} alt={prod.name} className="w-full h-full object-cover object-top" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {prod.code_sku && (
                                <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-zeiq-black text-white">
                                  {prod.code_sku}
                                </span>
                              )}
                              {prod.categories && prod.categories.length > 0 && (
                                <span className="text-xs text-slate-400 uppercase font-bold truncate">
                                  {prod.categories[0].name}
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs font-semibold text-zeiq-black truncate group-hover:text-zeiq-orange transition-colors">
                              {prod.name}
                            </h4>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-zeiq-black group-hover:translate-x-0.5 transition-all shrink-0" />
                        </div>
                      );
                    })}

                    {previewMatches.length > 5 && (
                      <button
                        type="button"
                        onClick={handleSearchSubmit}
                        className="w-full py-2.5 px-4 text-center text-xs font-bold bg-[#f8f9fa] hover:bg-slate-100 text-zeiq-black transition-colors flex items-center justify-center gap-1.5"
                      >
                        <span>Ver todos os {previewMatches.length} produtos no catálogo</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ação: Botões de Meus Pedidos e Lista de Pedido */}
          <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 shrink-0">
            {/* Botão de Busca no Mobile */}
            <button
              type="button"
              onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
              className="md:hidden w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl border border-zeiq-muted text-slate-700 hover:text-zeiq-black hover:border-slate-300 bg-white shadow-2xs transition-all shrink-0 active:scale-95 cursor-pointer"
              aria-label="Buscar no catálogo"
            >
              <Search className="w-4 h-4 text-slate-700" />
            </button>

            <Link
              href="/portal"
              className="inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 w-9 sm:w-10 md:w-auto px-0 md:px-3 lg:px-3.5 rounded-xl border border-zeiq-muted hover:border-zeiq-black bg-white hover:bg-slate-50 text-zeiq-black font-semibold text-xs sm:text-sm transition-all shadow-2xs shrink-0 whitespace-nowrap active:scale-95"
              title="Acompanhar meus pedidos e cotações"
            >
              <Package className="w-4 h-4 text-slate-700 shrink-0" />
              <span className="hidden xl:inline">Meus Pedidos</span>
              <span className="hidden md:inline xl:hidden">Pedidos</span>
            </Link>

            <button
              id="header-cart-button"
              onClick={() => setIsOpen(true)}
              className="relative inline-flex items-center justify-center gap-1.5 sm:gap-2 h-9 sm:h-10 px-2.5 sm:px-3 lg:px-4 bg-zeiq-black hover:bg-zeiq-charcoal text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors active:scale-95 shadow-xs shrink-0 whitespace-nowrap cursor-pointer"
              aria-label="Abrir lista de pedido"
            >
              <ShoppingBag className="w-4 h-4 shrink-0 text-white" />
              <span className="font-semibold hidden lg:inline">Lista de Pedido</span>
              <span className="font-semibold hidden sm:inline lg:hidden">Lista</span>
              {mounted && totalItems > 0 && (
                <span
                  className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full bg-white text-zeiq-black transition-transform"
                >
                  {totalItems}
                </span>
              )}
            </button>

            {/* 3. Chip Executivo de Perfil & Menu Suspenso (Desktop, Tablet e Mobile) */}
            {mounted && currentUser && (
              <div ref={profileRef} className="relative shrink-0">
                {(() => {
                  const userDisplayName = currentUser.user_metadata?.store_name || currentUser.user_metadata?.contact_name || currentUser.email?.split('@')[0] || 'Parceiro';
                  const userInitial = (userDisplayName[0] || 'Z').toUpperCase();
                  const userAvatarUrl = currentUser.user_metadata?.avatar_url;
                  const userEmail = currentUser.email?.toLowerCase().trim();
                  const isMaster = userEmail === 'marketing@zeiq.com.br' || userEmail === 'patrickbrank@outlook.com';
                  const userRole = currentUser.app_metadata?.role || currentUser.user_metadata?.role;
                  const isRepresentative = userRole === 'representative';
                  const isResellerUser = userRole === 'ROLE_RESELLER' || isRepresentative;
                  const isMasterOrAdmin = isMaster || ['master', 'admin', 'stock', 'representative'].includes(userRole);

                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center justify-center gap-1.5 lg:gap-2 h-9 sm:h-10 w-9 sm:w-10 lg:w-auto p-0 lg:pl-1.5 lg:pr-2.5 rounded-full lg:rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/90 transition-all text-left shadow-2xs group cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
                        title="Abrir menu da conta"
                        aria-expanded={isProfileOpen}
                      >
                        {/* Avatar Circular com Inicial ou Imagem do Perfil */}
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-zeiq-black text-white text-xs font-black flex items-center justify-center shrink-0 border border-white/20 shadow-xs ring-2 ring-black/5 overflow-hidden">
                          {userAvatarUrl ? (
                            <img src={userAvatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (isMasterOrAdmin || isResellerUser) ? (
                            <AvatarIcon avatarId={userAvatarStyle} className="w-full h-full" emojiClassName="text-base sm:text-lg" />
                          ) : (
                            userInitial
                          )}
                        </div>

                        {/* Nome do Usuário em Linha Única */}
                        <span className="hidden lg:inline-block text-xs font-bold text-zeiq-black truncate max-w-[90px] xl:max-w-[120px] leading-none">
                          {userDisplayName}
                        </span>

                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-zeiq-black transition-transform duration-200 hidden lg:block ${isProfileOpen ? 'rotate-180 text-zeiq-black' : ''}`} />
                      </button>

                      {/* Popover Card Flutuante de Perfil */}
                      {isProfileOpen && (
                        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-1">
                          {/* Cabeçalho do Card */}
                          <div className="flex items-start gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 mb-2">
                            <div className="w-10 h-10 rounded-full bg-zeiq-black text-white text-sm font-black flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
                              {userAvatarUrl ? (
                                <img src={userAvatarUrl} alt="" className="w-full h-full object-cover" />
                              ) : (isMasterOrAdmin || isResellerUser) ? (
                                <AvatarIcon avatarId={userAvatarStyle} className="w-full h-full" emojiClassName="text-2xl" />
                              ) : (
                                userInitial
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-zeiq-black truncate">
                                {userDisplayName}
                              </h4>
                              <p className="text-xs font-mono text-slate-500 truncate mt-0.5">
                                {currentUser.email}
                              </p>
                              <div className="mt-1.5">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                  isMasterOrAdmin || isResellerUser
                                    ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isMasterOrAdmin || isResellerUser ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                  {isMaster
                                    ? 'Diretoria (Master)'
                                    : isRepresentative
                                    ? 'Representante Comercial'
                                    : isResellerUser
                                    ? 'Revendedor Autorizado'
                                    : userRole === 'stock'
                                    ? 'Controle de Estoque'
                                    : isMasterOrAdmin
                                    ? 'Administrador Zeiq'
                                    : 'Lojista Autorizado'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Ações Rápidas */}
                          <div className="space-y-1">
                            {isResellerUser && (
                              <Link
                                href="/revendedor"
                                onClick={() => setIsProfileOpen(false)}
                                className="w-full flex items-center justify-between p-2 rounded-lg text-xs font-semibold text-zeiq-black hover:bg-amber-50 hover:text-amber-950 transition-colors border border-transparent hover:border-amber-200/80"
                              >
                                <div className="flex items-center gap-2">
                                  <Briefcase className="w-4 h-4 text-zeiq-orange" />
                                  <span>{isRepresentative ? 'Painel do Representante' : 'Painel do Revendedor'}</span>
                                </div>
                                <span className="text-xs font-mono font-bold bg-zeiq-orange text-black px-1.5 py-0.5 rounded">
                                  {isRepresentative ? 'REPRESENTANTE' : 'REVENDEDOR'}
                                </span>
                              </Link>
                            )}

                            {!isResellerUser && (
                              <Link
                                href="/portal"
                                onClick={() => setIsProfileOpen(false)}
                                className="w-full flex items-center justify-between p-2 rounded-lg text-xs font-semibold text-slate-700 hover:text-zeiq-black hover:bg-slate-100 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <Package className="w-4 h-4 text-slate-500" />
                                  <span>Meus Pedidos & Cotações</span>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                              </Link>
                            )}

                            {isMasterOrAdmin && (
                              <Link
                                href="/admin"
                                onClick={() => setIsProfileOpen(false)}
                                className="w-full flex items-center justify-between p-2 rounded-lg text-xs font-semibold text-zeiq-black hover:bg-amber-50 hover:text-amber-950 transition-colors border border-transparent hover:border-amber-200/80"
                              >
                                <div className="flex items-center gap-2">
                                  <ShieldCheck className="w-4 h-4 text-zeiq-orange" />
                                  <span>Painel Administrativo B2B</span>
                                </div>
                                <span className="text-xs font-mono font-bold bg-zeiq-orange text-black px-1.5 py-0.5 rounded">
                                  {isMaster ? 'MASTER' : userRole === 'representative' ? 'REPRESENTANTE' : userRole === 'stock' ? 'ESTOQUE' : 'ADMIN'}
                                </span>
                              </Link>
                            )}
                          </div>

                          {/* Linha de Logout */}
                          <div className="pt-2 mt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => {
                                setIsProfileOpen(false);
                                handleLogout();
                              }}
                              className="w-full flex items-center justify-between p-2 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <LogOut className="w-4 h-4" />
                                <span>Sair da Conta</span>
                              </div>
                              <span className="text-xs text-slate-400 font-mono">Logout</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Barra de Busca Expansível no Mobile */}
        {isMobileSearchOpen && (
          <div className="md:hidden pb-3 pt-1 border-t border-slate-100">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="Pesquisar por modelo ou SKU..."
                className="w-full pl-9 pr-9 py-2 text-xs bg-zeiq-light border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
