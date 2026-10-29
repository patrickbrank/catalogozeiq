'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Order, OrderStatus, QuoteItem, Reseller } from '@/types';
import {
  ShoppingBag,
  Users,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  Package,
  X,
  Phone,
  Mail,
  MapPin,
  Building2,
  User,
  MessageCircle,
  LogOut,
  Loader2,
  Briefcase,
  Copy,
  Check,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  FileText,
  Filter,
  RefreshCw,
  Send,
  Eye,
  UserCheck,
  UserX,
} from 'lucide-react';
import { AvatarIcon, ADMIN_AVATARS, formatPhoneBR } from '@/lib/constants/avatars';
import { PanelFooter } from '@/components/PanelFooter';

const ORDER_STATUS_LABELS: Record<OrderStatus, { label: string; bg: string; text: string; border: string }> = {
  pending: { label: 'Pendente', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  approved: { label: 'Aprovado', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  processing: { label: 'Em Separação', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  shipped: { label: 'Despachado', bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
  delivered: { label: 'Entregue', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  cancelled: { label: 'Cancelado', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
};

export default function ResellerDashboardPage() {
  const router = useRouter();

  // Estados Globais do Painel
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [reseller, setReseller] = useState<Reseller | null>(null);
  const [stats, setStats] = useState<any>({
    totalCustomers: 0,
    pendingCustomers: 0,
    approvedCustomers: 0,
    totalOrders: 0,
    pendingOrders: 0,
  });

  const [activeTab, setActiveTab] = useState<'orders' | 'customers'>('orders');

  // Dados
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros - Pedidos
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [editingNotes, setEditingNotes] = useState('');

  // Filtros - Clientes
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerStatusFilter, setCustomerStatusFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [updatingCustomer, setUpdatingCustomer] = useState<string | null>(null);

  // Avatar Personalizado (3 Cores / Estilos SVG)
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('avatar-fire');
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  // Toast / Mensagens de Notificação
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Carrega os dados do revendedor
  const loadResellerData = async () => {
    try {
      const res = await fetch('/api/reseller/me');
      const data = await res.json();

      if (!data.success || !data.reseller) {
        window.location.href = '/revendedor/login';
        return;
      }

      setUser(data.user);
      setReseller(data.reseller);
      if (data.stats) setStats(data.stats);

      // Carrega pedidos e clientes em paralelo
      const [ordersRes, custRes] = await Promise.all([
        fetch('/api/reseller/orders'),
        fetch('/api/reseller/customers'),
      ]);

      const [ordersData, custData] = await Promise.all([
        ordersRes.json(),
        custRes.json(),
      ]);

      if (ordersData.success && Array.isArray(ordersData.orders)) {
        setOrders(ordersData.orders);
      }
      if (custData.success && Array.isArray(custData.customers)) {
        setCustomers(custData.customers);
      }
    } catch (err) {
      console.error('Falha ao carregar dados do painel do revendedor:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadResellerData();
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('zeiq_admin_avatar');
      if (saved) setSelectedAvatarId(saved);
    }
  }, []);

  const handleSelectAvatar = (avatarId: string) => {
    setSelectedAvatarId(avatarId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('zeiq_admin_avatar', avatarId);
    }
    setIsAvatarPickerOpen(false);
    showToast('Avatar personalizado com sucesso!');
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadResellerData();
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/revendedor/login';
  };

  // Atualizar Status do Pedido
  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    setSavingOrder(true);
    try {
      const res = await fetch('/api/reseller/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: orderId,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao atualizar status');
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
      showToast(`Status do pedido atualizado para "${ORDER_STATUS_LABELS[newStatus]?.label || newStatus}"`);
    } catch (err: any) {
      alert(err.message || 'Falha ao atualizar pedido');
    } finally {
      setSavingOrder(false);
    }
  };

  // Salvar Anotações Comerciais do Pedido
  const handleSaveOrderNotes = async (orderId: string) => {
    setSavingOrder(true);
    try {
      const res = await fetch('/api/reseller/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: orderId,
          commercial_notes: editingNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao salvar observações');
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, commercial_notes: editingNotes } : o))
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, commercial_notes: editingNotes });
      }
      showToast('Observação do pedido salva com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Falha ao salvar observação');
    } finally {
      setSavingOrder(false);
    }
  };

  // Alternar Aprovação do Lojista
  const handleToggleCustomerApproval = async (customerId: string, currentApproved: boolean) => {
    setUpdatingCustomer(customerId);
    const newStatus = !currentApproved;
    try {
      const res = await fetch('/api/reseller/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: customerId,
          is_approved: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao alterar aprovação');
      }

      setCustomers((prev) =>
        prev.map((c) => (c.id === customerId ? { ...c, is_approved: newStatus } : c))
      );
      showToast(newStatus ? 'Lojista aprovado com sucesso!' : 'Acesso do lojista suspenso.');
    } catch (err: any) {
      alert(err.message || 'Falha ao alterar aprovação do cliente');
    } finally {
      setUpdatingCustomer(null);
    }
  };

  // Pedidos Filtrados
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const term = orderSearch.toLowerCase().trim();
      const matchSearch =
        !term ||
        order.order_number?.toLowerCase().includes(term) ||
        order.buyer_name?.toLowerCase().includes(term) ||
        order.buyer_company?.toLowerCase().includes(term) ||
        order.buyer_email?.toLowerCase().includes(term) ||
        order.buyer_phone?.includes(term);

      const matchStatus = orderStatusFilter === 'all' || order.status === orderStatusFilter;

      return matchSearch && matchStatus;
    });
  }, [orders, orderSearch, orderStatusFilter]);

  // Clientes Filtrados
  const filteredCustomers = useMemo(() => {
    return customers.filter((cust) => {
      const term = customerSearch.toLowerCase().trim();
      const matchSearch =
        !term ||
        cust.store_name?.toLowerCase().includes(term) ||
        cust.contact_name?.toLowerCase().includes(term) ||
        cust.email?.toLowerCase().includes(term) ||
        cust.cnpj_cpf?.includes(term) ||
        cust.city?.toLowerCase().includes(term) ||
        cust.phone?.includes(term);

      const matchStatus =
        customerStatusFilter === 'all' ||
        (customerStatusFilter === 'approved' && cust.is_approved) ||
        (customerStatusFilter === 'pending' && !cust.is_approved);

      return matchSearch && matchStatus;
    });
  }, [customers, customerSearch, customerStatusFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zeiq-black text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-zeiq-orange animate-spin" />
        <span className="text-xs font-semibold text-slate-400">Carregando painel do revendedor...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zeiq-black text-white font-sans selection:bg-zeiq-orange selection:text-zeiq-black">
      {/* Toast Flutuante de Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-zeiq-dark/95 backdrop-blur-md border border-zeiq-orange/40 text-white px-4 py-3 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.85)] flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-zeiq-orange shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Barra Superior / Header */}
      <header className="sticky top-0 z-40 bg-zeiq-dark/95 backdrop-blur-md border-b border-zeiq-charcoal px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="max-w-[1720px] mx-auto flex items-center justify-between gap-4">
          {/* Logo & Título */}
          <div className="flex items-center gap-3">
            <Link href="/revendedor" className="flex items-center gap-2">
              <div className="relative h-7 w-24 brightness-0 invert flex items-center">
                <Image
                  src="/images/logo-zeiq.png"
                  alt="Zeiq Sports"
                  width={96}
                  height={28}
                  priority
                  className="h-full w-auto object-contain"
                />
              </div>
            </Link>

            <span className="hidden sm:inline-block w-px h-5 bg-white/10" />

            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-zeiq-orange bg-zeiq-orange/10 border border-zeiq-orange/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Briefcase className="w-3 h-3" />
                Painel do Revendedor
              </span>
            </div>
          </div>

          {/* Ações da Direita (Alinhadas em Linha Perfeita com Altura Padronizada de 40px) */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Seletor de Avatar SVG com Símbolos Esportivos Minimalistas */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAvatarPickerOpen(!isAvatarPickerOpen)}
                className="h-10 px-3 rounded-xl bg-zeiq-charcoal/80 hover:bg-white/10 border border-white/10 hover:border-zeiq-orange/40 transition-all cursor-pointer flex items-center gap-2.5 active:scale-95 group shadow-xs shrink-0"
                title="Clique para escolher seu símbolo esportivo Zeiq"
              >
                <div className="relative shrink-0 flex items-center justify-center">
                  <AvatarIcon avatarId={selectedAvatarId} className="w-6 h-6" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-zeiq-dark animate-pulse" />
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-extrabold text-white truncate max-w-[120px] hidden sm:inline">
                    {reseller?.name?.split(' ')[0] || user?.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] font-mono font-extrabold text-zeiq-orange bg-zeiq-orange/15 border border-zeiq-orange/30 px-1.5 py-0.5 rounded leading-none">
                    REV
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform ${isAvatarPickerOpen ? 'rotate-180 text-white' : ''}`} />
              </button>

              {/* Popover dos 3 Símbolos Esportivos */}
              {isAvatarPickerOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-zeiq-dark border border-zeiq-charcoal rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/5">
                    <div>
                      <h4 className="text-xs font-black text-white">Símbolo Esportivo</h4>
                      <p className="text-[10px] text-slate-400">Personalize seu badge oficial Zeiq</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAvatarPickerOpen(false)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 mt-3">
                    {ADMIN_AVATARS.map((av) => (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => handleSelectAvatar(av.id)}
                        className={`w-full p-2.5 rounded-xl border flex items-center gap-3 transition-all cursor-pointer text-left ${
                          selectedAvatarId === av.id
                            ? `${av.badgeBg} ${av.badgeBorder} ring-1 ring-zeiq-orange/50 shadow-md`
                            : 'bg-zeiq-charcoal/50 border-white/5 hover:border-white/20 hover:bg-zeiq-charcoal'
                        }`}
                      >
                        <AvatarIcon avatarId={av.id} className="w-9 h-9" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white flex items-center justify-between">
                            <span>{av.name}</span>
                            {selectedAvatarId === av.id && (
                              <Check className="w-3.5 h-3.5 text-zeiq-orange" />
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">{av.theme}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-10 px-3 sm:px-3.5 rounded-xl bg-zeiq-charcoal/80 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0"
              title="Atualizar dados da carteira"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-zeiq-orange' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>

            <Link
              href="/"
              target="_blank"
              className="h-10 px-3 sm:px-3.5 rounded-xl bg-zeiq-charcoal/80 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 active:scale-95"
              title="Ver Catálogo Público de Produtos"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Catálogo</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="h-10 px-3 sm:px-3.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95"
              title="Sair do painel"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Barra de Navegação por Abas */}
      <nav className="border-b border-white/5 bg-zeiq-black px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-[1720px] mx-auto flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-zeiq-orange text-zeiq-black shadow-lg shadow-zeiq-orange/20'
                : 'bg-zeiq-dark text-slate-300 hover:text-white hover:bg-zeiq-charcoal'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Pedidos da Minha Carteira</span>
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono ${
              activeTab === 'orders' ? 'bg-black/20 text-zeiq-black' : 'bg-white/10 text-slate-400'
            }`}>
              {orders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'customers'
                ? 'bg-zeiq-orange text-zeiq-black shadow-lg shadow-zeiq-orange/20'
                : 'bg-zeiq-dark text-slate-300 hover:text-white hover:bg-zeiq-charcoal'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Meus Lojistas Vinculados</span>
            {customers.filter((c) => !c.is_approved).length > 0 && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500 text-white animate-pulse">
                {customers.filter((c) => !c.is_approved).length} pendentes
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono ${
              activeTab === 'customers' ? 'bg-black/20 text-zeiq-black' : 'bg-white/10 text-slate-400'
            }`}>
              {customers.length}
            </span>
          </button>
        </div>
      </nav>

      {/* 3. Conteúdo Principal */}
      <main className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

        {/* Banner Motivacional e Métricas de Atendimento com Avatar Escolhido */}
        <div className="bg-gradient-to-r from-zeiq-dark via-zeiq-charcoal to-zeiq-dark border border-white/5 hover:border-zeiq-orange/30 rounded-3xl p-5 sm:p-6 shadow-xl transition-all">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="relative shrink-0">
                <AvatarIcon avatarId={selectedAvatarId} className="w-12 h-12 sm:w-14 sm:h-14" />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-zeiq-dark animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-white">
                    Fala, {reseller?.name?.split(' ')[0] || 'Parceiro'}! 🚀
                  </h2>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Online
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAvatarPickerOpen(true)}
                    className="text-[11px] font-bold text-zeiq-orange hover:underline cursor-pointer ml-1"
                  >
                    Trocar Avatar
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                  {orders.filter((o) => o.status === 'pending').length > 0
                    ? `Você tem ${orders.filter((o) => o.status === 'pending').length} ${orders.filter((o) => o.status === 'pending').length === 1 ? 'pedido pendente aguardando' : 'pedidos pendentes aguardando'} seu atendimento. Agilidade no WhatsApp converte mais!`
                    : 'Parabéns! Todos os pedidos da sua carteira estão em andamento ou concluídos.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
              <button
                type="button"
                onClick={() => { setActiveTab('orders'); setOrderStatusFilter('pending'); }}
                className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-zeiq-black font-extrabold text-xs rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Pendentes ({orders.filter((o) => o.status === 'pending').length})</span>
              </button>
              {customers.filter((c) => !c.is_approved).length > 0 && (
                <button
                  type="button"
                  onClick={() => { setActiveTab('customers'); setCustomerStatusFilter('pending'); }}
                  className="px-3.5 py-2.5 bg-zeiq-orange hover:bg-orange-600 text-zeiq-black font-extrabold text-xs rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Aprovar Lojistas ({customers.filter((c) => !c.is_approved).length})</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* ABA 1: PEDIDOS                                           */}
        {/* ======================================================== */}
        {activeTab === 'orders' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Métricas dos Pedidos da Carteira */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-zeiq-dark p-4 rounded-2xl border border-white/5 shadow-md">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Pedidos</div>
                <div className="text-2xl font-black text-white mt-1">{orders.length}</div>
                <div className="text-[10px] text-slate-500 mt-1">Exclusivos da sua carteira</div>
              </div>

              <div className="bg-zeiq-dark p-4 rounded-2xl border border-amber-500/20 shadow-md">
                <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Pendentes</div>
                <div className="text-2xl font-black text-amber-400 mt-1">
                  {orders.filter((o) => o.status === 'pending').length}
                </div>
                <div className="text-[10px] text-amber-500/80 mt-1">Aguardando atendimento</div>
              </div>

              <div className="bg-zeiq-dark p-4 rounded-2xl border border-blue-500/20 shadow-md">
                <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">Em Andamento</div>
                <div className="text-2xl font-black text-blue-400 mt-1">
                  {orders.filter((o) => ['approved', 'processing', 'shipped'].includes(o.status)).length}
                </div>
                <div className="text-[10px] text-blue-400/80 mt-1">Aprovados / Em separação</div>
              </div>

              <div className="bg-zeiq-dark p-4 rounded-2xl border border-emerald-500/20 shadow-md">
                <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Concluídos</div>
                <div className="text-2xl font-black text-emerald-400 mt-1">
                  {orders.filter((o) => o.status === 'delivered').length}
                </div>
                <div className="text-[10px] text-emerald-400/80 mt-1">Entregues com sucesso</div>
              </div>
            </div>

            {/* Barra de Filtros e Busca */}
            <div className="bg-zeiq-dark p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Buscar por nº do pedido, lojista, loja ou telefone..."
                  className="w-full pl-9 pr-3 py-2 bg-zeiq-charcoal border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-zeiq-orange"
                />
              </div>

              {/* Filtro por Status */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 md:pb-0">
                <button
                  type="button"
                  onClick={() => setOrderStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    orderStatusFilter === 'all'
                      ? 'bg-white text-zeiq-black shadow-xs'
                      : 'bg-zeiq-charcoal text-slate-400 hover:text-white'
                  }`}
                >
                  Todos ({orders.length})
                </button>
                {(['pending', 'approved', 'processing', 'shipped', 'delivered', 'cancelled'] as OrderStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      orderStatusFilter === st
                        ? 'bg-zeiq-orange text-zeiq-black shadow-xs'
                        : 'bg-zeiq-charcoal text-slate-400 hover:text-white'
                    }`}
                  >
                    {ORDER_STATUS_LABELS[st]?.label} ({orders.filter((o) => o.status === st).length})
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de Pedidos */}
            {filteredOrders.length === 0 ? (
              <div className="bg-zeiq-dark border border-white/5 rounded-2xl p-12 text-center">
                <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">Nenhum pedido localizado</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {orderSearch || orderStatusFilter !== 'all'
                    ? 'Nenhum pedido corresponde aos filtros aplicados.'
                    : 'Assim que seus lojistas realizarem pedidos no catálogo, eles aparecerão aqui automaticamente.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredOrders.map((order) => {
                  const statusConfig = ORDER_STATUS_LABELS[order.status as OrderStatus] || ORDER_STATUS_LABELS.pending;
                  const totalVal = (order.items || []).reduce((acc: number, it: any) => acc + ((it.price || 0) * (it.quantity || 1)), 0);
                  const clientPhone = order.buyer_phone || order.customer_profile?.phone;

                  return (
                    <div
                      key={order.id}
                      className="bg-zeiq-dark border border-white/5 hover:border-zeiq-orange/40 rounded-2xl p-5 transition-all shadow-md flex flex-col justify-between space-y-4"
                    >
                      <div>
                        {/* Cabeçalho do Card */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <span className="text-xs font-mono font-black text-zeiq-orange tracking-wide">
                              #{order.order_number}
                            </span>
                            <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <Clock className="w-3 h-3 text-slate-500" />
                              <span>{order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : 'Data recente'}</span>
                            </div>
                          </div>

                          <span className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                            {statusConfig.label}
                          </span>
                        </div>

                        {/* Dados do Cliente */}
                        <div className="bg-zeiq-charcoal/60 rounded-xl p-3 border border-white/5 space-y-1">
                          <div className="text-sm font-extrabold text-white flex items-center gap-1.5 truncate">
                            <Building2 className="w-3.5 h-3.5 text-zeiq-orange shrink-0" />
                            <span className="truncate">{order.buyer_company || order.customer_profile?.store_name || 'Lojista Parceiro'}</span>
                          </div>
                          <div className="text-xs text-slate-300 flex items-center gap-1.5">
                            <User className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate">{order.buyer_name}</span>
                          </div>
                          {clientPhone && (
                            <div className="text-xs text-slate-400 flex items-center gap-1.5">
                              <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>{clientPhone}</span>
                            </div>
                          )}
                        </div>

                        {/* Resumo de Itens & Status de Notificação */}
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                          <span>{order.total_pieces || (order.items || []).length} peças</span>
                          
                          <div className="flex items-center gap-2">
                            {order.notification_status === 'sent' && (
                              <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                                ✓ Notificado
                              </span>
                            )}
                            {order.notification_status === 'fallback_ready' && (
                              <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                                WhatsApp Pronto
                              </span>
                            )}
                            {order.notification_status === 'failed' && (
                              <span className="text-[10px] font-extrabold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
                                Reenviar WhatsApp
                              </span>
                            )}
                            {totalVal > 0 && (
                              <span className="font-extrabold text-zeiq-orange">
                                R$ {totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botões de Ação do Card */}
                      <div className="pt-3 border-t border-white/5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrder(order);
                            setEditingNotes(order.commercial_notes || '');
                          }}
                          className="flex-1 py-2 px-3 bg-white/10 hover:bg-white/20 active:scale-98 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Detalhes</span>
                        </button>

                        {order.client_whatsapp_url && (
                          <a
                            href={order.client_whatsapp_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer shadow-md"
                            title="Conversar com o Cliente no WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        )}

                        {order.reseller_whatsapp_url && (
                          <a
                            href={order.reseller_whatsapp_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-zeiq-orange hover:bg-orange-600 active:scale-98 text-zeiq-black rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer shadow-md"
                            title="Mensagem Formatada do Pedido no WhatsApp"
                          >
                            <Send className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA 2: CLIENTES (LOJISTAS VINCULADOS)                    */}
        {/* ======================================================== */}
        {activeTab === 'customers' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Métricas dos Clientes da Carteira */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-zeiq-dark p-4 rounded-2xl border border-white/5 shadow-md">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lojistas na Carteira</div>
                <div className="text-2xl font-black text-white mt-1">{customers.length}</div>
                <div className="text-[10px] text-slate-500 mt-1">Vinculados permanentemente a você</div>
              </div>

              <div className="bg-zeiq-dark p-4 rounded-2xl border border-amber-500/20 shadow-md">
                <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Pendentes de Aprovação</div>
                <div className="text-2xl font-black text-amber-400 mt-1">
                  {customers.filter((c) => !c.is_approved).length}
                </div>
                <div className="text-[10px] text-amber-500/80 mt-1">Aguardando sua liberação comercial</div>
              </div>

              <div className="bg-zeiq-dark p-4 rounded-2xl border border-emerald-500/20 shadow-md">
                <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Lojistas Aprovados</div>
                <div className="text-2xl font-black text-emerald-400 mt-1">
                  {customers.filter((c) => c.is_approved).length}
                </div>
                <div className="text-[10px] text-emerald-400/80 mt-1">Com acesso ativo ao catálogo</div>
              </div>
            </div>

            {/* Barra de Busca e Filtros */}
            <div className="bg-zeiq-dark p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Buscar por loja, responsável, CNPJ, cidade ou telefone..."
                  className="w-full pl-9 pr-3 py-2 bg-zeiq-charcoal border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-zeiq-orange"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCustomerStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    customerStatusFilter === 'all'
                      ? 'bg-white text-zeiq-black shadow-xs'
                      : 'bg-zeiq-charcoal text-slate-400 hover:text-white'
                  }`}
                >
                  Todos ({customers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerStatusFilter('pending')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    customerStatusFilter === 'pending'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-zeiq-charcoal text-slate-400 hover:text-white'
                  }`}
                >
                  Pendentes ({customers.filter((c) => !c.is_approved).length})
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerStatusFilter('approved')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    customerStatusFilter === 'approved'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-zeiq-charcoal text-slate-400 hover:text-white'
                  }`}
                >
                  Aprovados ({customers.filter((c) => c.is_approved).length})
                </button>
              </div>
            </div>

            {/* Lista e Tabela de Lojistas */}
            {filteredCustomers.length === 0 ? (
              <div className="bg-zeiq-dark border border-white/5 rounded-2xl p-12 text-center">
                <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">Nenhum lojista encontrado</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Quando novos lojistas se cadastrarem escolhendo seu nome no formulário, eles estarão listados aqui.
                </p>
              </div>
            ) : (
              <>
                {/* Visualização em Cards para Dispositivos Móveis */}
                <div className="block md:hidden space-y-3">
                  {filteredCustomers.map((cust) => (
                    <div
                      key={`mob-${cust.id}`}
                      className="bg-zeiq-dark border border-white/5 rounded-2xl p-4 space-y-3 shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-extrabold text-white text-sm truncate">
                            {cust.store_name || cust.contact_name}
                          </div>
                          <div className="text-xs text-slate-300 mt-0.5 truncate flex items-center gap-1.5">
                            <span>{cust.contact_name}</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-500 font-mono text-[11px] truncate">{cust.email}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {cust.cnpj_cpf || '—'}
                          </div>
                        </div>

                        {cust.is_approved ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            Aprovado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full shrink-0 animate-pulse">
                            <Clock className="w-3 h-3" />
                            Pendente
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-400 flex items-center justify-between border-t border-white/5 pt-2">
                        <span className="truncate">
                          {cust.city ? `${cust.city}/${cust.state || ''}` : '—'}
                        </span>
                        <span className="font-mono font-medium text-white shrink-0 ml-2">
                          {formatPhoneBR(cust.phone)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {cust.whatsapp_url ? (
                          <a
                            href={cust.whatsapp_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-11 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span>WhatsApp</span>
                          </a>
                        ) : (
                          <div className="h-11 bg-white/5 text-slate-500 rounded-xl text-xs flex items-center justify-center">
                            Sem WhatsApp
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={updatingCustomer === cust.id}
                          onClick={() => handleToggleCustomerApproval(cust.id, cust.is_approved)}
                          className={`h-11 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 ${
                            cust.is_approved
                              ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                              : 'bg-zeiq-orange hover:bg-orange-600 text-zeiq-black font-extrabold shadow-md'
                          }`}
                        >
                          {updatingCustomer === cust.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : cust.is_approved ? (
                            <>
                              <UserX className="w-3.5 h-3.5" />
                              <span>Suspender</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Aprovar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tabela de Lojistas para Desktop */}
                <div className="hidden md:block bg-zeiq-dark rounded-2xl border border-white/5 overflow-hidden shadow-lg">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-zeiq-charcoal/80 border-b border-white/5 text-slate-400 font-extrabold uppercase tracking-wider text-[11px]">
                          <th className="py-3.5 px-5">Lojista / Razão Social</th>
                          <th className="py-3.5 px-4">CNPJ / CPF</th>
                          <th className="py-3.5 px-4">Localização</th>
                          <th className="py-3.5 px-4">Contato WhatsApp</th>
                          <th className="py-3.5 px-4 text-center">Status</th>
                          <th className="py-3.5 px-4 text-center">Pedidos</th>
                          <th className="py-3.5 px-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredCustomers.map((cust) => (
                          <tr key={cust.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-4 px-5">
                              <div className="font-bold text-white text-sm">
                                {cust.store_name || cust.contact_name}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span>{cust.contact_name}</span>
                                <span className="text-slate-600">•</span>
                                <span className="text-slate-500 font-mono text-[11px]">{cust.email}</span>
                              </div>
                            </td>

                            <td className="py-4 px-4 font-mono text-slate-300">
                              {cust.cnpj_cpf || <span className="text-slate-600">—</span>}
                            </td>

                            <td className="py-4 px-4 text-slate-300">
                              {cust.city ? (
                                <div>
                                  <span className="font-medium text-slate-200">{cust.city}{cust.state ? `/${cust.state}` : ''}</span>
                                  {cust.address && <div className="text-[11px] text-slate-500 truncate max-w-xs">{cust.address}</div>}
                                </div>
                              ) : (
                                <span className="text-slate-600 font-medium">—</span>
                              )}
                            </td>

                            <td className="py-4 px-4">
                              <div className="font-mono font-medium text-white tracking-wide">
                                {formatPhoneBR(cust.phone)}
                              </div>
                              {cust.whatsapp_url && (
                                <a
                                  href={cust.whatsapp_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 mt-1"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  <span>Chamar WhatsApp</span>
                                </a>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              {cust.is_approved ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Aprovado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                                  <Clock className="w-3 h-3" />
                                  Pendente
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-center font-bold text-white">
                              {cust.orders_count || 0}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                disabled={updatingCustomer === cust.id}
                                onClick={() => handleToggleCustomerApproval(cust.id, cust.is_approved)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                  cust.is_approved
                                    ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md'
                                }`}
                              >
                                {updatingCustomer === cust.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : cust.is_approved ? (
                                  <>
                                    <UserX className="w-3 h-3" />
                                    <span>Suspender</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-3 h-3" />
                                    <span>Aprovar Cadastro</span>
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* MODAL DE DETALHES DO PEDIDO                             */}
      {/* ======================================================== */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-zeiq-dark border border-zeiq-charcoal rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
            {/* Cabeçalho Fixo do Modal (Sem scrollbar, botão X perfeitamente integrado e contido) */}
            <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-white/5 shrink-0 bg-zeiq-dark">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-black text-white">
                    Pedido #{selectedOrder.order_number}
                  </span>
                  <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${ORDER_STATUS_LABELS[selectedOrder.status as OrderStatus]?.bg} ${ORDER_STATUS_LABELS[selectedOrder.status as OrderStatus]?.text} ${ORDER_STATUS_LABELS[selectedOrder.status as OrderStatus]?.border}`}>
                    {ORDER_STATUS_LABELS[selectedOrder.status as OrderStatus]?.label}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('pt-BR') : ''}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Fechar detalhes do pedido"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo Rolável Isolado (Scrollbar 100% contida dentro do corpo, sem vazar cantos arredondados) */}
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar-dark flex-1">
            {/* Seletor de Status do Pedido (Permissão do Revendedor) */}
            <div className="bg-zeiq-charcoal/80 rounded-2xl p-4 border border-white/5 space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                Alterar Status do Pedido:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(['pending', 'approved', 'processing', 'shipped', 'delivered', 'cancelled'] as OrderStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={savingOrder}
                    onClick={() => handleUpdateOrderStatus(selectedOrder.id, st)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer text-center ${
                      selectedOrder.status === st
                        ? 'bg-zeiq-orange text-zeiq-black shadow-md'
                        : 'bg-zeiq-dark text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {ORDER_STATUS_LABELS[st]?.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Informações do Cliente */}
            <div className="bg-zeiq-charcoal/60 rounded-2xl p-4 border border-white/5 space-y-2 text-xs">
              <div className="text-[11px] font-extrabold uppercase text-zeiq-orange tracking-wider">
                Dados do Lojista Comprador
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Loja / Empresa</span>
                  <strong className="text-white text-sm">{selectedOrder.buyer_company || selectedOrder.customer_profile?.store_name || '-'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Responsável</span>
                  <strong className="text-white text-sm">{selectedOrder.buyer_name}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Telefone / WhatsApp</span>
                  <span className="text-white">{selectedOrder.buyer_phone || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">E-mail</span>
                  <span className="text-white">{selectedOrder.buyer_email || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">CNPJ / CPF</span>
                  <span className="text-white">{selectedOrder.customer_profile?.cnpj_cpf || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Endereço de Entrega</span>
                  <span className="text-white">
                    {[selectedOrder.customer_profile?.address, selectedOrder.customer_profile?.city, selectedOrder.customer_profile?.state].filter(Boolean).join(' - ') || 'A combinar'}
                  </span>
                </div>
              </div>

              {/* Botões de Ação Direta com o Cliente */}
              {selectedOrder.client_whatsapp_url && (
                <div className="pt-2">
                  <a
                    href={selectedOrder.client_whatsapp_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Iniciar Conversa no WhatsApp com {selectedOrder.buyer_name}</span>
                  </a>
                </div>
              )}
            </div>

            {/* Tabela de Itens do Pedido */}
            <div className="space-y-2">
              <div className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">
                Grade de Produtos Solicitados ({selectedOrder.total_pieces || (selectedOrder.items || []).length} un.)
              </div>
              <div className="bg-zeiq-charcoal/40 rounded-2xl border border-white/5 divide-y divide-white/5 overflow-hidden">
                {(selectedOrder.items || []).map((item: QuoteItem, idx: number) => {
                  const qty = item.quantity || 1;
                  const unitPrice = item.price != null && item.price > 0 ? item.price : null;
                  const subtotal = unitPrice ? unitPrice * qty : null;

                  return (
                    <div key={idx} className="p-3.5 flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <strong className="text-white text-sm block">{item.productName}</strong>
                        {item.sku && <span className="text-[11px] text-slate-400 font-mono">SKU: {item.sku}</span>}
                        {item.sizeBreakdown && Object.keys(item.sizeBreakdown).length > 0 ? (
                          <div className="text-xs text-zeiq-orange font-semibold">
                            Grade: {Object.entries(item.sizeBreakdown).map(([sz, q]) => `${q}x ${sz}`).join(', ')}
                          </div>
                        ) : item.selectedSize ? (
                          <div className="text-xs text-zeiq-orange font-semibold">Tamanho: {item.selectedSize}</div>
                        ) : null}
                      </div>

                      <div className="text-right">
                        <div className="font-extrabold text-white text-sm">{qty} un.</div>
                        {subtotal != null && (
                          <div className="text-zeiq-orange font-bold text-xs mt-0.5">
                            R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Observações do Pedido / Chat Interno */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold uppercase text-slate-400 tracking-wider">
                Observações Comerciais do Pedido
              </label>
              <textarea
                rows={3}
                value={editingNotes}
                onChange={(e) => setEditingNotes(e.target.value)}
                placeholder="Insira anotações comerciais sobre prazo, frete combinado ou condições negociadas com este lojista..."
                className="w-full p-3 bg-zeiq-charcoal border border-white/10 rounded-xl text-white placeholder:text-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-zeiq-orange"
              />
              <button
                type="button"
                disabled={savingOrder}
                onClick={() => handleSaveOrderNotes(selectedOrder.id)}
                className="py-2 px-4 bg-zeiq-orange hover:bg-orange-600 text-zeiq-black font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {savingOrder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Salvar Observação</span>
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé Oficial Zeiq com Card do Instagram */}
      <PanelFooter />
    </div>
  );
}
