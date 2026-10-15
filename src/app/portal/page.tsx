'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  Search,
  RotateCcw,
  MessageCircle,
  Printer,
  ChevronDown,
  ChevronUp,
  Building2,
  User,
  Phone,
  Mail,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  ShoppingBag,
  Layers,
  X,
  Sparkles,
  TrendingUp,
  Eye,
  LogOut,
} from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { createClient } from '@/lib/supabase/client';
import { useQuoteCart } from '@/lib/store/quote-cart';
import { Order, OrderStatus, QuoteItem, StoreSettings } from '@/types';

// Mapeamento dos 5 estágios de pedidos B2B
const STATUS_STEPS: { key: OrderStatus; label: string; description: string }[] = [
  { key: 'pending', label: 'Cotação Recebida', description: 'Em análise pelo time comercial' },
  { key: 'approved', label: 'Aprovado', description: 'Condições comerciais confirmadas' },
  { key: 'processing', label: 'Em Separação', description: 'Montagem e conferência da grade' },
  { key: 'shipped', label: 'Despachado', description: 'Em transporte até a sua arena/loja' },
  { key: 'delivered', label: 'Entregue', description: 'Pedido recebido com sucesso' },
];

// Pedido demonstrativo para quando o visitante ainda não tiver enviado cotações
const DEMO_ORDER: Order = {
  id: 'demo-order-1',
  order_number: 'ZEIQ-1048',
  buyer_name: 'Revendedor Exemplo',
  buyer_company: 'Arena Beach Point',
  buyer_phone: '16999999999',
  buyer_email: 'contato@arenabeach.com.br',
  status: 'shipped',
  tracking_code: 'BR839210492JB',
  tracking_url: 'https://rastreamento.correios.com.br/',
  total_pieces: 18,
  created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  commercial_notes: 'Lote faturado e despachado via Jadlog Expresso. Previsão de chegada em 2 dias úteis.',
  customer_notes: 'Reposição para torneio do final de semana.',
  items: [
    {
      productId: 'p-demo-1',
      productName: 'Camiseta Performance Beach Tennis Zeiq Pro Dry',
      productSlug: 'camiseta-pro-dry',
      sku: 'CAM-ZEIQ-01',
      quantity: 10,
      sizeBreakdown: { PP: 1, P: 3, M: 4, G: 2 },
    },
    {
      productId: 'p-demo-2',
      productName: 'Bermuda Esportiva Zeiq Beach Flex 4-Way',
      productSlug: 'bermuda-beach-flex',
      sku: 'BER-ZEIQ-02',
      quantity: 8,
      sizeBreakdown: { P: 2, M: 4, G: 2 },
    },
  ],
};

export default function ResellerPortalPage() {
  const router = useRouter();
  const loadOrderItems = useQuoteCart((state) => state.loadOrderItems);
  const setIsOpenCart = useQuoteCart((state) => state.setIsOpen);

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showDemo, setShowDemo] = useState(false);

  // Filtros da página
  const [activeTab, setActiveTab] = useState<'all' | 'ongoing' | 'delivered' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal de Impressão / Espelho do Pedido
  const [printOrder, setPrintOrder] = useState<Order | null>(null);

  // Modo Rastreio Rápido Avulso
  const [quickOrderNumber, setQuickOrderNumber] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickResult, setQuickResult] = useState<Order | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);

  // Toast de repetição de pedido
  const [reorderSuccessMsg, setReorderSuccessMsg] = useState<string | null>(null);

  // Configurações dinâmicas de contato
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.settings) setStoreSettings(data.settings);
      })
      .catch(() => {});
  }, []);

  // Carrega pedidos salvos localmente e via API
  useEffect(() => {
    async function loadAllOrders() {
      const combinedOrders: Order[] = [];

      // 1. Carrega pedidos salvos no localStorage deste dispositivo
      try {
        const localData = localStorage.getItem('zeiq_recent_orders');
        if (localData) {
          const parsed = JSON.parse(localData);
          if (Array.isArray(parsed)) {
            combinedOrders.push(...parsed);
          }
        }
      } catch (e) {
        console.warn('Erro ao ler pedidos locais:', e);
      }

      // 2. Consulta API para buscar pedidos da conta autenticada
      try {
        const res = await fetch('/api/orders');
        const data = await res.json();

        if (data.authenticated && data.user) {
          setUser(data.user);
          setProfile(data.user.profile || null);

          if (Array.isArray(data.orders)) {
            data.orders.forEach((apiOrder: Order) => {
              // Evita duplicatas se o pedido já estiver no localStorage
              if (!combinedOrders.some((o) => o.order_number === apiOrder.order_number)) {
                combinedOrders.push(apiOrder);
              }
            });
          }
        }
      } catch (err) {
        console.warn('Aviso ao carregar dados online:', err);
      }

      // Ordena por data mais recente
      combinedOrders.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

      setOrders(combinedOrders);
      if (combinedOrders.length > 0) {
        setExpandedOrderId(combinedOrders[0].id);
      }

      setLoading(false);
    }

    loadAllOrders();
  }, []);

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      router.refresh();
    } catch (e) {
      console.error('Erro ao sair:', e);
    }
  };

  // Consulta Rápida por Código do Pedido (com verificação local + online)
  const handleQuickTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = quickOrderNumber.trim().toUpperCase();
    if (!query) return;

    setQuickLoading(true);
    setQuickError(null);
    setQuickResult(null);

    // Primeiro verifica nos pedidos locais
    const localMatch = orders.find((o) => o.order_number.toUpperCase() === query);
    if (localMatch) {
      setQuickResult(localMatch);
      setQuickLoading(false);
      return;
    }

    if (query === 'ZEIQ-1048') {
      setQuickResult(DEMO_ORDER);
      setQuickLoading(false);
      return;
    }

    // Se não encontrou localmente, consulta na API
    try {
      const res = await fetch(`/api/orders?order_number=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (data.success && data.order) {
        setQuickResult(data.order);
      } else {
        setQuickError(
          data.error || `Nenhum pedido encontrado com o código "${query}". Verifique se o código foi digitado corretamente.`
        );
      }
    } catch (err) {
      setQuickError('Não foi possível verificar no momento. Tente novamente em instantes.');
    } finally {
      setQuickLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Repetir Pedido (carrega itens na lista de cotação e abre o drawer)
  const handleReorder = (order: Order) => {
    if (!order.items || order.items.length === 0) return;
    loadOrderItems(order.items);
    setReorderSuccessMsg(`Itens do pedido #${order.order_number} carregados na sua Lista de Pedido!`);
    setTimeout(() => {
      setReorderSuccessMsg(null);
    }, 4500);
  };

  // WhatsApp comercial direto sobre determinado pedido
  const getWhatsAppOrderLink = (order: Order) => {
    const phone = storeSettings?.whatsappNumber || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5516991667020';
    const cleanPhone = phone.replace(/\D/g, '');
    const text = encodeURIComponent(
      `Olá Zeiq Sports! Gostaria de falar sobre o andamento do meu pedido *#${order.order_number}* (Loja: ${
        order.buyer_company || order.buyer_name
      }). Poderiam me atualizar, por favor?`
    );
    return `https://wa.me/${cleanPhone}?text=${text}`;
  };

  // Lista de pedidos efetiva (inclui o demo se ativado)
  const effectiveOrders = useMemo(() => {
    if (orders.length === 0 && showDemo) {
      return [DEMO_ORDER];
    }
    return orders;
  }, [orders, showDemo]);

  // Contadores e métricas
  const ongoingOrders = useMemo(() => {
    return effectiveOrders.filter((o) => ['pending', 'approved', 'processing', 'shipped'].includes(o.status));
  }, [effectiveOrders]);

  const deliveredOrders = useMemo(() => {
    return effectiveOrders.filter((o) => o.status === 'delivered');
  }, [effectiveOrders]);

  const cancelledOrders = useMemo(() => {
    return effectiveOrders.filter((o) => o.status === 'cancelled');
  }, [effectiveOrders]);

  const totalPiecesCount = useMemo(() => {
    return effectiveOrders.reduce((sum, o) => sum + (o.total_pieces || 0), 0);
  }, [effectiveOrders]);

  // Filtra pedidos da aba ativa e busca
  const filteredOrders = useMemo(() => {
    let list = effectiveOrders;

    if (activeTab === 'ongoing') {
      list = ongoingOrders;
    } else if (activeTab === 'delivered') {
      list = deliveredOrders;
    } else if (activeTab === 'cancelled') {
      list = cancelledOrders;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((o) => {
        const matchesNum = o.order_number.toLowerCase().includes(q);
        const matchesItem = o.items?.some(
          (it) => it.productName.toLowerCase().includes(q) || (it.sku && it.sku.toLowerCase().includes(q))
        );
        return matchesNum || matchesItem;
      });
    }

    return list;
  }, [effectiveOrders, activeTab, ongoingOrders, deliveredOrders, cancelledOrders, searchQuery]);

  // Formatação de data em PT-BR
  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Data recente';
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return isoString;
    }
  };

  // Badges de status no padrão visual do site
  const renderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            Cotação Recebida / Em Análise
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            Aprovado pelo Comercial
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <Package className="w-3.5 h-3.5 text-indigo-600" />
            Em Separação & Grade
          </span>
        );
      case 'shipped':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200 shadow-2xs">
            <Truck className="w-3.5 h-3.5 text-purple-600 animate-bounce" />
            Enviado / Em Transporte
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            Entregue
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            Cancelado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const getStepProgressIndex = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return 0;
      case 'approved':
        return 1;
      case 'processing':
        return 2;
      case 'shipped':
        return 3;
      case 'delivered':
        return 4;
      case 'cancelled':
        return -1;
      default:
        return 0;
    }
  };

  return (
    <div className="min-h-screen bg-zeiq-light text-zeiq-black font-sans flex flex-col">
      {/* 1. Header Oficial do Site com Busca e Carrinho */}
      <Header searchQuery="" onSearchChange={() => {}} />

      {/* Toast flutuante de Repetição de Pedido */}
      {reorderSuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-zeiq-black text-white p-4 rounded-xl shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold leading-relaxed">{reorderSuccessMsg}</p>
          </div>
          <button
            onClick={() => setIsOpenCart(true)}
            className="px-3 py-1.5 bg-white hover:bg-slate-200 text-zeiq-black font-bold text-xs rounded-lg transition-colors shrink-0"
          >
            Ver Gaveta
          </button>
        </div>
      )}

      {/* 2. Barra de Navegação e Contexto da Página */}
      <section className="bg-white border-b border-zeiq-muted py-6">
        <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Link
                  href="/"
                  className="text-xs font-semibold text-slate-500 hover:text-zeiq-black transition-colors"
                >
                  Catálogo
                </Link>
                <span className="text-slate-400 text-xs">/</span>
                <span className="text-xs font-bold text-zeiq-black">Meus Pedidos & Cotações</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-zeiq-black tracking-tight">
                Acompanhamento de Pedidos B2B
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Consulte o status em tempo real, rastreie envios e repita pedidos com um clique.
              </p>
            </div>

            {/* Ações da Conta de Lojista */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {user ? (
                <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
                  <div className="text-right">
                    <span className="text-xs font-bold text-zeiq-black block">
                      {profile?.store_name || user.email}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {profile?.contact_name ? `Resp: ${profile.contact_name}` : 'Lojista Autorizado'}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors"
                    title="Sair da conta"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/portal/login"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zeiq-black hover:bg-zeiq-charcoal text-white text-xs font-bold transition-all shadow-xs"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Entrar na Minha Conta</span>
                  </Link>
                  <Link
                    href="/portal/login"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all border border-slate-200"
                  >
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Criar Cadastro Lojista</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 space-y-6">
        
        {/* 3. Seção de Rastreio Rápido por Código */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-zeiq-black uppercase tracking-wider flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-700" />
                Rastrear Pedido por Código
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Digite o código da cotação recebido no WhatsApp (ex: <strong>ZEIQ-1048</strong>).
              </p>
            </div>

            {orders.length === 0 && !showDemo && (
              <button
                type="button"
                onClick={() => setShowDemo(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors border border-emerald-200 self-start sm:self-auto"
              >
                <Eye className="w-3.5 h-3.5" />
                Ver Demonstração de Pedido
              </button>
            )}
          </div>

          <form onSubmit={handleQuickTrack} className="flex flex-col sm:flex-row gap-2.5 max-w-2xl">
            <div className="relative flex-1">
              <input
                type="text"
                required
                value={quickOrderNumber}
                onChange={(e) => setQuickOrderNumber(e.target.value.toUpperCase())}
                placeholder="Ex: ZEIQ-1048"
                className="w-full pl-3.5 pr-8 py-2.5 bg-[#f8f9fa] border border-slate-200 rounded-xl text-base sm:text-sm font-mono font-bold text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black uppercase"
              />
              {quickOrderNumber && (
                <button
                  type="button"
                  onClick={() => setQuickOrderNumber('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-zeiq-black"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={quickLoading || !quickOrderNumber.trim()}
              className="h-10 px-5 bg-zeiq-black hover:bg-zeiq-charcoal disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              {quickLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  Localizar Pedido
                </>
              )}
            </button>
          </form>

          {/* Feedback de erro no rastreio rápido */}
          {quickError && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{quickError}</span>
            </div>
          )}

          {/* Resultado da Busca Rápida */}
          {quickResult && (
            <div className="mt-4 p-4 sm:p-5 bg-slate-50/90 border border-slate-200 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 text-zeiq-black flex items-center justify-center font-bold">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-zeiq-black flex items-center gap-2 font-mono">
                      #{quickResult.order_number}
                      <button
                        type="button"
                        onClick={() => handleCopy(quickResult.order_number, 'quick-num')}
                        className="text-slate-400 hover:text-zeiq-black"
                        title="Copiar código"
                      >
                        {copiedCode === 'quick-num' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Realizado em {formatDate(quickResult.created_at)} • {quickResult.buyer_company || quickResult.buyer_name}
                    </p>
                  </div>
                </div>

                <div>{renderStatusBadge(quickResult.status)}</div>
              </div>

              {/* Rastreamento Logístico */}
              {quickResult.tracking_code && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-purple-800 uppercase block">
                      Código de Rastreamento:
                    </span>
                    <span className="text-xs font-mono font-bold text-purple-900">
                      {quickResult.tracking_code}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(quickResult.tracking_code!, 'quick-tr')}
                      className="px-2.5 py-1 bg-white border border-purple-200 text-purple-900 hover:bg-purple-100 rounded text-xs font-semibold"
                    >
                      {copiedCode === 'quick-tr' ? 'Copiado!' : 'Copiar'}
                    </button>
                    {quickResult.tracking_url && (
                      <a
                        href={quickResult.tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded text-xs font-semibold flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Acompanhar Envio
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Ações do resultado */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                <span className="text-slate-500">
                  Total: <strong className="text-zeiq-black">{quickResult.total_pieces} peças</strong> ({quickResult.items?.length || 0} modelos)
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReorder(quickResult)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-zeiq-black rounded-lg font-bold text-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-700" />
                    Repetir Pedido
                  </button>

                  <a
                    href={getWhatsAppOrderLink(quickResult)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Falar no WhatsApp
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. Cards de Métricas em Tempo Real */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Em Andamento
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-zeiq-black">
                {ongoingOrders.length}
              </span>
              {ongoingOrders.length > 0 && (
                <span className="text-[11px] font-bold text-emerald-600">ativos</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Cotações em análise ou trânsito</p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Entregues
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-zeiq-black">
                {deliveredOrders.length}
              </span>
              <span className="text-[11px] text-slate-400">pedidos</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Histórico concluído</p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Peças Solicitadas
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-zeiq-black">
                {totalPiecesCount}
              </span>
              <span className="text-[11px] text-slate-400">unidades</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Grade acumulada</p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total de Pedidos
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-zeiq-black">
                {effectiveOrders.length}
              </span>
              <span className="text-[11px] text-slate-400">registros</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Histórico completo</p>
          </div>
        </div>

        {/* 5. Lista de Pedidos com Filtro por Abas */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-zeiq-black flex items-center gap-2">
                <Package className="w-4 h-4 text-zeiq-orange" />
                Histórico de Pedidos & Cotações
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Visualize todos os modelos solicitados, a grade por tamanho e repita compras com facilidade.
              </p>
            </div>

            {/* Campo de Busca Rápida */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar por código ou produto..."
                className="w-full pl-9 pr-7 py-2 text-base sm:text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-zeiq-black"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Abas de Status */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-zeiq-black text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              Todos
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-white text-slate-700'
              }`}>
                {effectiveOrders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('ongoing')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'ongoing'
                  ? 'bg-zeiq-black text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Em Andamento
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'ongoing' ? 'bg-white/20 text-white' : 'bg-white text-slate-700'
              }`}>
                {ongoingOrders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('delivered')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'delivered'
                  ? 'bg-zeiq-black text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              Entregues
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'delivered' ? 'bg-white/20 text-white' : 'bg-white text-slate-700'
              }`}>
                {deliveredOrders.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('cancelled')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'cancelled'
                  ? 'bg-zeiq-black text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              Cancelados
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'cancelled' ? 'bg-white/20 text-white' : 'bg-white text-slate-700'
              }`}>
                {cancelledOrders.length}
              </span>
            </button>
          </div>

          {/* Listagem de Cards de Pedidos */}
          {loading ? (
            <div className="py-16 text-center">
              <div className="inline-block w-8 h-8 border-2 border-zeiq-black border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs text-slate-500">Carregando pedidos...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 px-4 text-center rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-400 shadow-2xs">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-zeiq-black">Nenhum pedido encontrado nesta lista</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Você ainda não possui cotações recentes gravadas neste navegador. Crie uma cotação no catálogo para acompanhar seu pedido em tempo real.
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zeiq-black hover:bg-zeiq-charcoal text-white text-xs font-bold transition-all shadow-xs"
                >
                  Explorar Catálogo Zeiq
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                {!showDemo && (
                  <button
                    onClick={() => setShowDemo(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Ver Exemplo de Rastreio
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const currentStepIdx = getStepProgressIndex(order.status);

                return (
                  <div
                    key={order.id}
                    className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-2xs hover:border-slate-300 transition-all"
                  >
                    {/* Cabeçalho do Pedido */}
                    <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#fbfcfd] border-b border-slate-100">
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-zeiq-black font-mono font-bold text-xs shrink-0 shadow-2xs">
                          {order.order_number.replace('ZEIQ-', '#')}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-zeiq-black font-mono">
                              Pedido {order.order_number}
                            </h4>
                            <button
                              onClick={() => handleCopy(order.order_number, order.id)}
                              className="text-slate-400 hover:text-zeiq-black transition-colors"
                              title="Copiar número"
                            >
                              {copiedCode === order.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <span className="text-slate-300 hidden sm:inline">•</span>
                            <span className="text-xs text-slate-500">
                              {formatDate(order.created_at)}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-0.5 text-[11px] text-slate-500">
                            <span>
                              Total: <strong className="text-zeiq-black">{order.total_pieces} peças</strong> ({order.items?.length || 0} modelos)
                            </span>
                            {order.buyer_company && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span>Loja: <strong className="text-zeiq-black">{order.buyer_company}</strong></span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        {renderStatusBadge(order.status)}

                        <button
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <span>{isExpanded ? 'Ocultar' : 'Detalhes'}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Linha do Tempo Visual (5 Etapas) */}
                    <div className="px-4 sm:px-6 py-4 bg-[#f8f9fa] border-b border-slate-100">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {STATUS_STEPS.map((step, idx) => {
                          const isCompleted = currentStepIdx >= idx && order.status !== 'cancelled';
                          const isCurrent = currentStepIdx === idx && order.status !== 'cancelled';

                          return (
                            <div
                              key={step.key}
                              className={`p-2.5 rounded-xl border text-center transition-all ${
                                isCurrent
                                  ? 'bg-white border-zeiq-black text-zeiq-black ring-1 ring-zeiq-black shadow-xs'
                                  : isCompleted
                                  ? 'bg-white border-slate-200 text-slate-800'
                                  : 'bg-slate-100/60 border-slate-200/50 text-slate-400'
                              }`}
                            >
                              <div className="flex items-center justify-center mb-1">
                                {isCompleted ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                                    {idx + 1}
                                  </div>
                                )}
                              </div>
                              <p className="text-xs font-bold leading-tight">{step.label}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 hidden sm:block line-clamp-1">
                                {step.description}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Código de Rastreio (se despachado) */}
                    {order.tracking_code && (
                      <div className="m-4 sm:m-5 p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                            <Truck className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 block">
                              Despachado • Código de Rastreio
                            </span>
                            <span className="text-xs sm:text-sm font-mono font-bold text-purple-950 tracking-wider">
                              {order.tracking_code}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopy(order.tracking_code!, `tr-${order.id}`)}
                            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-purple-200 text-purple-900 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                          >
                            {copiedCode === `tr-${order.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            Copiar
                          </button>

                          {order.tracking_url && (
                            <a
                              href={order.tracking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Acompanhar Rastreio
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Detalhes Expandidos */}
                    {isExpanded && (
                      <div className="p-4 sm:p-5 space-y-4 border-t border-slate-100 bg-[#fbfcfd]">
                        {/* Mensagens e Observações */}
                        {(order.customer_notes || order.commercial_notes) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {order.customer_notes && (
                              <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs">
                                <span className="font-bold text-slate-700 block mb-1">
                                  Observações do Pedido:
                                </span>
                                <p className="text-slate-500 leading-relaxed">{order.customer_notes}</p>
                              </div>
                            )}

                            {order.commercial_notes && (
                              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs">
                                <span className="font-bold text-blue-900 block mb-1">
                                  Posição Comercial Zeiq:
                                </span>
                                <p className="text-blue-800 leading-relaxed">{order.commercial_notes}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Itens e Grade */}
                        <div>
                          <h4 className="text-xs font-bold text-zeiq-black uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-slate-500" />
                            Peças e Grade Solicitada
                          </h4>

                          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                            {order.items?.map((item: QuoteItem, idx: number) => {
                              const hasGrade = item.sizeBreakdown && Object.keys(item.sizeBreakdown).length > 0;

                              return (
                                <div
                                  key={`${item.productId}-${idx}`}
                                  className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-11 h-11 rounded-lg bg-[#f8f9fa] border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-1">
                                      {item.coverImage ? (
                                        <img
                                          src={item.coverImage}
                                          alt={item.productName}
                                          className="w-full h-full object-contain mix-blend-multiply"
                                        />
                                      ) : (
                                        <Package className="w-4 h-4 text-slate-400" />
                                      )}
                                    </div>

                                    <div className="min-w-0">
                                      <h5 className="text-xs font-bold text-zeiq-black leading-snug line-clamp-1">
                                        {item.productName}
                                      </h5>
                                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                        {item.sku && (
                                          <span className="font-mono text-slate-500">
                                            SKU: {item.sku}
                                          </span>
                                        )}
                                        {item.selectedSize && (
                                          <span>Tam: <strong>{item.selectedSize}</strong></span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-col sm:items-end gap-1 shrink-0">
                                    {hasGrade ? (
                                      <div className="flex flex-wrap items-center gap-1">
                                        {Object.entries(item.sizeBreakdown!).map(([sz, qty]) => (
                                          <span
                                            key={sz}
                                            className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-700 font-bold"
                                          >
                                            {sz}: <strong className="text-zeiq-black">{qty}</strong>
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-slate-500">Quantidade simples</span>
                                    )}

                                    <div className="text-xs font-bold text-zeiq-black">
                                      Subtotal: {item.quantity} un.
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Ações Rápidas por Pedido */}
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100">
                          <button
                            onClick={() => setPrintOrder(order)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-xs font-semibold transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Visualizar Espelho de Impressão
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleReorder(order)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zeiq-black hover:bg-zeiq-charcoal text-white text-xs font-bold transition-all shadow-xs"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Repetir este Pedido
                            </button>

                            <a
                              href={getWhatsAppOrderLink(order)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              WhatsApp
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 6. Guias Informativos & Contato B2B */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <Phone className="w-4 h-4" />
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-zeiq-black">Suporte Comercial Direto</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Fale com seu consultor Zeiq sobre faturamento, acréscimo de peças na remessa ou condições para torneios e arenas.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <a
                href={`https://wa.me/${(storeSettings?.whatsappNumber || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '5516991667020').replace(/\D/g, '')}?text=${encodeURIComponent(
                  'Olá Zeiq Sports! Gostaria de falar com meu consultor sobre reposição de estoque.'
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Chamar no WhatsApp
              </a>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <Truck className="w-4 h-4" />
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-zeiq-black">Prazos de Separação & Envio</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Montagem e conferência minuciosa em 24 a 48h úteis. Despacho nacional via transportadoras parceiras (Jadlog, Azul Cargo e Correios).
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-center">
              <span className="text-[11px] font-semibold text-slate-400">
                ✓ Despacho direto de fábrica
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
                <RotateCcw className="w-4 h-4" />
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-zeiq-black">Reposição Rápida de Grade</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Clique em <strong>"Repetir este Pedido"</strong> em qualquer compra anterior para recarregar toda a grade de tamanhos na gaveta em 1 clique.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <Link
                href="/"
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Explorar Catálogo
              </Link>
            </div>
          </div>
        </div>

      </main>

      {/* Modal de Impressão do Comprovante do Pedido */}
      {printOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zeiq-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-zeiq-black rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative border border-slate-200">
            <button
              onClick={() => setPrintOrder(null)}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-zeiq-black"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
              <div
                className="relative h-7 w-28 flex items-center"
                style={{ position: 'relative', width: '112px', height: '28px', maxWidth: '100%' }}
              >
                <Image
                  src="/images/logo-zeiq.png"
                  alt="Zeiq Sports"
                  width={112}
                  height={28}
                  className="h-full w-auto object-contain object-left"
                  style={{ width: 'auto', height: '100%', maxHeight: '28px', objectFit: 'contain' }}
                />
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-zeiq-black block">
                  #{printOrder.order_number}
                </span>
                <span className="text-[10px] text-slate-500">
                  {formatDate(printOrder.created_at)}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-zeiq-black uppercase tracking-wider mb-1">
                  Dados do Lojista
                </h4>
                <p className="text-xs text-slate-700">
                  <strong>Responsável:</strong> {printOrder.buyer_name}
                </p>
                {printOrder.buyer_company && (
                  <p className="text-xs text-slate-700">
                    <strong>Loja / Arena:</strong> {printOrder.buyer_company}
                  </p>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-zeiq-black uppercase tracking-wider mb-2">
                  Grade de Produtos ({printOrder.total_pieces} peças)
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden text-xs divide-y divide-slate-100">
                  {printOrder.items?.map((it: QuoteItem, i: number) => (
                    <div key={i} className="p-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-zeiq-black block">{it.productName}</span>
                        {it.sku && <span className="text-[10px] text-slate-500 font-mono">SKU: {it.sku}</span>}
                        {it.sizeBreakdown && (
                          <span className="text-[10px] text-slate-600 block mt-0.5">
                            Grade: {Object.entries(it.sizeBreakdown).map(([s, q]) => `${q} ${s}`).join(', ')}
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-zeiq-black">{it.quantity} un.</span>
                    </div>
                  ))}
                </div>
              </div>

              {printOrder.tracking_code && (
                <div className="p-3 bg-purple-50 rounded-lg text-xs text-purple-950 font-mono">
                  <strong>Rastreio:</strong> {printOrder.tracking_code}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setPrintOrder(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-zeiq-black"
              >
                Fechar
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir Espelho
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Footer Oficial do Site */}
      <Footer settings={storeSettings || undefined} />
    </div>
  );
}
