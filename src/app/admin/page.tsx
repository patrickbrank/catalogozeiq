'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Package,
  CheckCircle,
  Eye,
  EyeOff,
  FolderTree,
  Plus,
  Search,
  Edit3,
  Trash2,
  LogOut,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Lock,
  Star,
  Image as ImageIcon,
  Users,
  ShoppingBag,
  Truck,
  Clock,
  AlertCircle,
  Phone,
  Mail,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Layers,
  Check,
  Copy,
  MessageCircle,
  ShieldCheck,
  Building2,
  Calendar,
  Filter,
  Settings,
  Upload,
  ArrowUp,
  ArrowDown,
  UserCheck,
  UserX,
  Key,
  ShieldAlert,
  Boxes,
  Minus,
  AlertTriangle,
  Briefcase,
  Send,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Product, Category, Order, OrderStatus, QuoteItem, BannerItem, StoreSettings } from '@/types';
import { parseProductSizes } from '@/lib/utils/sizes';
import { Department, DEFAULT_DEPARTMENTS, findDepartmentForCategory } from '@/lib/data/departments';
import { DEFAULT_BANNERS, DEFAULT_STORE_SETTINGS } from '@/lib/constants/store';
import { ProductFormModal } from '@/components/admin/ProductFormModal';
import { OrderStatusPopover, ORDER_STATUS_CONFIG } from '@/components/admin/OrderStatusPopover';
import { BannerDestinationPicker } from '@/components/admin/BannerDestinationPicker';
import { AvatarIcon, ADMIN_AVATARS } from '@/lib/constants/avatars';

const ITEMS_PER_PAGE = 25;

function isMasterEmail(email?: string | null): boolean {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  return clean === 'marketing@zeiq.com.br' || clean === 'patrickbrank@outlook.com';
}

export default function AdminDashboardPage() {
  const router = useRouter();

  // Estados Globais do Painel
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'banners' | 'settings' | 'users' | 'categories' | 'resellers'>('products');

  // Estados para Gestão de Revendedores (Admin Master)
  const [adminResellers, setAdminResellers] = useState<any[]>([]);
  const [resellerModalOpen, setResellerModalOpen] = useState(false);
  const [editingReseller, setEditingReseller] = useState<any | null>(null);
  const [resellerFormName, setResellerFormName] = useState('');
  const [resellerFormEmail, setResellerFormEmail] = useState('');
  const [resellerFormWhatsapp, setResellerFormWhatsapp] = useState('');
  const [resellerFormPhone, setResellerFormPhone] = useState('');
  const [resellerFormStatus, setResellerFormStatus] = useState<'ativo' | 'inativo'>('ativo');
  const [resellerFormPref, setResellerFormPref] = useState<'whatsapp_only' | 'email_only' | 'both'>('both');
  const [resellerFormPassword, setResellerFormPassword] = useState('');
  const [savingReseller, setSavingReseller] = useState(false);
  const [resellerSearch, setResellerSearch] = useState('');

  // Estados para Avatar do Administrador (3 Estilos SVG)
  const [adminAvatarId, setAdminAvatarId] = useState<string>('avatar-fire');
  const [adminAvatarPickerOpen, setAdminAvatarPickerOpen] = useState(false);

  // Estados para Acesso Direto ao Painel Administrativo
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authShowPassword, setAuthShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const handleDirectAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      });

      if (error) throw error;

      // Valida imediatamente se possui privilégios de equipe/administrador
      const verifyRes = await fetch('/api/admin/verify');
      const verifyData = await verifyRes.json();

      if (!verifyData.success || !verifyData.isAdmin) {
        await supabase.auth.signOut();
        throw new Error('Acesso restrito: esta conta é de lojista e possui acesso exclusivo ao catálogo e cotações.');
      }

      setUser(verifyData.user);
      fetchDashboardData();
    } catch (err: any) {
      setAuthError(err.message || 'Falha ao autenticar. Verifique suas credenciais.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Dados
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>(DEFAULT_DEPARTMENTS);
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [banners, setBanners] = useState<BannerItem[]>(DEFAULT_BANNERS);
  const [savingBanners, setSavingBanners] = useState(false);
  const [uploadingBannerIndex, setUploadingBannerIndex] = useState<{ index: number; type: 'desktop' | 'mobile' } | null>(null);

  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);

  // Filtros - Produtos
  const [productSearch, setProductSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft' | 'low_stock' | 'out_of_stock'>('all');
  const [visibleProductsCount, setVisibleProductsCount] = useState(ITEMS_PER_PAGE);

  const handleLoadMoreProducts = () => {
    setVisibleProductsCount((prev) => prev + ITEMS_PER_PAGE);
  };

  // Modal de Ajuste Rápido de Estoque
  const [quickStockProduct, setQuickStockProduct] = useState<Product | null>(null);
  const [quickStockBySize, setQuickStockBySize] = useState<Record<string, number>>({});
  const [quickDefaultStock, setQuickDefaultStock] = useState<number>(0);
  const [savingQuickStock, setSavingQuickStock] = useState(false);

  // Dropdown Customizado de Categorias
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const [catFilterSearch, setCatFilterSearch] = useState('');
  const catDropdownRef = useRef<HTMLDivElement>(null);

  // Popover de Status do Pedido
  const [openStatusOrderId, setOpenStatusOrderId] = useState<string | null>(null);

  // Filtros - Pedidos
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderResellerFilter, setOrderResellerFilter] = useState<string>('all');

  // Filtros - Clientes
  const [clientSearch, setClientSearch] = useState('');

  // Modais
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [trackingModalOrder, setTrackingModalOrder] = useState<Order | null>(null);
  const [newTrackingCode, setNewTrackingCode] = useState('');
  const [newTrackingUrl, setNewTrackingUrl] = useState('');
  const [savingTracking, setSavingTracking] = useState(false);

  // Modal de Categoria
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [categoryOrder, setCategoryOrder] = useState<number>(0);
  const [categoryDepartmentId, setCategoryDepartmentId] = useState<string>('equipamentos');
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState('');

  // Modal de Linha Esportiva / Departamento
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptShortName, setNewDeptShortName] = useState('');
  const [savingDept, setSavingDept] = useState(false);
  const [deptError, setDeptError] = useState('');

  // Filtro de Linha Esportiva na Tabela de Categorias
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');

  // Modal de Cadastro e Edição de Lojista / Membro Administrativo
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientModalMode, setClientModalMode] = useState<'create' | 'edit'>('create');
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [clientRole, setClientRole] = useState<'admin' | 'representative' | 'stock' | 'reseller'>('reseller');
  const [clientRepresentativeId, setClientRepresentativeId] = useState<string>('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientStore, setNewClientStore] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientCnpj, setNewClientCnpj] = useState('');
  const [newClientCity, setNewClientCity] = useState('');
  const [newClientState, setNewClientState] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPassword, setNewClientPassword] = useState('');
  const [clientApproved, setClientApproved] = useState(true);
  const [clientIsMaster, setClientIsMaster] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [clientError, setClientError] = useState('');

  // Filtro de Papel de Usuários (Todos / Lojistas / Representantes / Estoque / Administradores)
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'reseller' | 'representative' | 'stock' | 'admin'>('all');
  const [userApprovalFilter, setUserApprovalFilter] = useState<'all' | 'pending' | 'active'>('all');

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Identificação de cargo e permissões do usuário logado
  const currentUserRole = user?.role || 'admin';
  const isCurrentUserMaster = user?.is_master || isMasterEmail(user?.email);
  const isCurrentUserRepresentative = currentUserRole === 'representative';
  const isCurrentUserStock = currentUserRole === 'stock';
  const isCurrentUserAdminOrMaster = isCurrentUserMaster || currentUserRole === 'admin';

  // Carrega todos os dados do painel
  const fetchDashboardData = async () => {
    try {
      const supabase = createClient();

      // Checa autenticação e privilégios administrativos no backend
      const verifyRes = await fetch('/api/admin/verify');
      const verifyData = await verifyRes.json();

      if (!verifyData.success || !verifyData.isAdmin) {
        setUser(null);
        router.push('/admin/login?error=unauthorized');
        return;
      }
      const loggedUser = verifyData.user;
      setUser(loggedUser);

      // Define aba inicial padrão de acordo com o cargo
      if (loggedUser?.role === 'representative') {
        setActiveTab((prev) => (prev === 'orders' || prev === 'users' ? prev : 'orders'));
      } else if (loggedUser?.role === 'stock') {
        setActiveTab((prev) => (prev === 'products' || prev === 'banners' || prev === 'categories' ? prev : 'products'));
      }

      // 0. Busca Departamentos / Linhas Esportivas
      try {
        const deptRes = await fetch('/api/admin/departments');
        const deptData = await deptRes.json();
        if (deptData.success && Array.isArray(deptData.departments)) {
          setDepartments(deptData.departments);
        }
      } catch (err) {
        console.warn('Erro ao carregar departamentos admin:', err);
      }

      // 1. Busca Categorias
      try {
        const catRes = await fetch('/api/admin/categories');
        const catData = await catRes.json();
        if (catData.success && Array.isArray(catData.categories)) {
          setCategories(catData.categories);
        } else {
          const { data: cats } = await supabase.from('categories').select('*').order('display_order');
          setCategories(cats || []);
        }
      } catch {
        const { data: cats } = await supabase.from('categories').select('*').order('display_order');
        setCategories(cats || []);
      }

      // 2. Busca Produtos
      try {
        const prodRes = await fetch('/api/admin/products');
        const prodData = await prodRes.json();
        if (prodData.success && Array.isArray(prodData.products) && prodData.products.length > 0) {
          setProducts(prodData.products);
        } else {
          // Fallback para query direta no Supabase
          const { data: prods } = await supabase
            .from('products')
            .select(`
              *,
              images:product_images(*),
              categories:product_categories(
                category:categories(*)
              )
            `)
            .order('created_at', { ascending: false });

          if (prods) {
            const formatted = prods.map((p: any) => ({
              ...p,
              categories: p.categories?.map((c: any) => c.category).filter(Boolean) || [],
            }));
            setProducts(formatted);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar produtos via API, tentando Supabase direto:', err);
        const { data: prods } = await supabase
          .from('products')
          .select(`
            *,
            images:product_images(*),
            categories:product_categories(
              category:categories(*)
            )
          `)
          .order('created_at', { ascending: false });

        if (prods) {
          const formatted = prods.map((p: any) => ({
            ...p,
            categories: p.categories?.map((c: any) => c.category).filter(Boolean) || [],
          }));
          setProducts(formatted);
        }
      }

      // 3. Busca Pedidos via API Admin
      try {
        const orderRes = await fetch('/api/admin/orders');
        const orderData = await orderRes.json();
        if (orderData.success && Array.isArray(orderData.orders)) {
          setOrders(orderData.orders);
        }
      } catch (err) {
        console.warn('Erro ao carregar pedidos admin:', err);
      }

      // 4. Busca Usuários/Clientes cadastrados via API Admin
      try {
        const userRes = await fetch('/api/admin/users');
        const userData = await userRes.json();
        if (userData.success && Array.isArray(userData.users)) {
          setClients(userData.users);
        }
      } catch (err) {
        console.warn('Erro ao carregar clientes admin:', err);
      }

      // 5. Busca Banners da Página Inicial
      try {
        const bannersRes = await fetch('/api/admin/banners');
        const bannersData = await bannersRes.json();
        if (bannersData.success && Array.isArray(bannersData.banners)) {
          setBanners(bannersData.banners);
        }
      } catch (err) {
        console.warn('Erro ao carregar banners admin:', err);
      }

      // 6. Busca Configurações Comerciais
      try {
        const settingsRes = await fetch('/api/admin/settings');
        const settingsData = await settingsRes.json();
        if (settingsData.success && settingsData.settings) {
          setSettings(settingsData.settings);
        }
      } catch (err) {
        console.warn('Erro ao carregar configurações admin:', err);
      }

      // 7. Busca Revendedores Comerciais via API Admin
      try {
        const resRes = await fetch('/api/admin/resellers');
        const resData = await resRes.json();
        if (resData.success && Array.isArray(resData.resellers)) {
          setAdminResellers(resData.resellers);
        }
      } catch (err) {
        console.warn('Erro ao carregar revendedores admin:', err);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('zeiq_admin_avatar');
      if (saved) setAdminAvatarId(saved);
    }

    const handleOutsideClick = (e: MouseEvent) => {
      if (catDropdownRef.current && !catDropdownRef.current.contains(e.target as Node)) {
        setIsCatDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelectAdminAvatar = (avatarId: string) => {
    setAdminAvatarId(avatarId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('zeiq_admin_avatar', avatarId);
    }
    setAdminAvatarPickerOpen(false);
    showToast('Avatar personalizado com sucesso!');
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  // ==========================================
  // OPERAÇÕES DE BANNERS (ATÉ 5)
  // ==========================================
  const handleAddBanner = () => {
    if (banners.length >= 5) {
      showToast('O limite máximo é de 5 banners.');
      return;
    }
    const newBanner: BannerItem = {
      id: `banner-${Date.now()}`,
      title: `Banner ${banners.length + 1}`,
      desktopImage: '/images/banners/banner-leo-branco-desktop.webp',
      mobileImage: '/images/banners/banner-leo-branco-mobile.webp',
      link: '',
      isActive: true,
      order: banners.length + 1,
    };
    setBanners([...banners, newBanner]);
  };

  const handleUpdateBanner = (index: number, field: keyof BannerItem, value: any) => {
    setBanners((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveBanner = (index: number) => {
    if (banners.length <= 1) {
      showToast('Mantenha pelo menos 1 banner cadastrado.');
      return;
    }
    setBanners((prev) => prev.filter((_, i) => i !== index).map((b, idx) => ({ ...b, order: idx + 1 })));
  };

  const handleMoveBanner = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= banners.length) return;
    setBanners((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy.map((b, idx) => ({ ...b, order: idx + 1 }));
    });
  };

  const handleSaveBanners = async () => {
    setSavingBanners(true);
    try {
      const res = await fetch('/api/admin/banners', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banners }),
      });
      const data = await res.json();
      if (data.success) {
        setBanners(data.banners);
        showToast('Banners atualizados com sucesso no catálogo!');
      } else {
        showToast(`Erro ao salvar: ${data.error}`);
      }
    } catch {
      showToast('Erro de conexão ao salvar banners.');
    } finally {
      setSavingBanners(false);
    }
  };

  const handleUploadBannerFile = async (index: number, type: 'desktop' | 'mobile', file: File) => {
    setUploadingBannerIndex({ index, type });
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const res = await fetch('/api/admin/upload-banner', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success && data.publicUrl) {
        handleUpdateBanner(index, type === 'desktop' ? 'desktopImage' : 'mobileImage', data.publicUrl);
        showToast(`Imagem ${type === 'desktop' ? 'Desktop' : 'Mobile'} enviada com sucesso!`);
      } else {
        showToast(`Erro no upload: ${data.error || 'Falha ao processar arquivo'}`);
      }
    } catch (err: any) {
      showToast(`Erro ao enviar arquivo: ${err.message}`);
    } finally {
      setUploadingBannerIndex(null);
    }
  };

  // ==========================================
  // OPERAÇÕES DE CONFIGURAÇÃO (WHATSAPP & EMAIL)
  // ==========================================
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        showToast('Configurações de WhatsApp e E-mail salvas com sucesso!');
      } else {
        showToast(`Erro ao salvar: ${data.error}`);
      }
    } catch {
      showToast('Erro ao conectar ao servidor para salvar configurações.');
    } finally {
      setSavingSettings(false);
    }
  };

  // ==========================================
  // OPERAÇÕES DE PRODUTOS
  // ==========================================
  const handleTogglePublished = async (product: Product) => {
    const newStatus = !product.is_published;
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, is_published: newStatus } : p))
    );

    try {
      const supabase = createClient();
      const { error } = await supabase.from('products').update({ is_published: newStatus }).eq('id', product.id);
      if (error) throw error;
      showToast(
        newStatus
          ? `"${product.name.slice(0, 24)}..." reativado (Em Estoque) e visível no catálogo.`
          : `"${product.name.slice(0, 24)}..." pausado (Sem Estoque) e ocultado do catálogo.`
      );
    } catch (e: any) {
      console.error('Erro ao atualizar status do produto:', e);
      alert(`Falha ao atualizar produto no banco: ${e.message || 'Erro desconhecido'}`);
      fetchDashboardData();
    }
  };

  const handleToggleFeatured = async (product: Product) => {
    const newFeatured = !product.is_featured;
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, is_featured: newFeatured } : p))
    );

    try {
      const supabase = createClient();
      const { error } = await supabase.from('products').update({ is_featured: newFeatured }).eq('id', product.id);
      if (error) throw error;
      showToast(`Destaque ${newFeatured ? 'ativado' : 'removido'}.`);
    } catch (e: any) {
      console.error('Erro ao atualizar destaque do produto:', e);
      alert(`Falha ao alterar destaque no banco: ${e.message || 'Erro desconhecido'}`);
      fetchDashboardData();
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    const confirmDelete = window.confirm(`Deseja realmente excluir o produto "${product.name}"?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/admin/products?id=${product.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao excluir produto.');
      }
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      showToast('Produto excluído com sucesso.');
    } catch (err: any) {
      alert(`Falha ao excluir produto: ${err.message}`);
      fetchDashboardData();
    }
  };

  const handleOpenQuickStock = (product: Product) => {
    setQuickStockProduct(product);
    const parsed = parseProductSizes(product.description, product.sizes, product.name);
    const activeSizes = product.sizes && product.sizes.length > 0 ? product.sizes : parsed.sizes;
    const initialStock: Record<string, number> = product.stock_by_size || {};
    const populated: Record<string, number> = {};
    activeSizes.forEach((sz) => {
      populated[sz] = typeof initialStock[sz] === 'number' ? initialStock[sz] : 0;
    });
    setQuickStockBySize(populated);
    setQuickDefaultStock(
      typeof initialStock['_padrao'] === 'number'
        ? initialStock['_padrao']
        : typeof product.total_stock === 'number' && activeSizes.length === 0
        ? product.total_stock
        : 0
    );
  };

  const handleSaveQuickStock = async () => {
    if (!quickStockProduct) return;
    setSavingQuickStock(true);

    try {
      const parsed = parseProductSizes(quickStockProduct.description, quickStockProduct.sizes, quickStockProduct.name);
      const activeSizes = quickStockProduct.sizes && quickStockProduct.sizes.length > 0 ? quickStockProduct.sizes : parsed.sizes;

      let finalStock: Record<string, number> = {};
      let finalTotal = 0;

      if (activeSizes.length > 0) {
        activeSizes.forEach((sz) => {
          finalStock[sz] = Math.max(0, quickStockBySize[sz] || 0);
        });
        finalTotal = Object.values(finalStock).reduce((a, b) => a + b, 0);
      } else {
        const dStock = Math.max(0, quickDefaultStock || 0);
        finalStock = { _padrao: dStock };
        finalTotal = dStock;
      }

      // Otimisticamente atualiza estado local
      setProducts((prev) =>
        prev.map((p) =>
          p.id === quickStockProduct.id
            ? { ...p, stock_by_size: finalStock, total_stock: finalTotal }
            : p
        )
      );

      const supabase = createClient();
      let { error } = await supabase
        .from('products')
        .update({
          stock_by_size: finalStock,
          total_stock: finalTotal,
        })
        .eq('id', quickStockProduct.id);

      if (error && error.message?.includes('stock')) {
        showToast('Aviso: Execute o script migration-add-stock.sql no Supabase.');
      } else if (error) {
        throw error;
      } else {
        showToast(`Estoque de "${quickStockProduct.name.slice(0, 20)}..." atualizado para ${finalTotal} un.`);
      }

      setQuickStockProduct(null);
    } catch (err: any) {
      showToast(`Erro ao salvar estoque: ${err.message}`);
    } finally {
      setSavingQuickStock(false);
    }
  };

  // ==========================================
  // OPERAÇÕES DE PEDIDOS
  // ==========================================
  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );

    const statusLabel =
      ORDER_STATUS_CONFIG.find((s) => s.key === newStatus)?.label || newStatus;

    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Status do pedido atualizado para "${statusLabel}".`);
      } else {
        showToast(`Status atualizado localmente para "${statusLabel}".`);
      }
    } catch {
      showToast(`Status atualizado para "${statusLabel}".`);
    }
  };

  const handleSaveTracking = async () => {
    if (!trackingModalOrder) return;
    setSavingTracking(true);

    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: trackingModalOrder.id,
          tracking_code: newTrackingCode,
          tracking_url: newTrackingUrl,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === trackingModalOrder.id
              ? { ...o, tracking_code: newTrackingCode, tracking_url: newTrackingUrl }
              : o
          )
        );
        showToast('Código de rastreio atualizado!');
        setTrackingModalOrder(null);
      } else {
        alert(data.error || 'Erro ao salvar rastreamento.');
      }
    } catch (err) {
      alert('Erro de comunicação.');
    } finally {
      setSavingTracking(false);
    }
  };

  // ==========================================
  // OPERAÇÕES DE CATEGORIAS E DEPARTAMENTOS
  // ==========================================
  const handleOpenCategoryModal = (cat: Category | null = null) => {
    setEditingCategory(cat);
    if (cat) {
      setCategoryName(cat.name);
      setCategorySlug(cat.slug);
      setCategoryOrder(cat.display_order ?? 0);
      const currentDept = findDepartmentForCategory(cat.name, departments);
      setCategoryDepartmentId(currentDept ? currentDept.id : 'acessorios');
    } else {
      setCategoryName('');
      setCategorySlug('');
      setCategoryOrder((categories.length || 0) + 1);
      setCategoryDepartmentId('acessorios');
    }
    setCategoryError('');
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      setCategoryError('Nome da categoria é obrigatório.');
      return;
    }

    setSavingCategory(true);
    setCategoryError('');

    try {
      const isEditing = !!editingCategory;
      const method = isEditing ? 'PUT' : 'POST';
      const body = {
        id: editingCategory?.id,
        name: categoryName,
        slug: categorySlug,
        display_order: categoryOrder,
      };

      const res = await fetch('/api/admin/categories', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        setCategoryError(data.error || 'Erro ao salvar categoria.');
      } else {
        // Vincula a categoria ao departamento selecionado
        try {
          await fetch('/api/admin/departments', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: categoryDepartmentId,
              moveCategory: {
                categoryName: categoryName.trim(),
                targetDepartmentId: categoryDepartmentId,
              },
            }),
          });
        } catch {}

        showToast(`Categoria "${categoryName}" salva com sucesso!`);
        setIsCategoryModalOpen(false);
        fetchDashboardData();
      }
    } catch (err: any) {
      setCategoryError('Erro ao salvar categoria no servidor.');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleMoveCategoryToDepartment = async (categoryName: string, targetDepartmentId: string) => {
    try {
      const res = await fetch('/api/admin/departments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetDepartmentId,
          moveCategory: {
            categoryName,
            targetDepartmentId,
          },
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.departments)) {
        setDepartments(data.departments);
        const targetDept = data.departments.find((d: any) => d.id === targetDepartmentId);
        showToast(`"${categoryName}" movido para "${targetDept?.name || targetDepartmentId}"!`);
      }
    } catch {
      showToast('Erro ao atualizar departamento da categoria.');
    }
  };

  const handleOpenDeptModal = (dept: Department | null = null) => {
    setEditingDept(dept);
    if (dept) {
      setNewDeptName(dept.name);
      setNewDeptShortName(dept.shortName);
    } else {
      setNewDeptName('');
      setNewDeptShortName('');
    }
    setDeptError('');
    setIsDeptModalOpen(true);
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) {
      setDeptError('Nome da linha esportiva é obrigatório.');
      return;
    }
    setSavingDept(true);
    setDeptError('');

    try {
      const isEditing = !!editingDept;
      const method = isEditing ? 'PUT' : 'POST';
      const body = isEditing
        ? {
            id: editingDept.id,
            name: newDeptName.trim(),
            shortName: newDeptShortName.trim() || newDeptName.trim(),
          }
        : {
            name: newDeptName.trim(),
            shortName: newDeptShortName.trim() || newDeptName.trim(),
            categoryNames: [],
          };

      const res = await fetch('/api/admin/departments', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        setDeptError(data.error || 'Erro ao salvar linha esportiva.');
      } else {
        showToast(`Linha "${newDeptName}" ${isEditing ? 'atualizada' : 'criada'} com sucesso!`);
        setIsDeptModalOpen(false);
        setEditingDept(null);
        setNewDeptName('');
        setNewDeptShortName('');
        if (Array.isArray(data.departments)) {
          setDepartments(data.departments);
        } else {
          fetchDashboardData();
        }
      }
    } catch {
      setDeptError('Erro de comunicação.');
    } finally {
      setSavingDept(false);
    }
  };

  const handleDeleteDepartment = async (dept: Department) => {
    if (departments.length <= 1) {
      alert('Mantenha pelo menos 1 linha esportiva cadastrada no catálogo.');
      return;
    }

    const confirmDelete = window.confirm(
      `Deseja realmente excluir a linha esportiva "${dept.name}"?\n\nAs categorias vinculadas não serão apagadas, mas ficarão sem linha definida até você reatribuí-las.`
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/admin/departments?id=${dept.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success && Array.isArray(data.departments)) {
        setDepartments(data.departments);
        if (selectedDeptFilter === dept.id) {
          setSelectedDeptFilter('all');
        }
        showToast(`Linha "${dept.name}" excluída.`);
      } else {
        alert(data.error || 'Erro ao excluir linha esportiva.');
      }
    } catch {
      showToast('Erro ao excluir linha esportiva.');
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    const confirmDelete = window.confirm(
      `Deseja realmente excluir a categoria "${cat.name}"? Os produtos vinculados perderão essa categoria.`
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/admin/categories?id=${cat.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showToast('Categoria excluída com sucesso.');
        fetchDashboardData();
      } else {
        alert(data.error || 'Erro ao excluir categoria.');
      }
    } catch (err: any) {
      alert(`Falha ao excluir categoria: ${err.message}`);
    }
  };

  // ==========================================
  // OPERAÇÕES DE CLIENTES E MEMBROS ADMINISTRATIVOS
  // ==========================================
  const handleOpenCreateUserModal = (role: 'reseller' | 'representative' | 'stock' | 'admin' = 'reseller') => {
    setClientModalMode('create');
    setEditingClientId(null);
    setClientRole(role);
    setNewClientName('');
    const defaultStore = role === 'admin'
      ? 'Administração Zeiq'
      : role === 'representative'
      ? 'Representação Comercial'
      : role === 'stock'
      ? 'Estoque Zeiq'
      : '';
    setNewClientStore(defaultStore);
    setNewClientPhone('');
    setNewClientCnpj('');
    setNewClientCity('');
    setNewClientState('');
    setNewClientEmail('');
    setNewClientPassword('');
    setClientRepresentativeId(isCurrentUserRepresentative ? user?.id || '' : '');
    setClientApproved(true);
    setClientIsMaster(false);
    setClientError('');
    setIsClientModalOpen(true);
  };

  const handleOpenClientModal = () => handleOpenCreateUserModal('reseller');

  const handleOpenEditUserModal = (client: any) => {
    setClientModalMode('edit');
    setEditingClientId(client.id);
    const isMaster = client.is_master || isMasterEmail(client.email);
    const roleCandidate = client.role;
    const cleanRole = isMaster
      ? 'admin'
      : (['admin', 'representative', 'stock', 'reseller'].includes(roleCandidate) ? roleCandidate : 'reseller');
    setClientRole(cleanRole);
    setNewClientName(client.contact_name || '');
    setNewClientStore(client.store_name || '');
    setNewClientPhone(client.phone || '');
    setNewClientCnpj(client.cnpj_cpf || '');
    setNewClientCity(client.city || '');
    setNewClientState(client.state || '');
    setNewClientEmail(client.email || '');
    setNewClientPassword(''); // em branco = mantém a senha atual
    setClientRepresentativeId(client.representative_id || '');
    setClientApproved(client.is_approved ?? true);
    setClientIsMaster(isMaster);
    setClientError('');
    setIsClientModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (clientModalMode === 'create') {
      if (!newClientEmail.trim() || !newClientPassword) {
        setClientError('E-mail e senha inicial são obrigatórios para novo cadastro.');
        return;
      }
      if (newClientPassword.length < 6) {
        setClientError('A senha inicial deve ter no mínimo 6 dígitos.');
        return;
      }
    } else {
      // Modo de edição
      if (newClientPassword && newClientPassword.length < 6) {
        setClientError('Se desejar alterar a senha, digite no mínimo 6 dígitos.');
        return;
      }
    }

    setSavingClient(true);
    setClientError('');

    try {
      const roleLabels: Record<string, string> = {
        admin: 'Administrador',
        representative: 'Representante Comercial',
        stock: 'Controle de Estoque',
        reseller: 'Lojista B2B',
      };
      const roleLabel = roleLabels[clientRole] || 'Usuário';

      if (clientModalMode === 'create') {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: newClientEmail,
            password: newClientPassword,
            contact_name: newClientName,
            store_name: newClientStore,
            phone: newClientPhone,
            cnpj_cpf: newClientCnpj,
            city: newClientCity,
            state: newClientState,
            role: clientRole,
            representative_id: clientRole === 'reseller' ? (clientRepresentativeId || null) : null,
          }),
        });

        const data = await res.json();
        if (data.success) {
          showToast(`${roleLabel} "${newClientStore || newClientName || newClientEmail}" cadastrado com sucesso!`);
          setIsClientModalOpen(false);
          fetchDashboardData();
        } else {
          setClientError(data.error || 'Erro ao cadastrar usuário.');
        }
      } else {
        // Modo de edição (PATCH/PUT)
        const res = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingClientId,
            contact_name: newClientName,
            store_name: newClientStore,
            phone: newClientPhone,
            cnpj_cpf: newClientCnpj,
            city: newClientCity,
            state: newClientState,
            role: clientRole,
            password: newClientPassword.trim() ? newClientPassword : undefined,
            is_approved: clientApproved,
            representative_id: clientRole === 'reseller' ? (clientRepresentativeId || null) : null,
          }),
        });

        const data = await res.json();
        if (data.success) {
          showToast(`Informações e cargo de "${newClientStore || newClientName || newClientEmail}" atualizados para ${roleLabel}!`);
          setIsClientModalOpen(false);
          fetchDashboardData();
        } else {
          setClientError(data.error || 'Erro ao atualizar dados.');
        }
      }
    } catch {
      setClientError('Erro de conexão ao salvar informações.');
    } finally {
      setSavingClient(false);
    }
  };

  const handleDeleteClient = async (client: any) => {
    if (client.is_master || isMasterEmail(client.email)) {
      alert('A conta master de administração é protegida e não pode ser excluída.');
      return;
    }

    const roleLabels: Record<string, string> = {
      admin: 'administrador',
      representative: 'representante comercial',
      stock: 'membro do estoque',
      reseller: 'lojista',
    };
    const roleName = roleLabels[client.role] || 'usuário';
    const confirmMessage = `Tem certeza que deseja remover a conta de ${roleName} "${client.store_name || client.contact_name || client.email}"? Esta ação é irreversível.`;

    const confirm = window.confirm(confirmMessage);
    if (!confirm) return;

    try {
      const res = await fetch(`/api/admin/users?id=${client.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        const isStaff = client.role !== 'reseller';
        showToast(isStaff ? 'Membro da equipe removido com sucesso.' : 'Conta do lojista removida com sucesso.');
        setClients((prev) => prev.filter((c) => c.id !== client.id));
      } else {
        alert(data.error || 'Erro ao excluir usuário.');
      }
    } catch {
      showToast('Erro de comunicação.');
    }
  };

  const handleQuickApproveClient = async (client: any) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: client.id,
          is_approved: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Cadastro de "${client.store_name || client.contact_name}" aprovado com sucesso!`);
        setClients((prev) =>
          prev.map((c) => (c.id === client.id ? { ...c, is_approved: true } : c))
        );
      } else {
        showToast(data.error || 'Erro ao aprovar lojista.');
      }
    } catch {
      showToast('Erro de conexão ao aprovar lojista.');
    }
  };

  // Handlers para Gestão de Revendedores (Admin Master)
  const handleOpenCreateResellerModal = () => {
    setEditingReseller(null);
    setResellerFormName('');
    setResellerFormEmail('');
    setResellerFormWhatsapp('');
    setResellerFormPhone('');
    setResellerFormStatus('ativo');
    setResellerFormPref('both');
    setResellerFormPassword('');
    setResellerModalOpen(true);
  };

  const handleOpenEditResellerModal = (r: any) => {
    setEditingReseller(r);
    setResellerFormName(r.name || '');
    setResellerFormEmail(r.email || '');
    setResellerFormWhatsapp(r.whatsapp || '');
    setResellerFormPhone(r.phone || '');
    setResellerFormStatus(r.status || 'ativo');
    setResellerFormPref(r.notification_preference || 'both');
    setResellerFormPassword('');
    setResellerModalOpen(true);
  };

  const handleSaveReseller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resellerFormName.trim() || !resellerFormEmail.trim() || !resellerFormWhatsapp.trim()) {
      alert('Preencha os campos obrigatórios: Nome, E-mail e WhatsApp.');
      return;
    }

    setSavingReseller(true);
    try {
      const isEditing = !!editingReseller?.id;
      const url = '/api/admin/resellers';
      const method = isEditing ? 'PUT' : 'POST';
      const body: any = {
        name: resellerFormName.trim(),
        email: resellerFormEmail.trim(),
        whatsapp: resellerFormWhatsapp.trim(),
        phone: resellerFormPhone.trim() || null,
        status: resellerFormStatus,
        notification_preference: resellerFormPref,
      };

      if (isEditing) {
        body.id = editingReseller.id;
        if (resellerFormPassword.trim()) {
          body.password = resellerFormPassword.trim();
        }
      } else {
        if (resellerFormPassword.trim()) {
          body.password = resellerFormPassword.trim();
        }
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao salvar revendedor.');
      }

      setResellerModalOpen(false);
      showToast(isEditing ? 'Revendedor atualizado com sucesso!' : 'Revendedor cadastrado com sucesso!');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Falha ao salvar revendedor.');
    } finally {
      setSavingReseller(false);
    }
  };

  const handleToggleResellerStatus = async (r: any) => {
    const nextStatus = r.status === 'ativo' ? 'inativo' : 'ativo';
    try {
      const res = await fetch('/api/admin/resellers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: r.id,
          status: nextStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao alterar status.');
      }
      showToast(`Revendedor ${nextStatus === 'ativo' ? 'ativado' : 'desativado'} com sucesso!`);
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Falha ao alterar status do revendedor.');
    }
  };

  const handleDeleteReseller = async (r: any) => {
    if (!window.confirm(`Tem certeza que deseja excluir o revendedor "${r.name}"? Os lojistas vinculados a ele serão desvinculados.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/resellers?id=${r.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao excluir revendedor.');
      }
      showToast('Revendedor excluído com sucesso.');
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Falha ao excluir revendedor.');
    }
  };

  // ==========================================
  // FILTRAGEM E PAGINAÇÃO
  // ==========================================
  const pendingClients = useMemo(() => {
    return clients.filter((c) => c.is_approved === false);
  }, [clients]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        productSearch === '' ||
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.code_sku && p.code_sku.toLowerCase().includes(productSearch.toLowerCase()));

      const matchesCat =
        filterCategory === 'all' ||
        p.categories?.some((c) => c.id === filterCategory);

      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'published' && p.is_published && (p.total_stock == null || p.total_stock > 0)) ||
        (filterStatus === 'draft' && !p.is_published) ||
        (filterStatus === 'low_stock' && typeof p.total_stock === 'number' && p.total_stock > 0 && p.total_stock <= 5) ||
        (filterStatus === 'out_of_stock' && (typeof p.total_stock === 'number' ? p.total_stock <= 0 : !p.is_published));

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [products, productSearch, filterCategory, filterStatus]);

  // Produtos visíveis com carregamento progressivo contínuo (Carregar Mais)
  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleProductsCount);
  }, [filteredProducts, visibleProductsCount]);

  // Filtro de Pedidos
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch =
        orderSearch === '' ||
        o.order_number.toLowerCase().includes(orderSearch.toLowerCase()) ||
        o.buyer_name.toLowerCase().includes(orderSearch.toLowerCase()) ||
        (o.buyer_company && o.buyer_company.toLowerCase().includes(orderSearch.toLowerCase())) ||
        o.buyer_phone.includes(orderSearch);

      const matchesStatus =
        orderStatusFilter === 'all' || o.status === orderStatusFilter;

      const matchesReseller =
        orderResellerFilter === 'all' ||
        (orderResellerFilter === 'direct'
          ? !o.reseller_id && !o.representative_id
          : o.reseller_id === orderResellerFilter ||
            o.representative_id === orderResellerFilter ||
            o.reseller_name === orderResellerFilter);

      return matchesSearch && matchesStatus && matchesReseller;
    });
  }, [orders, orderSearch, orderStatusFilter, orderResellerFilter]);

  // Filtro de Clientes e Membros Administrativos
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const q = clientSearch.toLowerCase();
      const matchesSearch =
        clientSearch === '' ||
        c.contact_name?.toLowerCase().includes(q) ||
        c.store_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(clientSearch);

      const matchesRole =
        userRoleFilter === 'all' ||
        (userRoleFilter === 'reseller'
          ? (c.role === 'reseller' || (!c.role && !c.is_master))
          : userRoleFilter === 'representative'
          ? c.role === 'representative'
          : userRoleFilter === 'stock'
          ? c.role === 'stock'
          : userRoleFilter === 'admin'
          ? (c.role === 'admin' || c.role === 'master' || c.is_master)
          : c.role === userRoleFilter);

      const matchesApproval =
        userApprovalFilter === 'all' ||
        (userApprovalFilter === 'pending'
          ? c.is_approved === false
          : c.is_approved !== false);

      return matchesSearch && matchesRole && matchesApproval;
    });
  }, [clients, clientSearch, userRoleFilter, userApprovalFilter]);

  // Filtro de Categorias por Linha Esportiva
  const displayedCategories = useMemo(() => {
    if (selectedDeptFilter === 'all') return categories;
    return categories.filter((c) => {
      const d = findDepartmentForCategory(c.name, departments);
      return d?.id === selectedDeptFilter;
    });
  }, [categories, departments, selectedDeptFilter]);

  // Filtro de Revendedores Cadastrados (Admin Master)
  const filteredResellers = useMemo(() => {
    return adminResellers.filter((r) => {
      const term = resellerSearch.toLowerCase().trim();
      return (
        !term ||
        r.name?.toLowerCase().includes(term) ||
        r.email?.toLowerCase().includes(term) ||
        r.whatsapp?.includes(term) ||
        r.phone?.includes(term)
      );
    });
  }, [adminResellers, resellerSearch]);

  // Busca rápida dentro do dropdown customizado de categorias
  const searchedFilterCategories = useMemo(() => {
    if (!catFilterSearch.trim()) return categories;
    const q = catFilterSearch.toLowerCase().trim();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, catFilterSearch]);

  const publishedCount = useMemo(() => products.filter((p) => p.is_published).length, [products]);
  const draftCount = useMemo(() => products.length - publishedCount, [products, publishedCount]);
  const totalPiecesInStock = useMemo(() => products.reduce((acc, p) => acc + (p.total_stock || 0), 0), [products]);
  const lowStockCount = useMemo(() => products.filter((p) => (typeof p.total_stock === 'number' && p.total_stock > 0 && p.total_stock <= 5)).length, [products]);
  const outOfStockCount = useMemo(() => products.filter((p) => (typeof p.total_stock === 'number' ? p.total_stock === 0 : false)).length, [products]);

  // Renderizador do Status Badge
  const renderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">Recebido</span>;
      case 'approved':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">Aprovado</span>;
      case 'processing':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">Em Separação</span>;
      case 'shipped':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">Despachado</span>;
      case 'delivered':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">Entregue</span>;
      case 'cancelled':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">Cancelado</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  // Se não estiver logado, exibe tela de login direto de alta performance Zeiq
  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-[#090b0e] bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(255,150,0,0.12),rgba(255,255,255,0))] flex flex-col justify-center items-center p-4 sm:p-6 text-white relative overflow-hidden">
        {/* Marca d'água de grade atlética sutil */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.025] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />

        <div className="max-w-md w-full relative z-10 animate-in fade-in zoom-in-95 duration-300">
          {/* Card Principal com Acabamento Carbon Matte e Borda Sutil */}
          <div className="bg-[#12151b]/95 border border-white/[0.08] rounded-3xl p-7 sm:p-9 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)] backdrop-blur-xl">
            
            {/* Logo Oficial Zeiq com Iluminação */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="relative h-9 w-32 mb-4 brightness-0 invert flex items-center justify-center">
                <Image
                  src="/images/logo-zeiq.png"
                  alt="Zeiq Sports"
                  width={128}
                  height={36}
                  priority
                  className="h-full w-auto object-contain"
                />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-[11px] font-semibold text-slate-300 tracking-wide uppercase mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-zeiq-orange" />
                <span>Gestão Administrativa B2B</span>
              </div>

              <h1 className="text-xl font-black text-white tracking-tight">
                Acesso à Diretoria & Equipe
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                Ambiente restrito para controle de estoque, aprovação de pedidos e catálogo.
              </p>
            </div>

            {/* Formulário de Login Direto */}
            <form onSubmit={handleDirectAdminLogin} className="space-y-4">
              {authError && (
                <div className="p-3 bg-rose-950/50 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Campo de E-mail */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  E-mail de acesso
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="ex: marketing@zeiq.com.br"
                    className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#14171d] border border-white/[0.1] hover:border-white/[0.2] focus:border-zeiq-orange focus:ring-2 focus:ring-zeiq-orange/20 text-sm text-white placeholder:text-slate-500 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Campo de Senha com Olhinho Toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={authShowPassword ? 'text' : 'password'}
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-10 pr-11 rounded-xl bg-[#14171d] border border-white/[0.1] hover:border-white/[0.2] focus:border-zeiq-orange focus:ring-2 focus:ring-zeiq-orange/20 text-sm text-white placeholder:text-slate-500 transition-all outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setAuthShowPassword(!authShowPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer z-10 p-1"
                    aria-label={authShowPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {authShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Botão de Entrar */}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 px-4 bg-zeiq-orange hover:bg-zeiq-orange-hover text-zeiq-black rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20 active:scale-[0.99] cursor-pointer disabled:opacity-50 mt-2"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zeiq-black" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Painel</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Rodapé Limpo */}
            <div className="mt-6 pt-5 border-t border-white/[0.08] flex items-center justify-between text-xs text-slate-400">
              <Link
                href="/"
                className="hover:text-white transition-colors inline-flex items-center gap-1.5 font-medium group"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-zeiq-orange transition-transform group-hover:-translate-x-0.5" />
                <span>Voltar ao catálogo</span>
              </Link>

              <span className="text-[11px] font-mono text-slate-500">
                Zeiq Sports
              </span>
            </div>

          </div>

          {/* Nota de Segurança Inferior */}
          <p className="text-center text-[11px] text-slate-500 mt-4 leading-relaxed">
            Área restrita à equipe Zeiq. Acesso monitorado com proteção criptográfica de dados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zeiq-light text-zeiq-black font-sans flex flex-col">
      
      {/* Toast Flutuante de Feedback */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-zeiq-black text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. Barra Superior Oficial Zeiq Admin */}
      <header className="bg-zeiq-black text-white border-b border-zeiq-charcoal sticky top-0 z-40">
        <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-10 h-16 sm:h-18 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Voltar ao catálogo da loja"
            >
              <ArrowLeft className="w-4 h-4 text-zeiq-orange" />
              <span className="hidden md:inline">Ver Catálogo</span>
            </Link>

            <div className="flex items-center gap-3 border-l border-white/15 pl-4">
              <div
                className="relative h-7 w-28 brightness-0 invert flex items-center"
                style={{ position: 'relative', width: '100px', height: '28px' }}
              >
                <Image
                  src="/images/logo-zeiq.png"
                  alt="Zeiq"
                  width={100}
                  height={28}
                  className="h-full w-auto object-contain object-left"
                />
              </div>
              <span className="text-xs font-black bg-white/10 text-zeiq-orange border border-zeiq-orange/30 px-2 py-0.5 rounded uppercase tracking-wider">
                Painel B2B
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Seletor de Avatar SVG com 3 Opções de Cores */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAdminAvatarPickerOpen(!adminAvatarPickerOpen)}
                className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 hover:border-zeiq-orange/40 transition-all cursor-pointer group active:scale-95"
                title="Clique para escolher seu Avatar com cores esportivas"
              >
                <div className="relative">
                  <AvatarIcon avatarId={adminAvatarId} className="w-8 h-8 rounded-full" />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-zeiq-black animate-pulse" />
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-bold text-white leading-tight">
                    {user?.contact_name || user?.email?.split('@')[0] || 'Administrador'}
                  </span>
                  <span className="text-[10px] text-slate-400 leading-none">
                    {isCurrentUserMaster
                      ? '👑 Diretoria (Master)'
                      : isCurrentUserRepresentative
                      ? '💼 Representante'
                      : isCurrentUserStock
                      ? '📦 Estoque'
                      : '🛡️ Administrador'}
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform ${adminAvatarPickerOpen ? 'rotate-180 text-white' : ''}`} />
              </button>

              {/* Popover dos 3 Avatares */}
              {adminAvatarPickerOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-zeiq-dark border border-zeiq-charcoal rounded-3xl p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 text-white">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/5">
                    <div>
                      <h4 className="text-xs font-black text-white">Escolha seu Avatar</h4>
                      <p className="text-[10px] text-slate-400">Personalize com as cores esportivas Zeiq</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdminAvatarPickerOpen(false)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 mt-3">
                    {ADMIN_AVATARS.map((av) => (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => handleSelectAdminAvatar(av.id)}
                        className={`w-full p-2.5 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer text-left ${
                          adminAvatarId === av.id
                            ? `${av.badgeBg} ${av.badgeBorder} ring-1 ring-zeiq-orange/50 shadow-md`
                            : 'bg-zeiq-charcoal/50 border-white/5 hover:border-white/20 hover:bg-zeiq-charcoal'
                        }`}
                      >
                        <AvatarIcon avatarId={av.id} className="w-10 h-10" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white flex items-center justify-between">
                            <span>{av.name}</span>
                            {adminAvatarId === av.id && (
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
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-rose-500/20 hover:text-rose-300 text-slate-300 rounded-xl text-xs font-semibold transition-colors border border-white/10 cursor-pointer active:scale-95"
              title="Sair do painel"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Barra de Navegação de Módulos (Tabs Responsivas no Mobile) */}
      <nav className="bg-white border-b border-zeiq-muted sticky top-16 sm:top-18 z-30 shadow-2xs">
        <div className="max-w-[1720px] mx-auto px-3 sm:px-6 lg:px-10 flex items-center overflow-x-auto no-scrollbar gap-1.5 py-1.5">
          {/* Aba Produtos: Apenas Estoque e Admin/Master */}
          {(isCurrentUserStock || isCurrentUserAdminOrMaster) && (
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 active:scale-95 cursor-pointer ${
                activeTab === 'products'
                  ? 'bg-zeiq-black text-white shadow-xs'
                  : 'text-slate-600 hover:text-zeiq-black hover:bg-slate-100'
              }`}
            >
              <Package className="w-4 h-4" />
              <span className="sm:hidden">Produtos</span>
              <span className="hidden sm:inline">Catálogo de Produtos</span>
              <span className={`px-1.5 py-0.5 rounded-md text-xs font-mono font-bold ${
                activeTab === 'products' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {products.length}
              </span>
            </button>
          )}

          {/* Aba Pedidos: Representante e Admin/Master (Estoque NÃO visualiza) */}
          {(isCurrentUserRepresentative || isCurrentUserAdminOrMaster) && (
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 active:scale-95 cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-zeiq-black text-white shadow-xs'
                  : 'text-slate-600 hover:text-zeiq-black hover:bg-slate-100'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="sm:hidden">Pedidos</span>
              <span className="hidden sm:inline">
                {isCurrentUserRepresentative ? 'Pedidos da Carteira' : 'Pedidos & Cotações'}
              </span>
              <span className={`px-1.5 py-0.5 rounded-md text-xs font-mono font-bold ${
                activeTab === 'orders' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {orders.length}
              </span>
            </button>
          )}

          {/* Aba Banners: Apenas Estoque e Admin/Master */}
          {(isCurrentUserStock || isCurrentUserAdminOrMaster) && (
            <button
              type="button"
              onClick={() => setActiveTab('banners')}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 active:scale-95 cursor-pointer ${
                activeTab === 'banners'
                  ? 'bg-zeiq-black text-white shadow-xs'
                  : 'text-slate-600 hover:text-zeiq-black hover:bg-slate-100'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span className="sm:hidden">Banners</span>
              <span className="hidden sm:inline">Banners da Home</span>
              <span className={`px-1.5 py-0.5 rounded-md text-xs font-mono font-bold ${
                activeTab === 'banners' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {banners.length}/5
              </span>
            </button>
          )}

          {/* Aba Contato: Apenas Admin/Master */}
          {isCurrentUserAdminOrMaster && (
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 active:scale-95 cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-zeiq-black text-white shadow-xs'
                  : 'text-slate-600 hover:text-zeiq-black hover:bg-slate-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="sm:hidden">Contato</span>
              <span className="hidden sm:inline">WhatsApp & Contato</span>
            </button>
          )}

          {/* Aba Clientes/Lojistas: Representante e Admin/Master (Estoque NÃO visualiza) */}
          {(isCurrentUserRepresentative || isCurrentUserAdminOrMaster) && (
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 active:scale-95 cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-zeiq-black text-white shadow-xs'
                  : 'text-slate-600 hover:text-zeiq-black hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="sm:hidden">
                {isCurrentUserRepresentative ? 'Lojistas' : 'Clientes'}
              </span>
              <span className="hidden sm:inline">
                {isCurrentUserRepresentative ? 'Meus Lojistas B2B' : 'Clientes & Lojistas'}
              </span>
              {pendingClients.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500 text-white animate-pulse">
                  {pendingClients.length}
                </span>
              )}
              <span className={`px-1.5 py-0.5 rounded-md text-xs font-mono font-bold ${
                activeTab === 'users' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {clients.length}
              </span>
            </button>
          )}

          {/* Aba Categorias: Apenas Estoque e Admin/Master */}
          {(isCurrentUserStock || isCurrentUserAdminOrMaster) && (
            <button
              type="button"
              onClick={() => setActiveTab('categories')}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 active:scale-95 cursor-pointer ${
                activeTab === 'categories'
                  ? 'bg-zeiq-black text-white shadow-xs'
                  : 'text-slate-600 hover:text-zeiq-black hover:bg-slate-100'
              }`}
            >
              <FolderTree className="w-4 h-4" />
              <span className="sm:hidden">Categorias</span>
              <span className="hidden sm:inline">Categorias do Catálogo</span>
              <span className={`px-1.5 py-0.5 rounded-md text-xs font-mono font-bold ${
                activeTab === 'categories' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {categories.length}
              </span>
            </button>
          )}

          {/* Aba Revendedores: Apenas Admin/Master */}
          {isCurrentUserAdminOrMaster && (
            <button
              type="button"
              onClick={() => setActiveTab('resellers')}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 active:scale-95 cursor-pointer ${
                activeTab === 'resellers'
                  ? 'bg-zeiq-black text-white shadow-xs'
                  : 'text-slate-600 hover:text-zeiq-black hover:bg-slate-100'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span className="sm:hidden">Revendedores</span>
              <span className="hidden sm:inline">Revendedores</span>
              <span className={`px-1.5 py-0.5 rounded-md text-xs font-mono font-bold ${
                activeTab === 'resellers' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {adminResellers.length}
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* 3. Conteúdo Dinâmico por Aba */}
      <main className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 flex-1 w-full space-y-6">

        {/* ======================================================== */}
        {/* ABA 1: PRODUTOS DO CATÁLOGO                             */}
        {/* ======================================================== */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            {/* Métricas de Produtos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => { setFilterStatus('all'); setVisibleProductsCount(ITEMS_PER_PAGE); }}
                className={`p-4 rounded-2xl border-2 text-left transition-all active:scale-98 cursor-pointer ${
                  filterStatus === 'all'
                    ? 'bg-white border-zeiq-black shadow-sm'
                    : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Produtos</p>
                    <h3 className="text-xl sm:text-2xl font-black text-zeiq-black">{products.length}</h3>
                  </div>
                </div>
              </button>

              <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Peças em Estoque</p>
                    <h3 className="text-xl sm:text-2xl font-black text-blue-600">{totalPiecesInStock} un.</h3>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setFilterStatus('published'); setVisibleProductsCount(ITEMS_PER_PAGE); }}
                className={`p-4 rounded-2xl border-2 text-left transition-all active:scale-98 cursor-pointer ${
                  filterStatus === 'published'
                    ? 'bg-white border-emerald-500 shadow-sm'
                    : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Disponíveis</p>
                    <h3 className="text-xl sm:text-2xl font-black text-emerald-600">{publishedCount}</h3>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setFilterStatus('low_stock'); setVisibleProductsCount(ITEMS_PER_PAGE); }}
                className={`p-4 rounded-2xl border-2 text-left transition-all active:scale-98 cursor-pointer ${
                  filterStatus === 'low_stock'
                    ? 'bg-white border-amber-500 shadow-sm'
                    : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Baixo Estoque</p>
                    <h3 className="text-xl sm:text-2xl font-black text-amber-600">{lowStockCount}</h3>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setFilterStatus('out_of_stock'); setVisibleProductsCount(ITEMS_PER_PAGE); }}
                className={`p-4 rounded-2xl border-2 text-left transition-all active:scale-98 cursor-pointer ${
                  filterStatus === 'out_of_stock'
                    ? 'bg-white border-rose-500 shadow-sm'
                    : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                    <EyeOff className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Esgotados</p>
                    <h3 className="text-xl sm:text-2xl font-black text-rose-600">{outOfStockCount}</h3>
                  </div>
                </div>
              </button>
            </div>

            {/* Barra de Filtros e Busca de Produtos */}
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-3">
              {/* Linha 1: Busca e Ação Principal (Cadastrar Produto) */}
              <div className="flex flex-row items-center justify-between gap-2 sm:gap-3">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setVisibleProductsCount(ITEMS_PER_PAGE);
                    }}
                    placeholder="Pesquisar por nome ou SKU..."
                    className="w-full pl-10 pr-9 py-2 sm:py-2.5 text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                  {productSearch && (
                    <button
                      onClick={() => {
                        setProductSearch('');
                        setVisibleProductsCount(ITEMS_PER_PAGE);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-zeiq-black p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setIsProductModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-zeiq-orange" />
                  <span className="hidden sm:inline">Cadastrar Novo Produto</span>
                  <span className="sm:hidden">Novo</span>
                </button>
              </div>

              {/* Linha 2: Filtros de Categoria e Segmented Control de Estoque */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100">
                {/* 1. Seletor Customizado de Categoria */}
                <div ref={catDropdownRef} className="relative w-full lg:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)}
                    className="w-full lg:w-auto px-3.5 py-2.5 bg-[#f8f9fa] hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-zeiq-black flex items-center justify-between gap-2.5 transition-all shadow-2xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Filter className="w-3.5 h-3.5 text-zeiq-orange shrink-0" />
                      <span className="truncate max-w-[240px] sm:max-w-[280px] lg:max-w-[220px]">
                        {filterCategory === 'all'
                          ? `Todas as Categorias (${categories.length})`
                          : categories.find((c) => c.id === filterCategory)?.name || 'Categoria'}
                      </span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isCatDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isCatDropdownOpen && (
                    <div className="absolute left-0 mt-1.5 w-full sm:w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 p-2 space-y-1.5 animate-in fade-in slide-in-from-top-1">
                      <div className="relative px-1 pt-1 pb-0.5">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          autoFocus
                          value={catFilterSearch}
                          onChange={(e) => setCatFilterSearch(e.target.value)}
                          placeholder="Buscar categoria..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#f8f9fa] border border-slate-200 rounded-lg text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                        />
                      </div>

                      <div className="max-h-60 overflow-y-auto no-scrollbar divide-y divide-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setFilterCategory('all');
                            setVisibleProductsCount(ITEMS_PER_PAGE);
                            setIsCatDropdownOpen(false);
                            setCatFilterSearch('');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                            filterCategory === 'all'
                              ? 'bg-zeiq-black text-white font-bold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>Todas as Categorias</span>
                          <span className={`text-xs font-mono px-1.5 py-0.2 rounded ${
                            filterCategory === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {categories.length}
                          </span>
                        </button>

                        {searchedFilterCategories.map((c) => {
                          const isSelected = filterCategory === c.id;
                          const prodCount = products.filter((p) => p.categories?.some((cat) => cat.id === c.id)).length;

                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setFilterCategory(c.id);
                                setVisibleProductsCount(ITEMS_PER_PAGE);
                                setIsCatDropdownOpen(false);
                                setCatFilterSearch('');
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-zeiq-black text-white font-bold'
                                  : 'text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <span className="truncate pr-2">{c.name}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-xs font-mono px-1.5 py-0.2 rounded ${
                                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {prodCount}
                                </span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-zeiq-orange" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Segmented Control de Status de Estoque com Rolagem Horizontal Suave */}
                <div className="w-full lg:w-auto flex items-center overflow-x-auto no-scrollbar p-1 bg-[#f8f9fa] border border-slate-200 rounded-xl gap-1 shrink-0 -mx-0.5">
                  <button
                    type="button"
                    onClick={() => { setFilterStatus('all'); setVisibleProductsCount(ITEMS_PER_PAGE); }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center whitespace-nowrap shrink-0 cursor-pointer ${
                      filterStatus === 'all' ? 'bg-zeiq-black text-white shadow-2xs' : 'text-slate-600 hover:text-zeiq-black'
                    }`}
                  >
                    Todos ({products.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFilterStatus('published'); setVisibleProductsCount(ITEMS_PER_PAGE); }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                      filterStatus === 'published' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-emerald-700'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span>Visíveis ({publishedCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFilterStatus('low_stock'); setVisibleProductsCount(ITEMS_PER_PAGE); }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                      filterStatus === 'low_stock' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:text-amber-700'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span>Baixo Estoque ({lowStockCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFilterStatus('out_of_stock'); setVisibleProductsCount(ITEMS_PER_PAGE); }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                      filterStatus === 'out_of_stock' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600 hover:text-rose-700'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                    <span>Esgotados ({outOfStockCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFilterStatus('draft'); setVisibleProductsCount(ITEMS_PER_PAGE); }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                      filterStatus === 'draft' ? 'bg-slate-700 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                    <span>Ocultos ({draftCount})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Banner Informativo quando filtrado por Baixo Estoque ou Esgotados ou Ocultos */}
            {filterStatus === 'low_stock' && (
              <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold block">
                      Filtrando por Produtos com Baixo Estoque ({lowStockCount})
                    </span>
                    <span className="text-xs text-amber-800 block">
                      Itens com 5 ou menos unidades restantes. Clique em &quot;Ajustar Estoque&quot; na linha do produto para atualizar quantidades.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => { setFilterStatus('all'); setVisibleProductsCount(ITEMS_PER_PAGE); }}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs shrink-0 transition-colors self-start sm:self-auto cursor-pointer"
                >
                  Ver Todos os Produtos
                </button>
              </div>
            )}

            {filterStatus === 'out_of_stock' && (
              <div className="p-3.5 bg-rose-50/90 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-950 animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-700 flex items-center justify-center shrink-0">
                    <EyeOff className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold block">
                      Filtrando por Produtos Esgotados ({outOfStockCount})
                    </span>
                    <span className="text-xs text-rose-800 block">
                      Itens com estoque zerado no momento. Na vitrine, estes tamanhos aparecem bloqueados com a etiqueta &quot;Esgotado&quot;.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => { setFilterStatus('all'); setVisibleProductsCount(ITEMS_PER_PAGE); }}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-100 text-rose-900 border border-rose-300 font-bold text-xs shrink-0 transition-colors self-start sm:self-auto cursor-pointer"
                >
                  Ver Todos os Produtos
                </button>
              </div>
            )}

            {/* Banner Informativo quando filtrado por Sem Estoque / Pausados */}
            {filterStatus === 'draft' && (
              <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 animate-in fade-in">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                    <EyeOff className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold block">
                      Filtrando por Produtos Sem Estoque ({draftCount})
                    </span>
                    <span className="text-xs text-amber-800 block">
                      Estes itens estão pausados e não aparecem na vitrine para os revendedores. Clique em &quot;Sem Estoque&quot; na linha do produto para reativá-lo.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => { setFilterStatus('all'); setVisibleProductsCount(ITEMS_PER_PAGE); }}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs shrink-0 transition-colors self-start sm:self-auto cursor-pointer"
                >
                  Ver Todos os Produtos
                </button>
              </div>
            )}

            {/* Tabela de Produtos (Desktop) + Cards (Mobile) */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full min-w-[680px] text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b border-slate-200/80 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Imagem</th>
                      <th className="py-3 px-4">Produto & SKU</th>
                      <th className="py-3 px-4">Categorias</th>
                      <th className="py-3 px-4">Preço Atacado</th>
                      <th className="py-3 px-4 text-center">Estoque</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Destaque</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {paginatedProducts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          Nenhum produto localizado com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      paginatedProducts.map((prod) => {
                        const cover = prod.images?.find((i) => i.is_cover)?.public_url || prod.images?.[0]?.public_url;
                        return (
                          <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <div className="w-12 h-12 rounded-lg bg-[#f8f9fa] border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                {cover ? (
                                  <img src={cover} alt="" className="w-full h-full object-cover object-top" />
                                ) : (
                                  <ImageIcon className="w-4 h-4 text-slate-300" />
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-4 max-w-sm">
                              <p className="font-bold text-zeiq-black line-clamp-1">{prod.name}</p>
                              {prod.code_sku && (
                                <span className="font-mono text-xs text-slate-500 font-semibold block mt-0.5">
                                  SKU: {prod.code_sku}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {prod.categories && prod.categories.length > 0 ? (
                                  prod.categories.map((c) => (
                                    <span key={c.id} className="text-xs font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                      {c.name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-slate-400 italic">Sem categoria</span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-4 font-mono font-bold text-zeiq-black whitespace-nowrap">
                              {prod.price != null && prod.price > 0 ? (
                                <span className="text-emerald-700">
                                  R$ {prod.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal italic text-xs">Sob consulta</span>
                              )}
                            </td>

                            {/* Coluna de Estoque com Ajuste Rápido */}
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenQuickStock(prod)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border shadow-2xs cursor-pointer active:scale-95 group ${
                                  prod.total_stock != null && prod.total_stock > 5
                                    ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
                                    : prod.total_stock != null && prod.total_stock > 0
                                    ? 'bg-amber-50/80 hover:bg-amber-100 text-amber-800 border-amber-200 hover:border-amber-300'
                                    : prod.total_stock === 0
                                    ? 'bg-rose-50/70 hover:bg-rose-100/80 text-rose-700 border-rose-200 hover:border-rose-300'
                                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                                title="Clique para abrir o ajuste rápido de estoque"
                              >
                                <Boxes className={`w-3.5 h-3.5 ${
                                  prod.total_stock != null && prod.total_stock > 5
                                    ? 'text-slate-500 group-hover:text-slate-700'
                                    : prod.total_stock != null && prod.total_stock > 0
                                    ? 'text-amber-600'
                                    : prod.total_stock === 0
                                    ? 'text-rose-500'
                                    : 'text-slate-400'
                                }`} />
                                <span className="font-mono">
                                  {typeof prod.total_stock === 'number'
                                    ? prod.total_stock === 0
                                      ? '0 un. (Esgotado)'
                                      : `${prod.total_stock} un.`
                                    : 'Ajustar estoque'}
                                </span>
                              </button>
                            </td>

                            {/* Coluna de Status (Visibilidade no Catálogo) */}
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleTogglePublished(prod)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all active:scale-95 cursor-pointer shadow-2xs ${
                                  prod.is_published
                                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200/90'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                                }`}
                                title={prod.is_published ? 'Produto visível no catálogo. Clique para ocultar.' : 'Produto oculto. Clique para exibir.'}
                              >
                                <span className={`w-2 h-2 rounded-full ${prod.is_published ? 'bg-emerald-500 ring-2 ring-emerald-200/60' : 'bg-slate-400'}`} />
                                <span>{prod.is_published ? 'Visível' : 'Oculto'}</span>
                              </button>
                            </td>

                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleFeatured(prod)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  prod.is_featured
                                    ? 'text-amber-500 hover:text-amber-600'
                                    : 'text-slate-300 hover:text-slate-400'
                                }`}
                                title={prod.is_featured ? 'Remover destaque' : 'Marcar destaque'}
                              >
                                <Star className={`w-4 h-4 ${prod.is_featured ? 'fill-amber-400' : ''}`} />
                              </button>
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingProduct(prod);
                                    setIsProductModalOpen(true);
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-zeiq-black hover:bg-slate-100 rounded-lg transition-colors"
                                  title="Editar Produto"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteProduct(prod)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Excluir Produto"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Visualização de Produtos em Cards para Dispositivos Móveis */}
              <div className="md:hidden divide-y divide-slate-100">
                {paginatedProducts.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs px-4">
                    Nenhum produto localizado com os filtros selecionados.
                  </div>
                ) : (
                  paginatedProducts.map((prod) => {
                    const cover = prod.images?.find((i) => i.is_cover)?.public_url || prod.images?.[0]?.public_url;
                    return (
                      <div key={prod.id} className="p-3.5 space-y-3 transition-colors hover:bg-slate-50/50">
                        <div className="flex items-start gap-3">
                          {/* Imagem Proporção Vertical 4:5 */}
                          <div className="w-16 h-20 rounded-xl bg-slate-50 border border-slate-200/90 overflow-hidden flex items-center justify-center shrink-0 relative shadow-2xs">
                            {cover ? (
                              <img src={cover} alt="" className="w-full h-full object-cover object-top" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-slate-300" />
                            )}
                            {prod.is_featured && (
                              <span className="absolute top-1 left-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-white" title="Produto em destaque" />
                            )}
                          </div>

                          {/* Informações Centrais */}
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-zeiq-black text-xs leading-snug line-clamp-2">
                              {prod.name}
                            </h4>

                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {prod.code_sku && (
                                <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                                  {prod.code_sku}
                                </span>
                              )}
                              {prod.categories?.[0] && (
                                <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[130px]">
                                  {prod.categories[0].name}
                                </span>
                              )}
                            </div>

                            <div className="mt-1 font-mono font-bold text-xs">
                              {prod.price != null && prod.price > 0 ? (
                                <span className="text-emerald-700">
                                  R$ {prod.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal italic text-[11px]">
                                  Sob consulta
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Ações e Controles em Linha no Mobile */}
                        <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100 text-xs">
                          {/* Controles de Estoque e Visibilidade */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <button
                              type="button"
                              onClick={() => handleOpenQuickStock(prod)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all active:scale-95 cursor-pointer shadow-2xs ${
                                prod.total_stock != null && prod.total_stock > 5
                                  ? 'bg-slate-50 text-slate-700 border-slate-200'
                                  : prod.total_stock != null && prod.total_stock > 0
                                  ? 'bg-amber-50/80 text-amber-800 border-amber-200'
                                  : prod.total_stock === 0
                                  ? 'bg-rose-50/70 text-rose-700 border-rose-200'
                                  : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}
                              title="Ajustar estoque deste produto"
                            >
                              <Boxes className={`w-3 h-3 ${
                                prod.total_stock != null && prod.total_stock > 5
                                  ? 'text-slate-500'
                                  : prod.total_stock != null && prod.total_stock > 0
                                  ? 'text-amber-600'
                                  : prod.total_stock === 0
                                  ? 'text-rose-500'
                                  : 'text-slate-400'
                              }`} />
                              <span className="font-mono">
                                {typeof prod.total_stock === 'number'
                                  ? prod.total_stock === 0
                                    ? '0 un. (Esgotado)'
                                    : `${prod.total_stock} un.`
                                  : 'Estoque'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleTogglePublished(prod)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all active:scale-95 cursor-pointer shadow-2xs ${
                                prod.is_published
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200/90'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                              title={prod.is_published ? 'Produto visível no catálogo. Clique para ocultar.' : 'Produto oculto. Clique para exibir.'}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${prod.is_published ? 'bg-emerald-500 ring-2 ring-emerald-200/60' : 'bg-slate-400'}`} />
                              <span>{prod.is_published ? 'Visível' : 'Oculto'}</span>
                            </button>
                          </div>

                          {/* Ações: Destaque, Editar e Excluir */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleFeatured(prod)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer active:scale-90 ${
                                prod.is_featured ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-slate-400'
                              }`}
                              title={prod.is_featured ? 'Destaque ativo' : 'Sem destaque'}
                            >
                              <Star className={`w-4 h-4 ${prod.is_featured ? 'fill-amber-400' : ''}`} />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingProduct(prod);
                                setIsProductModalOpen(true);
                              }}
                              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs transition-colors active:scale-95 cursor-pointer"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(prod)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors active:scale-90 cursor-pointer"
                              title="Excluir produto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Rodapé: Carregar Mais Produtos (igual ao site) */}
              <div className="p-4 sm:p-5 bg-[#f8f9fa] border-t border-slate-200 flex flex-col items-center justify-center gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <span>
                    Exibindo <strong>{Math.min(visibleProductsCount, filteredProducts.length)}</strong> de <strong>{filteredProducts.length}</strong> produtos
                  </span>
                  {filteredProducts.length > 0 && (
                    <span className="text-slate-300">•</span>
                  )}
                  {visibleProductsCount < filteredProducts.length ? (
                    <span className="text-slate-400 font-mono text-[11px]">
                      ({filteredProducts.length - visibleProductsCount} restantes)
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-bold text-[11px] flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Todos os produtos carregados
                    </span>
                  )}
                </div>

                {visibleProductsCount < filteredProducts.length && (
                  <div className="flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleLoadMoreProducts}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-white hover:bg-slate-100 text-zeiq-black border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      <ArrowDown className="w-4 h-4 text-zeiq-orange" />
                      <span>Carregar mais produtos ({Math.min(ITEMS_PER_PAGE, filteredProducts.length - visibleProductsCount)} restantes)</span>
                    </button>

                    {filteredProducts.length - visibleProductsCount > ITEMS_PER_PAGE && (
                      <button
                        type="button"
                        onClick={() => setVisibleProductsCount(filteredProducts.length)}
                        className="px-3.5 py-2.5 text-xs text-slate-500 hover:text-zeiq-black hover:bg-slate-200/60 rounded-xl font-semibold transition-colors cursor-pointer"
                      >
                        Carregar todos ({filteredProducts.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA 2: PEDIDOS & COTAÇÕES DOS CLIENTES                  */}
        {/* ======================================================== */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            {/* Métricas de Pedidos */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Pedidos</p>
                <h3 className="text-xl sm:text-2xl font-black text-zeiq-black mt-1">{orders.length}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Todas as ordens de compra</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Em Andamento</p>
                <h3 className="text-xl sm:text-2xl font-black text-amber-600 mt-1">
                  {orders.filter((o) => ['pending', 'approved', 'processing', 'shipped'].includes(o.status)).length}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Pendentes ou em trânsito</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Entregues</p>
                <h3 className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
                  {orders.filter((o) => o.status === 'delivered').length}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Concluídos com sucesso</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Peças</p>
                <h3 className="text-xl sm:text-2xl font-black text-indigo-600 mt-1">
                  {orders.reduce((acc, o) => acc + (o.total_pieces || 0), 0)}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Grade física total</p>
              </div>
            </div>

            {/* Barra de Filtro de Pedidos */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Pesquisar por código, cliente ou WhatsApp..."
                  className="w-full pl-10 pr-4 py-2.5 text-base sm:text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {[
                  { key: 'all', label: 'Todos os Status' },
                  { key: 'pending', label: 'Pendente' },
                  { key: 'approved', label: 'Aprovado' },
                  { key: 'processing', label: 'Em Separação' },
                  { key: 'shipped', label: 'Despachado' },
                  { key: 'delivered', label: 'Entregue' },
                  { key: 'cancelled', label: 'Cancelado' },
                ].map((st) => (
                  <button
                    key={st.key}
                    onClick={() => setOrderStatusFilter(st.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      orderStatusFilter === st.key
                        ? 'bg-zeiq-black text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtro de Pedidos por Revendedor (Regra de Carteira Comercial) */}
            {isCurrentUserAdminOrMaster && (
              <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-2">
                <div className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5 mr-1 shrink-0">
                  <Briefcase className="w-3.5 h-3.5 text-zeiq-orange" />
                  <span>Filtrar por Revendedor:</span>
                </div>

                <button
                  type="button"
                  onClick={() => setOrderResellerFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    orderResellerFilter === 'all'
                      ? 'bg-zeiq-black text-white shadow-xs'
                      : 'bg-[#f8f9fa] hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  Todos ({orders.length})
                </button>

                {adminResellers.map((r) => {
                  const count = orders.filter(
                    (o) =>
                      o.reseller_id === r.id ||
                      o.reseller_name === r.name ||
                      o.representative_id === r.id ||
                      o.representative_id === r.user_id
                  ).length;

                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setOrderResellerFilter(r.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        orderResellerFilter === r.id
                          ? 'bg-zeiq-orange text-zeiq-black shadow-xs font-extrabold'
                          : 'bg-[#f8f9fa] hover:bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      <span>{r.name.split(' ')[0]} {r.name.split(' ')[1] || ''}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        orderResellerFilter === r.id ? 'bg-black/20 text-black' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setOrderResellerFilter('direct')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    orderResellerFilter === 'direct'
                      ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                      : 'bg-[#f8f9fa] hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <span>Venda Direta / Matriz</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    orderResellerFilter === 'direct' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {orders.filter((o) => !o.reseller_id && !o.representative_id).length}
                  </span>
                </button>
              </div>
            )}

            {/* Tabela de Pedidos (Desktop) + Cards (Mobile) */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full min-w-[700px] text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b border-slate-200/80 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Pedido</th>
                      <th className="py-3 px-4">Lojista / Arena</th>
                      <th className="py-3 px-4">Contato WhatsApp</th>
                      <th className="py-3 px-4 text-center">Peças</th>
                      <th className="py-3 px-4 text-center">Status Operacional</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          Nenhum pedido localizado nesta visualização.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const cleanPhone = (order.buyer_phone || '').replace(/\D/g, '');
                        return (
                          <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4 font-mono">
                              <span className="font-bold text-zeiq-black block">#{order.order_number}</span>
                              <span className="text-xs text-slate-400">
                                {new Date(order.created_at || '').toLocaleDateString('pt-BR')}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <strong className="text-zeiq-black block">
                                {order.buyer_company || order.buyer_name}
                              </strong>
                              {order.buyer_company && (
                                <span className="text-xs text-slate-500 block">
                                  Resp: {order.buyer_name}
                                </span>
                              )}
                              {(order.reseller_name || order.representative_name) && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-200/80 px-2 py-0.5 rounded-md mt-1">
                                  <Briefcase className="w-3 h-3 text-sky-500 shrink-0" />
                                  <span>Revendedor: {order.reseller_name || order.representative_name}</span>
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              {cleanPhone ? (
                                <a
                                  href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                                    `Olá ${order.buyer_name}! Aqui é da Zeiq Sports sobre o seu pedido #${order.order_number}.`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{order.buyer_phone}</span>
                                </a>
                              ) : (
                                <span className="text-slate-400 italic">Não informado</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <span className="font-bold text-zeiq-black">{order.total_pieces} un.</span>
                              <span className="text-xs text-slate-400 block">
                                ({order.items?.length || 0} modelos)
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <OrderStatusPopover
                                orderId={order.id}
                                orderNumber={order.order_number}
                                currentStatus={order.status}
                                isOpen={openStatusOrderId === `desktop-${order.id}`}
                                onOpenChange={(open) => setOpenStatusOrderId(open ? `desktop-${order.id}` : null)}
                                onSelectStatus={(newStatus) => handleUpdateOrderStatus(order.id, newStatus)}
                              />
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {order.whatsapp_share_url && (
                                  <a
                                    href={order.whatsapp_share_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors"
                                    title="Notificação WhatsApp do Revendedor"
                                  >
                                    <Send className="w-4 h-4 text-emerald-600" />
                                  </a>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setTrackingModalOrder(order);
                                    setNewTrackingCode(order.tracking_code || '');
                                    setNewTrackingUrl(order.tracking_url || '');
                                  }}
                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                                  title="Cadastrar / Editar Rastreamento"
                                >
                                  <Truck className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setSelectedOrderDetails(order)}
                                  className="px-2.5 py-1.5 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-lg text-xs font-bold transition-all"
                                >
                                  Ver Grade
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Visualização de Pedidos em Cards no Mobile */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs px-4">
                    Nenhum pedido localizado nesta visualização.
                  </div>
                ) : (
                  filteredOrders.map((order) => {
                    const cleanPhone = (order.buyer_phone || '').replace(/\D/g, '');

                    return (
                      <div key={order.id} className="p-3.5 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono font-bold text-zeiq-black text-sm block">#{order.order_number}</span>
                            <span className="text-xs text-slate-400">
                              {new Date(order.created_at || '').toLocaleDateString('pt-BR')} • {order.total_pieces} un. ({order.items?.length || 0} modelos)
                            </span>
                          </div>

                          <OrderStatusPopover
                            orderId={order.id}
                            orderNumber={order.order_number}
                            currentStatus={order.status}
                            isOpen={openStatusOrderId === `mobile-${order.id}`}
                            onOpenChange={(open) => setOpenStatusOrderId(open ? `mobile-${order.id}` : null)}
                            onSelectStatus={(newStatus) => handleUpdateOrderStatus(order.id, newStatus)}
                          />
                        </div>

                        <div>
                          <strong className="text-zeiq-black text-xs block">{order.buyer_company || order.buyer_name}</strong>
                          {order.buyer_company && (
                            <span className="text-xs text-slate-500 block">Resp: {order.buyer_name}</span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                          {cleanPhone ? (
                            <a
                              href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                                `Olá ${order.buyer_name}! Aqui é da Zeiq Sports sobre o seu pedido #${order.order_number}.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{order.buyer_phone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 italic text-xs">Sem telefone</span>
                          )}

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setTrackingModalOrder(order);
                                setNewTrackingCode(order.tracking_code || '');
                                setNewTrackingUrl(order.tracking_url || '');
                              }}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                              title="Cadastrar Rastreamento"
                            >
                              Rastreio
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedOrderDetails(order)}
                              className="px-3 py-1.5 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-xl font-bold transition-all cursor-pointer"
                            >
                              Ver Grade
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA 3: CLIENTES & LOJISTAS CADASTRADOS                  */}
        {/* ======================================================== */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Métricas de Clientes e Equipe Zeiq */}
            <div className={`grid gap-3 sm:gap-4 ${isCurrentUserRepresentative ? 'grid-cols-2 sm:grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'}`}>
              <button
                type="button"
                onClick={() => setUserRoleFilter('reseller')}
                className={`text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
                  userRoleFilter === 'reseller'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-zeiq-orange/20'
                    : 'bg-white border-slate-200/80 shadow-xs hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className={`text-xs font-bold uppercase tracking-wider ${
                    userRoleFilter === 'reseller' ? 'text-slate-300' : 'text-slate-400'
                  }`}>
                    {isCurrentUserRepresentative ? 'Meus Lojistas' : 'Lojistas B2B'}
                  </p>
                  <Building2 className={`w-4 h-4 ${
                    userRoleFilter === 'reseller' ? 'text-zeiq-orange' : 'text-slate-400'
                  }`} />
                </div>
                <h3 className={`text-xl sm:text-2xl font-black mt-1 ${
                  userRoleFilter === 'reseller' ? 'text-white' : 'text-zeiq-black'
                }`}>
                  {clients.filter((c) => c.role === 'reseller' || (!c.role && !c.is_master)).length}
                </h3>
                <p className={`text-xs mt-0.5 ${
                  userRoleFilter === 'reseller' ? 'text-slate-300' : 'text-slate-500'
                }`}>
                  {isCurrentUserRepresentative ? 'Lojistas vinculados a você' : 'Acesso ao catálogo e cotações'}
                </p>
              </button>

              {!isCurrentUserRepresentative ? (
                <>
                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('representative')}
                    className={`text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
                      userRoleFilter === 'representative'
                        ? 'bg-sky-950 text-white border-sky-900 shadow-md ring-2 ring-sky-500/20'
                        : 'bg-white border-slate-200/80 shadow-xs hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-bold uppercase tracking-wider ${
                        userRoleFilter === 'representative' ? 'text-sky-200' : 'text-sky-700'
                      }`}>
                        Representantes
                      </p>
                      <Briefcase className={`w-4 h-4 ${
                        userRoleFilter === 'representative' ? 'text-sky-400' : 'text-sky-600'
                      }`} />
                    </div>
                    <h3 className={`text-xl sm:text-2xl font-black mt-1 ${
                      userRoleFilter === 'representative' ? 'text-white' : 'text-sky-900'
                    }`}>
                      {clients.filter((c) => c.role === 'representative').length}
                    </h3>
                    <p className={`text-xs mt-0.5 ${
                      userRoleFilter === 'representative' ? 'text-sky-200/80' : 'text-slate-500'
                    }`}>
                      Gestão de carteiras e pedidos
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('stock')}
                    className={`text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
                      userRoleFilter === 'stock'
                        ? 'bg-blue-950 text-white border-blue-900 shadow-md ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200/80 shadow-xs hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-bold uppercase tracking-wider ${
                        userRoleFilter === 'stock' ? 'text-blue-200' : 'text-blue-700'
                      }`}>
                        Estoque & Expedição
                      </p>
                      <Boxes className={`w-4 h-4 ${
                        userRoleFilter === 'stock' ? 'text-blue-400' : 'text-blue-600'
                      }`} />
                    </div>
                    <h3 className={`text-xl sm:text-2xl font-black mt-1 ${
                      userRoleFilter === 'stock' ? 'text-white' : 'text-blue-900'
                    }`}>
                      {clients.filter((c) => c.role === 'stock').length}
                    </h3>
                    <p className={`text-xs mt-0.5 ${
                      userRoleFilter === 'stock' ? 'text-blue-200/80' : 'text-slate-500'
                    }`}>
                      Gestão e ajuste de estoque
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUserRoleFilter('admin')}
                    className={`text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
                      userRoleFilter === 'admin'
                        ? 'bg-amber-950 text-white border-amber-900 shadow-md ring-2 ring-amber-500/20'
                        : 'bg-white border-slate-200/80 shadow-xs hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-bold uppercase tracking-wider ${
                        userRoleFilter === 'admin' ? 'text-amber-200' : 'text-amber-700'
                      }`}>
                        Administração & Master
                      </p>
                      <ShieldCheck className={`w-4 h-4 ${
                        userRoleFilter === 'admin' ? 'text-zeiq-orange' : 'text-amber-600'
                      }`} />
                    </div>
                    <h3 className={`text-xl sm:text-2xl font-black mt-1 ${
                      userRoleFilter === 'admin' ? 'text-white' : 'text-amber-900'
                    }`}>
                      {clients.filter((c) => c.role === 'admin' || c.is_master).length}
                    </h3>
                    <p className={`text-xs mt-0.5 ${
                      userRoleFilter === 'admin' ? 'text-amber-200/80' : 'text-slate-500'
                    }`}>
                      Acesso total ao painel e equipe
                    </p>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setUserApprovalFilter('pending');
                    setUserRoleFilter('all');
                  }}
                  className={`text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${
                    userApprovalFilter === 'pending'
                      ? 'bg-amber-950 text-white border-amber-900 shadow-md ring-2 ring-amber-500/20'
                      : 'bg-white border-slate-200/80 shadow-xs hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                      Aguardando Aprovação
                    </p>
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black mt-1 text-amber-900">
                    {pendingClients.length}
                  </h3>
                  <p className="text-xs mt-0.5 text-slate-500">
                    Lojistas aguardando sua liberação
                  </p>
                </button>
              )}
            </div>

            {/* Aviso de Lojistas Aguardando Aprovação */}
            {pendingClients.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-950">
                      {pendingClients.length} {pendingClients.length === 1 ? 'solicitação de cadastro aguardando aprovação' : 'solicitações de cadastro aguardando aprovação'}
                    </h4>
                    <p className="text-xs text-amber-800/90 mt-0.5">
                      Lojistas preencheram seus dados e aguardam sua aprovação para ter acesso ao catálogo de revenda.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUserApprovalFilter('pending');
                    setUserRoleFilter('all');
                  }}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs self-start sm:self-auto cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
                >
                  <span>Filtrar Pendentes ({pendingClients.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Busca, Filtros de Papel e Ações */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                {/* Campo de Busca */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Pesquisar por loja, responsável ou e-mail..."
                    className="w-full pl-10 pr-4 py-2.5 text-base sm:text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                </div>

                {/* Filtros em Abas/Pílulas */}
                <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl shrink-0 self-start sm:self-auto overflow-x-auto max-w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setUserRoleFilter('all');
                      setUserApprovalFilter('all');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      userRoleFilter === 'all' && userApprovalFilter === 'all'
                        ? 'bg-white text-zeiq-black shadow-2xs'
                        : 'text-slate-600 hover:text-zeiq-black'
                    }`}
                  >
                    Todos ({clients.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUserApprovalFilter(userApprovalFilter === 'pending' ? 'all' : 'pending');
                      if (userApprovalFilter !== 'pending') setUserRoleFilter('all');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      userApprovalFilter === 'pending'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : pendingClients.length > 0
                        ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
                        : 'text-slate-600 hover:text-zeiq-black'
                    }`}
                  >
                    <span>⏳ Pendentes</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      userApprovalFilter === 'pending' ? 'bg-amber-800 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {pendingClients.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUserRoleFilter('reseller');
                      setUserApprovalFilter('all');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      userRoleFilter === 'reseller' && userApprovalFilter === 'all'
                        ? 'bg-white text-emerald-800 shadow-2xs'
                        : 'text-slate-600 hover:text-zeiq-black'
                    }`}
                  >
                    Lojistas ({clients.filter((c) => c.role === 'reseller' || (!c.role && !c.is_master)).length})
                  </button>

                  {!isCurrentUserRepresentative && (
                    <>
                      <button
                        type="button"
                        onClick={() => setUserRoleFilter('representative')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          userRoleFilter === 'representative'
                            ? 'bg-white text-sky-800 shadow-2xs'
                            : 'text-slate-600 hover:text-zeiq-black'
                        }`}
                      >
                        Representantes ({clients.filter((c) => c.role === 'representative').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserRoleFilter('stock')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          userRoleFilter === 'stock'
                            ? 'bg-white text-blue-800 shadow-2xs'
                            : 'text-slate-600 hover:text-zeiq-black'
                        }`}
                      >
                        Estoque ({clients.filter((c) => c.role === 'stock').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserRoleFilter('admin')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          userRoleFilter === 'admin'
                            ? 'bg-white text-amber-900 shadow-2xs'
                            : 'text-slate-600 hover:text-zeiq-black'
                        }`}
                      >
                        Admins ({clients.filter((c) => c.role === 'admin' || c.is_master).length})
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenCreateUserModal('reseller')}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-zeiq-black rounded-xl text-xs font-bold transition-all shadow-2xs shrink-0 active:scale-95 cursor-pointer"
                  title="Cadastrar lojista parceiro para compras no atacado"
                >
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>Novo Lojista</span>
                </button>

                {isCurrentUserAdminOrMaster && (
                  <button
                    type="button"
                    onClick={() => handleOpenCreateUserModal('representative')}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 active:scale-95 cursor-pointer"
                    title="Cadastrar novo representante comercial ou membro da equipe"
                  >
                    <Briefcase className="w-4 h-4 text-zeiq-orange" />
                    <span>Novo Membro / Equipe</span>
                  </button>
                )}
              </div>
            </div>

            {/* Tabela de Clientes e Membros Administrativos */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b border-slate-200/80 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Loja / Membro</th>
                      <th className="py-3 px-4">Responsável</th>
                      <th className="py-3 px-4">WhatsApp</th>
                      <th className="py-3 px-4">E-mail de Acesso</th>
                      <th className="py-3 px-4 text-center">Tipo de Acesso / Cargo</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Cadastro</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredClients.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          Nenhum usuário ou lojista localizado para o filtro selecionado.
                        </td>
                      </tr>
                    ) : (
                      filteredClients.map((client) => {
                        const cleanPhone = (client.phone || '').replace(/\D/g, '');
                        const isMaster = client.is_master || isMasterEmail(client.email);

                        return (
                          <tr key={client.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4">
                              <strong className="text-zeiq-black block font-semibold">{client.store_name}</strong>
                              <span className="text-xs text-slate-400 block">
                                {client.city ? `${client.city}${client.state ? ` - ${client.state}` : ''}` : 'Local não informado'}
                              </span>
                              {client.representative_name && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-sky-700 bg-sky-50 border border-sky-200/80 px-1.5 py-0.2 rounded font-medium mt-0.5">
                                  <span>💼 Rep:</span>
                                  <strong>{client.representative_name}</strong>
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-slate-700 font-medium">
                              {client.contact_name}
                            </td>

                            <td className="py-3.5 px-4">
                              {cleanPhone ? (
                                <a
                                  href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                                    `Olá ${client.contact_name}! Aqui é da Zeiq Sports.`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{client.phone}</span>
                                </a>
                              ) : (
                                <span className="text-slate-400 italic">Não informado</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 font-mono text-slate-600">
                              {client.email}
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              {isMaster ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-zinc-950 text-amber-300 border border-amber-500/40 shadow-xs">
                                  <span>👑</span>
                                  <span>Master</span>
                                </span>
                              ) : client.role === 'admin' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                  <span>🛡️</span>
                                  <span>Administrador</span>
                                </span>
                              ) : client.role === 'representative' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-900 border border-sky-200">
                                  <span>💼</span>
                                  <span>Representante</span>
                                </span>
                              ) : client.role === 'stock' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200">
                                  <span>📦</span>
                                  <span>Estoque</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  <span>🏪</span>
                                  <span>Lojista B2B</span>
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              {client.is_approved ? (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  Ativo
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300">
                                  <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>Aguardando Aprovação</span>
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-center text-slate-500">
                              {client.created_at
                                ? new Date(client.created_at).toLocaleDateString('pt-BR')
                                : 'Recente'}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Botão de Aprovação Imediata */}
                                {!client.is_approved && (
                                  <button
                                    type="button"
                                    onClick={() => handleQuickApproveClient(client)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                                    title="Aprovar credenciamento deste lojista imediatamente"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Aprovar</span>
                                  </button>
                                )}

                                {/* Botão de Edição Completa */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditUserModal(client)}
                                  className="p-1.5 text-slate-500 hover:text-zeiq-black hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                  title="Editar informações cadastrais e permissões"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>

                                {/* Botão de Exclusão (protege a conta master e membros da equipe contra representantes) */}
                                {!isMaster && !(isCurrentUserRepresentative && client.role !== 'reseller') && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteClient(client)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title={client.role !== 'reseller' ? 'Remover membro da equipe' : 'Remover acesso do lojista'}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}

                                {isMaster && (
                                  <span className="p-1 text-amber-500" title="Conta Master protegida contra exclusão">
                                    <Lock className="w-3.5 h-3.5 inline opacity-70" />
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA 4: CONFIGURAÇÃO DE CATEGORIAS E LINHAS ESPORTIVAS   */}
        {/* ======================================================== */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            {/* Métricas de Categorias e Linhas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Categorias</p>
                <h3 className="text-xl sm:text-2xl font-black text-zeiq-black mt-1">{categories.length}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Seções ativas no catálogo</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Linhas Esportivas Ativas</p>
                <h3 className="text-xl sm:text-2xl font-black text-zeiq-orange mt-1">{departments.length}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Departamentos no menu do site</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Produtos Distribuídos</p>
                <h3 className="text-xl sm:text-2xl font-black text-zeiq-black mt-1">{products.length}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Catálogo completo vinculado</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Lançamentos</p>
                <h3 className="text-xl sm:text-2xl font-black text-amber-600 mt-1">
                  {products.filter((p) => p.tags?.some((t) => t.toLowerCase().includes('lança')) || p.is_featured).length}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Novidades 2026</p>
              </div>
            </div>

            {/* SEÇÃO 1: GERENCIAMENTO DE LINHAS ESPORTIVAS (DEPARTAMENTOS) */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-zeiq-black flex items-center gap-2">
                    <Layers className="w-4 h-4 text-zeiq-orange" />
                    <span>Linhas Esportivas & Departamentos do Menu</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Macro-departamentos que estruturam o menu superior e o catálogo (ex: Equipamentos, Masculino, Feminino, Acessórios).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenDeptModal(null)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-zeiq-orange hover:bg-zeiq-orange-hover text-zeiq-black font-extrabold text-xs rounded-xl transition-all shadow-xs shrink-0 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Linha Esportiva</span>
                </button>
              </div>

              {/* Grid Compacto & Escalável de Linhas Esportivas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {departments.map((dept) => {
                  const assignedCount = categories.filter((c) =>
                    dept.categoryNames.some((n) => n.toLowerCase() === c.name.toLowerCase())
                  ).length;
                  const isDefault = ['equipamentos', 'vestuario-masculino', 'vestuario-feminino', 'vestuario-infantil', 'acessorios'].includes(dept.id);
                  const isFiltered = selectedDeptFilter === dept.id;

                  return (
                    <div
                      key={dept.id}
                      className={`p-3 rounded-xl border-2 transition-all flex flex-col justify-between gap-2 ${
                        isFiltered
                          ? 'bg-white border-zeiq-black shadow-xs'
                          : 'bg-[#f8f9fa] border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-xs text-zeiq-black block truncate" title={dept.name}>
                            {dept.name}
                          </span>
                          <span className="text-xs text-slate-500 font-medium block mt-0.5">
                            Botão: <strong className="text-zeiq-black">{dept.shortName}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Botão de Edição para qualquer linha */}
                          <button
                            type="button"
                            onClick={() => handleOpenDeptModal(dept)}
                            className="p-1.5 text-slate-500 hover:text-zeiq-black hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200"
                            title={`Editar nome e atalho da linha "${dept.name}"`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Botão de Excluir para qualquer linha */}
                          <button
                            type="button"
                            onClick={() => handleDeleteDepartment(dept)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title={`Excluir linha "${dept.name}"`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 text-xs">
                        <button
                          type="button"
                          onClick={() => setSelectedDeptFilter(isFiltered ? 'all' : dept.id)}
                          className="font-mono font-bold text-xs text-slate-600 hover:text-zeiq-black flex items-center gap-1 transition-colors"
                          title="Clique para filtrar as categorias desta linha abaixo"
                        >
                          <Filter className={`w-3 h-3 ${isFiltered ? 'text-zeiq-orange' : 'text-slate-400'}`} />
                          <span>{assignedCount} {assignedCount === 1 ? 'categoria' : 'categorias'}</span>
                        </button>
                        <span className="text-xs font-mono text-slate-400 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                          #{dept.id}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SEÇÃO 2: TABELA DE CATEGORIAS */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-zeiq-black">Categorias & Subcategorias do Catálogo</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Divisões de produtos do catálogo. Para renomear ou trocar a linha esportiva vinculada, clique no ícone de lápis.
                  </p>
                </div>

                <button
                  onClick={() => handleOpenCategoryModal(null)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Nova Categoria
                </button>
              </div>

              {/* Barra de Filtro Rápido por Linha Esportiva */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedDeptFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    selectedDeptFilter === 'all'
                      ? 'bg-zeiq-black text-white shadow-xs'
                      : 'bg-[#f8f9fa] hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>Todas as Linhas</span>
                  <span className="text-xs opacity-80 font-mono">({categories.length})</span>
                </button>

                {departments.map((dept) => {
                  const count = categories.filter((c) =>
                    dept.categoryNames.some((n) => n.toLowerCase() === c.name.toLowerCase())
                  ).length;
                  const isSelected = selectedDeptFilter === dept.id;

                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => setSelectedDeptFilter(isSelected ? 'all' : dept.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-zeiq-black text-white shadow-xs'
                          : 'bg-[#f8f9fa] hover:bg-slate-200 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <span>{dept.shortName}</span>
                      <span className="text-xs opacity-80 font-mono">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Tabela de Categorias Limpa e Elegante */}
              <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[650px] text-left border-collapse">
                    <thead>
                      <tr className="bg-[#f8f9fa] border-b border-slate-200/80 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4 w-16 text-center">Ordem</th>
                        <th className="py-3 px-4">Nome da Categoria</th>
                        <th className="py-3 px-4">Linha Esportiva Vinculada</th>
                        <th className="py-3 px-4">Slug (URL)</th>
                        <th className="py-3 px-4 text-center">Produtos Vinculados</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {displayedCategories.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            Nenhuma categoria encontrada nesta linha esportiva.
                          </td>
                        </tr>
                      ) : (
                        displayedCategories.map((cat: any) => {
                          const currentDept = findDepartmentForCategory(cat.name, departments);

                          return (
                            <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4 text-center font-bold text-slate-500 font-mono">
                                #{cat.display_order ?? 0}
                              </td>

                              <td className="py-3 px-4">
                                <strong className="text-zeiq-black text-sm block">{cat.name}</strong>
                              </td>

                              <td className="py-3 px-4">
                                {currentDept ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-zeiq-orange shrink-0" />
                                    <span>{currentDept.name}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                    <span>Sem linha definida</span>
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-4 font-mono text-slate-500">
                                /{cat.slug}
                              </td>

                              <td className="py-3 px-4 text-center">
                                <span className="px-2.5 py-1 bg-slate-100 rounded-full font-bold text-slate-700">
                                  {cat.product_count ?? 0} produtos
                                </span>
                              </td>

                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCategoryModal(cat)}
                                    className="p-1.5 text-slate-500 hover:text-zeiq-black hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Editar Categoria e Linha Esportiva"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCategory(cat)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    title="Excluir Categoria"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA 5: GESTÃO DE BANNERS DA HOME (ATÉ 5 BANNERS)        */}
        {/* ======================================================== */}
        {activeTab === 'banners' && (
          <div className="space-y-6">
            {/* Cabeçalho da Aba */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-base sm:text-lg font-black text-zeiq-black tracking-tight flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-zeiq-orange" />
                    <span>Banners da Página Inicial</span>
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                    {banners.length} de 5 banners
                  </span>
                </div>
                <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                  Cadastre e ordene até 5 banners para o carrossel principal. O cliente será redirecionado para o link configurado ao clicar no banner.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                {banners.length < 5 && (
                  <button
                    type="button"
                    onClick={handleAddBanner}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-zeiq-black border border-slate-300 text-xs font-bold transition-all shadow-2xs active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar Banner</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSaveBanners}
                  disabled={savingBanners}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zeiq-black hover:bg-zeiq-charcoal text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 active:scale-95"
                >
                  {savingBanners ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Salvar Banners</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Lista de Banners ou Estado Vazio */}
            {banners.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-12 text-center shadow-xs">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-zeiq-black mb-1">Nenhum banner cadastrado</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                  Adicione banners promocionais para compor o carrossel dinâmico da página inicial.
                </p>
                <button
                  type="button"
                  onClick={handleAddBanner}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zeiq-black text-white text-xs font-bold shadow-xs active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Primeiro Banner</span>
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {banners.map((banner, index) => {
                  const isUploadingDesktop = uploadingBannerIndex?.index === index && uploadingBannerIndex?.type === 'desktop';
                  const isUploadingMobile = uploadingBannerIndex?.index === index && uploadingBannerIndex?.type === 'mobile';

                  return (
                    <div
                      key={banner.id}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all hover:border-slate-300"
                    >
                      {/* Topo do Card de Banner */}
                      <div className="bg-[#f8f9fa] border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-zeiq-black text-white font-mono font-black text-xs flex items-center justify-center shrink-0">
                            #{index + 1}
                          </span>
                          <input
                            type="text"
                            value={banner.title || ''}
                            onChange={(e) => handleUpdateBanner(index, 'title', e.target.value)}
                            placeholder="Título do banner (identificação)"
                            className="text-xs sm:text-sm font-bold text-zeiq-black bg-transparent border-b border-transparent hover:border-slate-300 focus:border-zeiq-black focus:outline-none px-1 py-0.5"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer mr-2 select-none">
                            <input
                              type="checkbox"
                              checked={banner.isActive !== false}
                              onChange={(e) => handleUpdateBanner(index, 'isActive', e.target.checked)}
                              className="rounded border-slate-300 text-zeiq-black focus:ring-zeiq-black"
                            />
                            <span>{banner.isActive !== false ? 'Visível' : 'Pausado'}</span>
                          </label>

                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveBanner(index, 'up')}
                            className="p-1.5 text-slate-500 hover:text-zeiq-black disabled:opacity-30 disabled:hover:text-slate-500 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors"
                            title="Mover para cima"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={index === banners.length - 1}
                            onClick={() => handleMoveBanner(index, 'down')}
                            className="p-1.5 text-slate-500 hover:text-zeiq-black disabled:opacity-30 disabled:hover:text-slate-500 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-colors"
                            title="Mover para baixo"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveBanner(index)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
                            title="Remover este banner"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Corpo: Imagens Desktop & Mobile */}
                      <div className="p-4 sm:p-6 space-y-5">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                          
                          {/* Imagem Desktop */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-zeiq-black flex items-center gap-1.5">
                                <span>Imagem Desktop (Widescreen)</span>
                              </label>
                              <span className="text-xs text-slate-400 font-medium">Recomendado: ~1720x430 px</span>
                            </div>

                            <div className="relative aspect-[16/4.5] w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center group">
                              {banner.desktopImage ? (
                                <img
                                  src={banner.desktopImage}
                                  alt="Prévia Desktop"
                                  className="w-full h-full object-cover object-center"
                                />
                              ) : (
                                <div className="text-center p-4 text-slate-400">
                                  <ImageIcon className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                                  <span className="text-xs">Nenhuma imagem selecionada</span>
                                </div>
                              )}

                              {isUploadingDesktop && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-bold gap-2">
                                  <Loader2 className="w-5 h-5 animate-spin text-zeiq-orange" />
                                  <span>Enviando imagem...</span>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-zeiq-black rounded-lg text-xs font-bold transition-colors shrink-0">
                                <Upload className="w-3.5 h-3.5" />
                                <span>Subir Arquivo</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleUploadBannerFile(index, 'desktop', file);
                                  }}
                                />
                              </label>
                              <input
                                type="text"
                                value={banner.desktopImage || ''}
                                onChange={(e) => handleUpdateBanner(index, 'desktopImage', e.target.value)}
                                placeholder="Ou cole a URL da imagem desktop..."
                                className="flex-1 px-3 py-2 text-base sm:text-xs bg-[#f8f9fa] border border-slate-200 rounded-lg text-zeiq-black font-mono focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                              />
                            </div>
                          </div>

                          {/* Imagem Mobile */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-zeiq-black flex items-center gap-1.5">
                                <span>Imagem Mobile (Celulares)</span>
                              </label>
                              <span className="text-xs text-slate-400 font-medium">Recomendado: ~800x600 px</span>
                            </div>

                            <div className="relative aspect-[16/6] w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center group">
                              {banner.mobileImage ? (
                                <img
                                  src={banner.mobileImage}
                                  alt="Prévia Mobile"
                                  className="w-full h-full object-cover object-center"
                                />
                              ) : (
                                <div className="text-center p-4 text-slate-400">
                                  <ImageIcon className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                                  <span className="text-xs">Nenhuma imagem selecionada</span>
                                </div>
                              )}

                              {isUploadingMobile && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-bold gap-2">
                                  <Loader2 className="w-5 h-5 animate-spin text-zeiq-orange" />
                                  <span>Enviando imagem...</span>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-zeiq-black rounded-lg text-xs font-bold transition-colors shrink-0">
                                <Upload className="w-3.5 h-3.5" />
                                <span>Subir Arquivo</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleUploadBannerFile(index, 'mobile', file);
                                  }}
                                />
                              </label>
                              <input
                                type="text"
                                value={banner.mobileImage || ''}
                                onChange={(e) => handleUpdateBanner(index, 'mobileImage', e.target.value)}
                                placeholder="Ou cole a URL da imagem mobile..."
                                className="flex-1 px-3 py-2 text-base sm:text-xs bg-[#f8f9fa] border border-slate-200 rounded-lg text-zeiq-black font-mono focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                              />
                            </div>
                          </div>

                        </div>

                        {/* Link / Destino Interativo do Banner */}
                        <div className="pt-3 border-t border-slate-100">
                          <BannerDestinationPicker
                            link={banner.link || ''}
                            onChange={(newLink) => handleUpdateBanner(index, 'link', newLink)}
                            products={products}
                            categories={categories}
                            departments={departments}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA 6: CONFIGURAÇÕES COMERCIAIS (WHATSAPP & E-MAIL)      */}
        {/* ======================================================== */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
              <h2 className="text-base sm:text-lg font-black text-zeiq-black tracking-tight flex items-center gap-2 mb-1">
                <Settings className="w-5 h-5 text-zeiq-orange" />
                <span>Configurações de Contato & Pedidos</span>
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Configure os canais diretos para onde as cotações, pedidos e dúvidas comerciais de revenda serão encaminhados.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 shadow-xs space-y-6">
              {/* WhatsApp Comercial */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zeiq-black flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-500" />
                  <span>WhatsApp Comercial para Recebimento de Pedidos</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    required
                    value={settings?.whatsappNumber || ''}
                    onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                    placeholder="Ex: 5516991667020 ou (16) 99166-7020"
                    className="flex-1 px-3.5 py-2.5 text-base sm:text-sm bg-[#f8f9fa] border border-slate-200 rounded-xl font-mono text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                  {settings?.whatsappNumber && (
                    <a
                      href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent('Olá! Teste de canal comercial Zeiq.')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Testar WhatsApp</span>
                    </a>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Insira com código do país e DDD (ex: 5516991667020). Quando o cliente clicar em &quot;Enviar Pedido no WhatsApp&quot; na gaveta de cotação ou no rodapé, a mensagem será aberta para este número.
                </p>
              </div>

              {/* E-mail Comercial */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zeiq-black flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-500" />
                  <span>E-mail Comercial de Atendimento</span>
                </label>
                <input
                  type="email"
                  required
                  value={settings?.contactEmail || ''}
                  onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                  placeholder="Ex: contato@zeiq.com.br"
                  className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
                <p className="text-xs text-slate-400">
                  E-mail exibido no rodapé do catálogo e no portal do revendedor.
                </p>
              </div>

              {/* Nome da Marca / Loja */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zeiq-black flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <span>Nome da Marca / Catálogo</span>
                </label>
                <input
                  type="text"
                  value={settings?.siteName || ''}
                  onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                  placeholder="Zeiq Sports"
                  className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
              </div>

              {/* Botão Salvar */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 active:scale-95"
                >
                  {savingSettings ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Salvar Configurações Comerciais</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA: GESTÃO DE REVENDEDORES (ADMIN MASTER)              */}
        {/* ======================================================== */}
        {activeTab === 'resellers' && isCurrentUserAdminOrMaster && (
          <div className="space-y-6">
            {/* Métricas dos Revendedores */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Revendedores</p>
                <h3 className="text-xl sm:text-2xl font-black text-zeiq-black mt-1">{adminResellers.length}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Equipe comercial cadastrada</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Revendedores Ativos</p>
                <h3 className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
                  {adminResellers.filter((r) => r.status === 'ativo').length}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Disponíveis no formulário</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Inativos</p>
                <h3 className="text-xl sm:text-2xl font-black text-slate-600 mt-1">
                  {adminResellers.filter((r) => r.status === 'inativo').length}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Pausados temporariamente</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-xs font-bold text-sky-600 uppercase tracking-wider">Lojistas Vinculados</p>
                <h3 className="text-xl sm:text-2xl font-black text-sky-600 mt-1">
                  {adminResellers.reduce((sum, r) => sum + (r.customers_count || 0), 0)}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Em carteiras comerciais</p>
              </div>
            </div>

            {/* Barra de Ações e Filtro de Revendedores */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={resellerSearch}
                  onChange={(e) => setResellerSearch(e.target.value)}
                  placeholder="Pesquisar por nome, email ou WhatsApp..."
                  className="w-full pl-10 pr-4 py-2.5 text-base sm:text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
              </div>

              <button
                type="button"
                onClick={handleOpenCreateResellerModal}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-zeiq-black hover:bg-zeiq-charcoal active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4 text-zeiq-orange" />
                <span>Cadastrar Revendedor</span>
              </button>
            </div>

            {/* Tabela de Revendedores */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b border-slate-200/80 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Nome do Revendedor</th>
                      <th className="py-3 px-4">WhatsApp (Envio de Pedidos)</th>
                      <th className="py-3 px-4">E-mail (Login/Fallback)</th>
                      <th className="py-3 px-4 text-center">Notificação</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Carteira</th>
                      <th className="py-3 px-4 text-center">Pedidos</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredResellers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <Briefcase className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          <p className="font-semibold text-slate-600">Nenhum revendedor cadastrado.</p>
                          <p className="text-xs text-slate-400 mt-1">
                            Clique em &quot;Cadastrar Revendedor&quot; para registrar os 10 revendedores comerciais da Zeiq.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredResellers.map((r) => {
                        const cleanWa = (r.whatsapp || '').replace(/\D/g, '');
                        return (
                          <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4">
                              <strong className="text-zeiq-black font-extrabold block text-sm">{r.name}</strong>
                              <span className="text-[10px] text-slate-400 font-mono">ID: {r.id.slice(0, 8)}...</span>
                            </td>

                            <td className="py-3.5 px-4 font-mono">
                              {cleanWa ? (
                                <a
                                  href={`https://wa.me/55${cleanWa.startsWith('55') ? cleanWa.slice(2) : cleanWa}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors"
                                  title="Testar Link de WhatsApp"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{r.whatsapp}</span>
                                </a>
                              ) : (
                                <span className="text-slate-400 italic">Não informado</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="text-slate-700 font-medium block">{r.email}</span>
                              {r.phone && <span className="text-[11px] text-slate-400 block">Tel: {r.phone}</span>}
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {r.notification_preference === 'whatsapp_only'
                                  ? 'WhatsApp'
                                  : r.notification_preference === 'email_only'
                                  ? 'E-mail'
                                  : 'Ambos'}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleResellerStatus(r)}
                                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                  r.status === 'ativo'
                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300'
                                }`}
                                title="Clique para alternar status"
                              >
                                {r.status === 'ativo' ? 'Ativo' : 'Inativo'}
                              </button>
                            </td>

                            <td className="py-3.5 px-4 text-center font-bold text-zeiq-black">
                              {r.customers_count || 0}
                            </td>

                            <td className="py-3.5 px-4 text-center font-bold text-zeiq-black">
                              {r.orders_count || 0}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditResellerModal(r)}
                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                  title="Editar Revendedor"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteReseller(r)}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                  title="Excluir Revendedor"
                                >
                                  <Trash2 className="w-4 h-4 text-rose-600" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ======================================================== */}
      {/* MODAL 1: CRIAÇÃO / EDIÇÃO DE PRODUTO (SEM BUGS)          */}
      {/* ======================================================== */}
      <ProductFormModal
        isOpen={isProductModalOpen}
        product={editingProduct}
        categories={categories}
        departments={departments}
        onClose={() => setIsProductModalOpen(false)}
        onSaved={fetchDashboardData}
      />

      {/* ======================================================== */}
      {/* MODAL: AJUSTE RÁPIDO DE ESTOQUE                         */}
      {/* ======================================================== */}
      {quickStockProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zeiq-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setQuickStockProduct(null)}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-zeiq-black rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-zeiq-black text-white flex items-center justify-center shrink-0">
                <Boxes className="w-4 h-4 text-zeiq-orange" />
              </div>
              <h3 className="text-base font-bold text-zeiq-black">
                Ajuste Rápido de Estoque
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 line-clamp-1">
              {quickStockProduct.name} {quickStockProduct.code_sku && `• SKU: ${quickStockProduct.code_sku}`}
            </p>

            {(() => {
              const parsed = parseProductSizes(quickStockProduct.description, quickStockProduct.sizes, quickStockProduct.name);
              const activeSizes = quickStockProduct.sizes && quickStockProduct.sizes.length > 0 ? quickStockProduct.sizes : parsed.sizes;
              const hasSizes = activeSizes.length > 0;
              const totalPieces = hasSizes
                ? activeSizes.reduce((sum, sz) => sum + (quickStockBySize[sz] || 0), 0)
                : quickDefaultStock;

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-700">Total em Estoque:</span>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      totalPieces > 0
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-rose-50 text-rose-800 border-rose-300'
                    }`}>
                      {totalPieces} unidades
                    </span>
                  </div>

                  {hasSizes ? (
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {activeSizes.map((sz) => {
                          const currentQty = quickStockBySize[sz] || 0;
                          return (
                            <div
                              key={sz}
                              className={`p-2.5 rounded-xl border transition-all ${
                                currentQty === 0
                                  ? 'bg-rose-50/50 border-rose-200'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-xs text-zeiq-black font-mono">
                                  {sz}
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  currentQty === 0
                                    ? 'bg-rose-100 text-rose-700'
                                    : currentQty <= 5
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {currentQty === 0 ? 'Esgotado' : `${currentQty} un.`}
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setQuickStockBySize((prev) => ({ ...prev, [sz]: Math.max(0, currentQty - 1) }))}
                                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  value={currentQty}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    setQuickStockBySize((prev) => ({ ...prev, [sz]: isNaN(val) ? 0 : Math.max(0, val) }));
                                  }}
                                  className="w-full text-center font-mono text-xs font-bold py-1 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                                />
                                <button
                                  type="button"
                                  onClick={() => setQuickStockBySize((prev) => ({ ...prev, [sz]: currentQty + 1 }))}
                                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">Quantidade geral:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQuickDefaultStock((prev) => Math.max(0, prev - 1))}
                          className="w-8 h-8 rounded-lg bg-white hover:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={quickDefaultStock}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setQuickDefaultStock(isNaN(val) ? 0 : Math.max(0, val));
                          }}
                          className="w-20 text-center font-mono text-sm font-bold py-1 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                        />
                        <button
                          type="button"
                          onClick={() => setQuickDefaultStock((prev) => prev + 1)}
                          className="w-8 h-8 rounded-lg bg-white hover:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickStockProduct(null)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveQuickStock}
                      disabled={savingQuickStock}
                      className="px-5 py-2 bg-zeiq-black hover:bg-zeiq-orange hover:text-zeiq-black text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {savingQuickStock ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        'Salvar Estoque'
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: DETALHES & GRADE DO PEDIDO                     */}
      {/* ======================================================== */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zeiq-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative border border-slate-200">
            <button
              onClick={() => setSelectedOrderDetails(null)}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-zeiq-black"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-200 pb-4 mb-4">
              <span className="text-xs font-mono font-bold text-zeiq-black block">
                Pedido #{selectedOrderDetails.order_number}
              </span>
              <p className="text-xs text-slate-500">
                Lojista: <strong>{selectedOrderDetails.buyer_company || selectedOrderDetails.buyer_name}</strong> • Total de peças: <strong>{selectedOrderDetails.total_pieces} un.</strong>
              </p>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {selectedOrderDetails.items?.map((it: QuoteItem, idx: number) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {it.coverImage ? (
                        <img src={it.coverImage} alt="" className="w-full h-full object-cover object-top" />
                      ) : (
                        <Package className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <strong className="text-zeiq-black block">{it.productName}</strong>
                      {it.sku && <span className="font-mono text-xs text-slate-500">SKU: {it.sku}</span>}
                      {it.sizeBreakdown && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(it.sizeBreakdown).map(([sz, qty]) => (
                            <span key={sz} className="px-1.5 py-0.2 bg-white border border-slate-200 rounded font-bold text-xs">
                              {sz}: {qty}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <strong className="text-sm font-bold text-zeiq-black shrink-0">
                    {it.quantity} un.
                  </strong>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-end">
              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="px-4 py-2 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-xl text-xs font-bold"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: ATUALIZAR RASTREAMENTO DO PEDIDO               */}
      {/* ======================================================== */}
      {trackingModalOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zeiq-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative border border-slate-200">
            <button
              onClick={() => setTrackingModalOrder(null)}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-zeiq-black"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold text-zeiq-black mb-1">
              Código de Rastreamento
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Pedido #{trackingModalOrder.order_number} ({trackingModalOrder.buyer_company || trackingModalOrder.buyer_name})
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Código de Rastreio (Transportadora ou Correios)
                </label>
                <input
                  type="text"
                  value={newTrackingCode}
                  onChange={(e) => setNewTrackingCode(e.target.value.toUpperCase())}
                  placeholder="Ex: JAD129840294 ou BR981249124JB"
                  className="w-full px-3 py-2 text-base sm:text-xs font-mono font-bold uppercase bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Link de Rastreio Direto (opcional)
                </label>
                <input
                  type="url"
                  value={newTrackingUrl}
                  onChange={(e) => setNewTrackingUrl(e.target.value)}
                  placeholder="https://rastreamento.correios.com.br/..."
                  className="w-full px-3 py-2 text-base sm:text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTrackingModalOrder(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-zeiq-black"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveTracking}
                  disabled={savingTracking}
                  className="px-4 py-2 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  {savingTracking ? 'Salvando...' : 'Salvar Rastreio'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: CRIAÇÃO / EDIÇÃO DE CATEGORIA                  */}
      {/* ======================================================== */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zeiq-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative border border-slate-200">
            <button
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-zeiq-black"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold text-zeiq-black mb-1">
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Configure o nome, o link e vincule à linha esportiva correspondente.
            </p>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              {categoryError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                  {categoryError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={(e) => {
                    setCategoryName(e.target.value);
                    if (!editingCategory) {
                      setCategorySlug(
                        e.target.value
                          .toLowerCase()
                          .normalize('NFD')
                          .replace(/[\u0300-\u036f]/g, '')
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-+|-+$/g, '')
                      );
                    }
                  }}
                  placeholder="Ex: Raquetes de Beach Tennis"
                  className="w-full px-3 py-2 text-base sm:text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Slug da URL
                  </label>
                  <input
                    type="text"
                    value={categorySlug}
                    onChange={(e) => setCategorySlug(e.target.value)}
                    placeholder="ex: raquetes-beach-tennis"
                    className="w-full px-3 py-2 text-base sm:text-xs font-mono bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ordem de Exibição
                  </label>
                  <input
                    type="number"
                    value={categoryOrder}
                    onChange={(e) => setCategoryOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 text-base sm:text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                </div>
              </div>

              {/* SELEÇÃO VISUAL DA LINHA ESPORTIVA (FIM DO SELECT AZUL NATIVO) */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Linha Esportiva Vinculada *
                </label>
                <p className="text-xs text-slate-400">
                  Selecione o departamento onde esta categoria ficará agrupada no menu:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto no-scrollbar pt-1">
                  {departments.map((dept) => {
                    const isSelected = categoryDepartmentId === dept.id;

                    return (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => setCategoryDepartmentId(dept.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 active:scale-98 ${
                          isSelected
                            ? 'bg-zeiq-black text-white border-zeiq-black shadow-xs'
                            : 'bg-[#f8f9fa] hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className={`block text-xs font-bold leading-tight truncate ${
                            isSelected ? 'text-white' : 'text-zeiq-black'
                          }`}>
                            {dept.name}
                          </span>
                          <span className={`block text-xs mt-0.5 truncate ${
                            isSelected ? 'text-slate-300' : 'text-slate-400'
                          }`}>
                            Menu: {dept.shortName}
                          </span>
                        </div>

                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-zeiq-orange border-zeiq-orange text-zeiq-black'
                            : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-zeiq-black"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="px-4 py-2 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-xl text-xs font-bold disabled:opacity-50 active:scale-95 transition-all shadow-xs"
                >
                  {savingCategory ? 'Salvando...' : 'Salvar Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: CRIAÇÃO DE LINHA ESPORTIVA / DEPARTAMENTO      */}
      {/* ======================================================== */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zeiq-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative border border-slate-200">
            <button
              onClick={() => setIsDeptModalOpen(false)}
              className="absolute right-4 top-4 p-2 text-slate-400 hover:text-zeiq-black"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold text-zeiq-black mb-1">
              {editingDept ? 'Editar Linha Esportiva' : 'Nova Linha Esportiva / Departamento'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {editingDept
                ? `Editando linha "${editingDept.name}". O nome curto é usado nos botões do menu.`
                : 'Crie uma nova linha para o menu do site (ex: Corrida, Futvôlei, Treino & Fitness, Padel).'}
            </p>

            <form onSubmit={handleSaveDepartment} className="space-y-3.5">
              {deptError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                  {deptError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Completo da Linha *
                </label>
                <input
                  type="text"
                  required
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="Ex: Linha Corrida / Running"
                  className="w-full px-3 py-2 text-base sm:text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Curto para Botões do Menu
                </label>
                <input
                  type="text"
                  value={newDeptShortName}
                  onChange={(e) => setNewDeptShortName(e.target.value)}
                  placeholder="Ex: Corrida"
                  className="w-full px-3 py-2 text-base sm:text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-zeiq-black"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingDept}
                  className="px-4 py-2 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-xl text-xs font-bold disabled:opacity-50"
                >
                  {savingDept ? 'Salvando...' : editingDept ? 'Salvar Alterações' : 'Criar Linha Esportiva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: CADASTRO E EDIÇÃO DE LOJISTA / ADMINISTRADOR   */}
      {/* ======================================================== */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zeiq-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative border border-slate-200 animate-in fade-in zoom-in-95 my-8">
            <button
              type="button"
              onClick={() => setIsClientModalOpen(false)}
              className="absolute right-5 top-5 p-2 text-slate-400 hover:text-zeiq-black rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Cabeçalho do Modal */}
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                clientIsMaster
                  ? 'bg-zinc-950 text-amber-300 border-amber-500/40'
                  : clientRole === 'admin'
                  ? 'bg-amber-50 text-amber-600 border-amber-200'
                  : clientRole === 'representative'
                  ? 'bg-sky-50 text-sky-600 border-sky-200'
                  : clientRole === 'stock'
                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                  : 'bg-emerald-50 text-emerald-600 border-emerald-200'
              }`}>
                {clientIsMaster ? (
                  <span className="text-xl">👑</span>
                ) : clientRole === 'admin' ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : clientRole === 'representative' ? (
                  <Briefcase className="w-5 h-5" />
                ) : clientRole === 'stock' ? (
                  <Boxes className="w-5 h-5" />
                ) : (
                  <Building2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-zeiq-black leading-tight">
                  {clientModalMode === 'create'
                    ? (clientRole === 'admin'
                        ? 'Cadastrar Novo Administrador'
                        : clientRole === 'representative'
                        ? 'Cadastrar Representante Comercial'
                        : clientRole === 'stock'
                        ? 'Cadastrar Membro de Estoque'
                        : 'Cadastrar Novo Lojista B2B')
                    : (clientIsMaster
                        ? 'Administrador Master Zeiq'
                        : clientRole === 'admin'
                        ? 'Editar Administrador'
                        : clientRole === 'representative'
                        ? 'Editar Representante Comercial'
                        : clientRole === 'stock'
                        ? 'Editar Membro do Estoque'
                        : 'Editar Lojista B2B')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {clientModalMode === 'create'
                    ? 'Defina os dados de cadastro e permissões de acesso ao sistema.'
                    : 'Atualize os dados cadastrais, cargo de acesso e status da conta.'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveClient} className="space-y-4">
              {clientError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                  <span>{clientError}</span>
                </div>
              )}

              {/* Seletor de Tipo de Acesso / Papel */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Tipo de Conta & Permissão de Acesso *
                </label>
                {clientIsMaster ? (
                  <div className="p-3.5 bg-zinc-950 text-white rounded-2xl border border-amber-500/40 flex items-center justify-between text-xs shadow-md">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">👑</span>
                      <div>
                        <strong className="block text-amber-300 font-black text-sm">Administrador Master Zeiq</strong>
                        <span className="text-xs text-zinc-400">Conta proprietária com privilégios irrestritos e permanente.</span>
                      </div>
                    </div>
                  </div>
                ) : isCurrentUserRepresentative ? (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <strong className="block font-bold text-zeiq-black">Lojista B2B</strong>
                    <span className="text-slate-500">Este lojista pertencerá à sua carteira de representação comercial.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* 1. Lojista B2B */}
                    <button
                      type="button"
                      onClick={() => setClientRole('reseller')}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        clientRole === 'reseller'
                          ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-[#f8f9fa] hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                          🏪 Lojista B2B
                        </span>
                        {clientRole === 'reseller' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-tight">
                        Acesso exclusivo ao catálogo e cotações. Bloqueado neste painel.
                      </p>
                    </button>

                    {/* 2. Representante Comercial */}
                    <button
                      type="button"
                      onClick={() => setClientRole('representative')}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        clientRole === 'representative'
                          ? 'border-sky-500 bg-sky-50/70 ring-2 ring-sky-500/20'
                          : 'border-slate-200 bg-[#f8f9fa] hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-sky-600" />
                          💼 Representante Comercial
                        </span>
                        {clientRole === 'representative' && <Check className="w-3.5 h-3.5 text-sky-600" />}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-tight">
                        Administra seus lojistas, aprova cadastros e recebe pedidos no WhatsApp.
                      </p>
                    </button>

                    {/* 3. Controle de Estoque */}
                    <button
                      type="button"
                      onClick={() => setClientRole('stock')}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        clientRole === 'stock'
                          ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20'
                          : 'border-slate-200 bg-[#f8f9fa] hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                          <Boxes className="w-3.5 h-3.5 text-blue-600" />
                          📦 Controle de Estoque
                        </span>
                        {clientRole === 'stock' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-tight">
                        Altera estoque, preços, produtos e banners. Sem acesso a pedidos ou clientes.
                      </p>
                    </button>

                    {/* 4. Administrador */}
                    <button
                      type="button"
                      disabled={!isCurrentUserMaster && clientRole !== 'admin'}
                      onClick={() => setClientRole('admin')}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                        clientRole === 'admin'
                          ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20 cursor-pointer'
                          : !isCurrentUserMaster
                          ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                          : 'border-slate-200 bg-[#f8f9fa] hover:bg-slate-100 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                          🛡️ Administrador
                        </span>
                        {clientRole === 'admin' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                        {!isCurrentUserMaster && clientRole !== 'admin' && (
                          <span className="text-[10px] text-slate-400 font-mono">Apenas Master</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-tight">
                        Acesso completo ao painel, clientes, pedidos e equipe.
                      </p>
                    </button>
                  </div>
                )}
              </div>

              {/* Se for Lojista B2B, exibe campo de vinculação ao Representante Comercial */}
              {clientRole === 'reseller' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Representante Comercial Vinculado</span>
                    {isCurrentUserRepresentative && (
                      <span className="text-[10px] text-sky-700 font-medium">Vinculado a você</span>
                    )}
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={clientRepresentativeId}
                      onChange={(e) => setClientRepresentativeId(e.target.value)}
                      disabled={isCurrentUserRepresentative}
                      className="w-full pl-9 pr-8 py-2 text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black appearance-none disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                      <option value="">Nenhum representante (Atendimento Direto Zeiq)</option>
                      {clients
                        .filter((c) => c.role === 'representative')
                        .map((rep) => (
                          <option key={rep.id} value={rep.id}>
                            {rep.contact_name || rep.store_name} ({rep.phone || rep.email})
                          </option>
                        ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Status da Conta (Aprovado / Aguardando Aprovação) */}
              {clientModalMode === 'edit' && !clientIsMaster && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <strong className="block text-xs font-semibold text-slate-800">Status do Acesso B2B</strong>
                    <span className="text-xs text-slate-500">
                      {clientApproved ? 'Conta ativa e liberada para login.' : 'Acesso aguardando aprovação ou bloqueado.'}
                    </span>
                  </div>
                  <div className="inline-flex rounded-lg p-0.5 bg-slate-200">
                    <button
                      type="button"
                      onClick={() => setClientApproved(true)}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        clientApproved ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      Aprovado
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientApproved(false)}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        !clientApproved ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      Aguardando
                    </button>
                  </div>
                </div>
              )}

              {/* Dados Cadastrais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {clientRole === 'admin' ? 'Identificação / Setor *' : 'Nome da Loja / Arena *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newClientStore}
                    onChange={(e) => setNewClientStore(e.target.value)}
                    placeholder={clientRole === 'admin' ? 'Ex: Equipe Comercial Zeiq' : 'Ex: Arena Beach Point'}
                    className="w-full px-3.5 py-2 text-sm bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome do Responsável *
                  </label>
                  <input
                    type="text"
                    required
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Ex: Carlos Silva"
                    className="w-full px-3.5 py-2 text-sm bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    WhatsApp com DDD *
                  </label>
                  <input
                    type="tel"
                    required
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="Ex: 16 99123-4567"
                    className="w-full px-3.5 py-2 text-sm bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CNPJ ou CPF (Opcional)
                  </label>
                  <input
                    type="text"
                    value={newClientCnpj}
                    onChange={(e) => setNewClientCnpj(e.target.value)}
                    placeholder="Ex: 00.000.000/0001-00"
                    className="w-full px-3.5 py-2 text-sm bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3.5">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={newClientCity}
                    onChange={(e) => setNewClientCity(e.target.value)}
                    placeholder="Ex: Ribeirão Preto"
                    className="w-full px-3.5 py-2 text-sm bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    UF
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={newClientState}
                    onChange={(e) => setNewClientState(e.target.value.toUpperCase())}
                    placeholder="SP"
                    className="w-full px-3.5 py-2 text-sm uppercase bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black text-center font-bold"
                  />
                </div>
              </div>

              {/* Credenciais de Acesso */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Credenciais de Login ({clientRole === 'admin' ? 'Painel Administrativo' : 'Catálogo do Site'})
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail de Acesso *
                  </label>
                  <input
                    type="email"
                    required
                    disabled={clientModalMode === 'edit'}
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    placeholder="usuario@zeiq.com.br"
                    className={`w-full px-3.5 py-2 text-sm border rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black ${
                      clientModalMode === 'edit'
                        ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                        : 'bg-[#f8f9fa] border-slate-200'
                    }`}
                  />
                  {clientModalMode === 'edit' && (
                    <span className="text-xs text-slate-400 mt-1 block">
                      O e-mail é a chave de login. Para alterá-lo, crie um novo cadastro.
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>
                      {clientModalMode === 'create' ? 'Senha Inicial *' : 'Redefinir Senha (Opcional)'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const randomPwd = 'Zeiq@' + Math.floor(1000 + Math.random() * 9000);
                        setNewClientPassword(randomPwd);
                      }}
                      className="text-xs text-zeiq-orange hover:underline font-bold cursor-pointer"
                    >
                      Gerar Senha
                    </button>
                  </label>
                  <input
                    type="text"
                    required={clientModalMode === 'create'}
                    minLength={6}
                    value={newClientPassword}
                    onChange={(e) => setNewClientPassword(e.target.value)}
                    placeholder={clientModalMode === 'create' ? 'Mínimo 6 caracteres' : 'Deixar em branco para manter a senha atual'}
                    className="w-full px-3.5 py-2 text-sm bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black font-mono text-xs"
                  />
                </div>
              </div>

              {/* Botões do Rodapé */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-zeiq-black rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingClient}
                  className="px-5 py-2.5 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all shadow-xs active:scale-95 cursor-pointer"
                >
                  {savingClient
                    ? (clientModalMode === 'create' ? 'Criando Conta...' : 'Salvando...')
                    : (clientModalMode === 'create'
                        ? (clientRole === 'admin' ? 'Cadastrar Administrador' : 'Cadastrar Lojista B2B')
                        : 'Salvar Alterações')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CADASTRO / EDIÇÃO DE REVENDEDOR (ADMIN MASTER)    */}
      {/* ======================================================== */}
      {resellerModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-zeiq-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl relative border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setResellerModalOpen(false)}
              className="absolute right-5 top-5 p-2 text-slate-400 hover:text-zeiq-black rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-zeiq-black text-white flex items-center justify-center shrink-0">
                <Briefcase className="w-4 h-4 text-zeiq-orange" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-zeiq-black">
                {editingReseller ? 'Editar Revendedor Comercial' : 'Cadastrar Novo Revendedor'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              O revendedor receberá os pedidos dos lojistas vinculados a ele diretamente no WhatsApp e/ou E-mail.
            </p>

            <form onSubmit={handleSaveReseller} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Completo do Revendedor *
                </label>
                <input
                  type="text"
                  required
                  value={resellerFormName}
                  onChange={(e) => setResellerFormName(e.target.value)}
                  placeholder="Ex: Carlos Eduardo de Lima"
                  className="w-full px-3.5 py-2 text-sm bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    WhatsApp para Pedidos *
                  </label>
                  <input
                    type="tel"
                    required
                    value={resellerFormWhatsapp}
                    onChange={(e) => setResellerFormWhatsapp(e.target.value)}
                    placeholder="Ex: 62999999999"
                    className="w-full px-3.5 py-2 text-sm bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black font-mono text-xs"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Apenas números com DDD (ex: 62999999999)</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail do Revendedor *
                  </label>
                  <input
                    type="email"
                    required
                    value={resellerFormEmail}
                    onChange={(e) => setResellerFormEmail(e.target.value)}
                    placeholder="revendedor@zeiq.com.br"
                    className="w-full px-3.5 py-2 text-sm bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Login no painel e fallback de pedidos</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telefone Secundário (Opcional)
                  </label>
                  <input
                    type="tel"
                    value={resellerFormPhone}
                    onChange={(e) => setResellerFormPhone(e.target.value)}
                    placeholder="Ex: 16 3333-4444"
                    className="w-full px-3.5 py-2 text-sm bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status do Revendedor
                  </label>
                  <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setResellerFormStatus('ativo')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        resellerFormStatus === 'ativo'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-zeiq-black'
                      }`}
                    >
                      Ativo
                    </button>
                    <button
                      type="button"
                      onClick={() => setResellerFormStatus('inativo')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        resellerFormStatus === 'inativo'
                          ? 'bg-slate-700 text-white shadow-xs'
                          : 'text-slate-600 hover:text-zeiq-black'
                      }`}
                    >
                      Inativo
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Preferência de Notificação de Pedidos
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'both', label: 'Ambos (WhatsApp + E-mail)' },
                    { key: 'whatsapp_only', label: 'Apenas WhatsApp' },
                    { key: 'email_only', label: 'Apenas E-mail' },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setResellerFormPref(p.key as any)}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all text-center cursor-pointer ${
                        resellerFormPref === p.key
                          ? 'bg-zeiq-black text-white border-zeiq-black shadow-xs'
                          : 'bg-[#f8f9fa] text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>{editingReseller ? 'Redefinir Senha do Painel (Opcional)' : 'Senha de Acesso ao Painel *'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const randomPwd = 'Zeiq@' + Math.floor(1000 + Math.random() * 9000);
                      setResellerFormPassword(randomPwd);
                    }}
                    className="text-xs text-zeiq-orange hover:underline font-bold cursor-pointer"
                  >
                    Gerar Senha
                  </button>
                </label>
                <input
                  type="text"
                  required={!editingReseller}
                  minLength={6}
                  value={resellerFormPassword}
                  onChange={(e) => setResellerFormPassword(e.target.value)}
                  placeholder={editingReseller ? 'Deixe em branco para manter a senha atual' : 'Senha para login em /revendedor/login (mínimo 6 dígitos)'}
                  className="w-full px-3.5 py-2 text-sm bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black font-mono text-xs"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResellerModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-zeiq-black rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingReseller}
                  className="px-5 py-2.5 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  {savingReseller ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 text-zeiq-orange" />
                      <span>{editingReseller ? 'Salvar Alterações' : 'Cadastrar Revendedor'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
