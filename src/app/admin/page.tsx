'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Package,
  CheckCircle,
  EyeOff,
  FolderTree,
  Plus,
  Search,
  Edit3,
  Trash2,
  LogOut,
  ArrowLeft,
  Loader2,
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
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Product, Category, Order, OrderStatus, QuoteItem, BannerItem, StoreSettings } from '@/types';
import { Department, DEFAULT_DEPARTMENTS, findDepartmentForCategory } from '@/lib/data/departments';
import { DEFAULT_BANNERS, DEFAULT_STORE_SETTINGS } from '@/lib/constants/store';
import { ProductFormModal } from '@/components/admin/ProductFormModal';

const ITEMS_PER_PAGE = 25;

export default function AdminDashboardPage() {
  const router = useRouter();

  // Estados Globais do Painel
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'banners' | 'settings' | 'users' | 'categories'>('products');

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
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Filtros - Pedidos
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');

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
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptShortName, setNewDeptShortName] = useState('');
  const [savingDept, setSavingDept] = useState(false);
  const [deptError, setDeptError] = useState('');

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Carrega todos os dados do painel
  const fetchDashboardData = async () => {
    try {
      const supabase = createClient();

      // Checa autenticação
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

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
    } catch (err) {
      console.error('Erro ao carregar dados do admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

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
      await supabase.from('products').update({ is_published: newStatus }).eq('id', product.id);
      showToast(`Produto "${product.name.slice(0, 24)}..." ${newStatus ? 'publicado' : 'ocultado'}.`);
    } catch (e) {
      console.error('Erro ao atualizar status do produto:', e);
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
      await supabase.from('products').update({ is_featured: newFeatured }).eq('id', product.id);
      showToast(`Destaque ${newFeatured ? 'ativado' : 'removido'}.`);
    } catch (e) {
      console.error('Erro ao atualizar destaque do produto:', e);
      fetchDashboardData();
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    const confirmDelete = window.confirm(`Deseja realmente excluir o produto "${product.name}"?`);
    if (!confirmDelete) return;

    try {
      const supabase = createClient();
      await supabase.from('products').delete().eq('id', product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      showToast('Produto excluído com sucesso.');
    } catch (err: any) {
      alert(`Falha ao excluir produto: ${err.message}`);
    }
  };

  // ==========================================
  // OPERAÇÕES DE PEDIDOS
  // ==========================================
  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );

    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Status do pedido atualizado para "${newStatus}".`);
      } else {
        showToast('Status atualizado localmente.');
      }
    } catch {
      showToast('Status atualizado.');
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

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) {
      setDeptError('Nome da linha esportiva é obrigatório.');
      return;
    }
    setSavingDept(true);
    setDeptError('');

    try {
      const res = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDeptName.trim(),
          shortName: newDeptShortName.trim() || newDeptName.trim(),
          categoryNames: [],
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setDeptError(data.error || 'Erro ao criar linha esportiva.');
      } else {
        showToast(`Linha "${newDeptName}" criada com sucesso!`);
        setIsDeptModalOpen(false);
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
    if (['equipamentos', 'vestuario-masculino', 'vestuario-feminino', 'acessorios'].includes(dept.id)) {
      alert('Departamentos padrão do sistema não podem ser excluídos. Você pode renomeá-los ou reatribuir categorias.');
      return;
    }
    const confirmDelete = window.confirm(`Deseja excluir a linha "${dept.name}"?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/admin/departments?id=${dept.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success && Array.isArray(data.departments)) {
        setDepartments(data.departments);
        showToast(`Linha "${dept.name}" excluída.`);
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
  // FILTRAGEM E PAGINAÇÃO
  // ==========================================
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
        (filterStatus === 'published' && p.is_published) ||
        (filterStatus === 'draft' && !p.is_published);

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [products, productSearch, filterCategory, filterStatus]);

  // Paginação dos produtos
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

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

      return matchesSearch && matchesStatus;
    });
  }, [orders, orderSearch, orderStatusFilter]);

  // Filtro de Clientes
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const q = clientSearch.toLowerCase();
      return (
        clientSearch === '' ||
        c.contact_name?.toLowerCase().includes(q) ||
        c.store_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(clientSearch)
      );
    });
  }, [clients, clientSearch]);

  const publishedCount = products.filter((p) => p.is_published).length;
  const draftCount = products.length - publishedCount;

  // Renderizador do Status Badge
  const renderStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Recebido</span>;
      case 'approved':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">Aprovado</span>;
      case 'processing':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">Em Separação</span>;
      case 'shipped':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">Despachado</span>;
      case 'delivered':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">Entregue</span>;
      case 'cancelled':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">Cancelado</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  // Se não estiver logado, exibe tela de login direto ou botão de 1 clique
  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-zeiq-black flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full bg-zeiq-dark border border-zeiq-charcoal rounded-3xl p-8 text-center shadow-2xl">
          <div className="relative h-8 w-28 mx-auto mb-4 brightness-0 invert flex items-center justify-center">
            <Image
              src="/images/logo-zeiq.png"
              alt="Zeiq"
              width={112}
              height={32}
              className="h-full w-auto object-contain"
            />
          </div>
          <h2 className="text-lg font-bold text-white mb-1">Painel Administrativo B2B</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Área restrita de gestão de catálogo, pedidos e revendedores.
          </p>
          <div className="space-y-3">
            <Link
              href="/admin/login"
              className="block w-full py-3 px-4 bg-zeiq-orange hover:bg-zeiq-orange-hover text-zeiq-black rounded-xl text-xs font-black transition-all shadow-md text-center cursor-pointer active:scale-95"
            >
              Entrar com E-mail e Senha
            </Link>
            <Link
              href="/"
              className="block w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all border border-white/10 text-center"
            >
              ← Voltar ao Catálogo Público
            </Link>
          </div>
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
              <span className="text-[10px] font-black bg-white/10 text-zeiq-orange border border-zeiq-orange/30 px-2 py-0.5 rounded uppercase tracking-wider">
                Painel B2B
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-white">
                {user?.email || 'Administrador'}
              </span>
              <span className="text-[10px] text-slate-400">
                Acesso Total • Gestão Master
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-rose-500/20 hover:text-rose-300 text-slate-300 rounded-lg text-xs font-semibold transition-colors border border-white/10"
              title="Sair do painel"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Barra de Navegação de Módulos (Tabs) */}
      <nav className="bg-white border-b border-zeiq-muted sticky top-16 sm:top-18 z-30 shadow-2xs">
        <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-10 flex items-center overflow-x-auto no-scrollbar gap-1 py-1.5">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'products'
                ? 'bg-zeiq-black text-white shadow-xs'
                : 'text-slate-600 hover:text-zeiq-black hover:bg-slate-100'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Catálogo de Produtos</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'products' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {products.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'orders'
                ? 'bg-zeiq-black text-white shadow-xs'
                : 'text-slate-600 hover:text-zeiq-black hover:bg-slate-100'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Pedidos & Cotações</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'orders' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {orders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('banners')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'banners'
                ? 'bg-zeiq-black text-white shadow-xs'
                : 'text-slate-600 hover:text-zeiq-black hover:bg-slate-100'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Banners da Home</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'banners' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {banners.length}/5
            </span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-zeiq-black text-white shadow-xs'
                : 'text-slate-600 hover:text-zeiq-black hover:bg-slate-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>WhatsApp & Contato</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-zeiq-black text-white shadow-xs'
                : 'text-slate-600 hover:text-zeiq-black hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Clientes & Lojistas</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'users' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {clients.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'categories'
                ? 'bg-zeiq-black text-white shadow-xs'
                : 'text-slate-600 hover:text-zeiq-black hover:bg-slate-100'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>Categorias do Catálogo</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'categories' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {categories.length}
            </span>
          </button>
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Produtos</p>
                    <h3 className="text-xl sm:text-2xl font-black text-zeiq-black">{products.length}</h3>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Publicados (Ativos)</p>
                    <h3 className="text-xl sm:text-2xl font-black text-emerald-600">{publishedCount}</h3>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <EyeOff className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rascunhos / Ocultos</p>
                    <h3 className="text-xl sm:text-2xl font-black text-amber-600">{draftCount}</h3>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                    <FolderTree className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Categorias Ativas</p>
                    <h3 className="text-xl sm:text-2xl font-black text-zeiq-black">{categories.length}</h3>
                  </div>
                </div>
              </div>
            </div>

            {/* Barra de Filtros e Busca de Produtos */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Pesquisar por nome ou SKU..."
                    className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                  {productSearch && (
                    <button
                      onClick={() => setProductSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-zeiq-black"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2.5 text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                >
                  <option value="all">Todas as Categorias ({categories.length})</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2.5 text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                >
                  <option value="all">Todos os Status</option>
                  <option value="published">Apenas Publicados</option>
                  <option value="draft">Apenas Ocultos</option>
                </select>
              </div>

              <button
                onClick={() => {
                  setEditingProduct(null);
                  setIsProductModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Novo Produto
              </button>
            </div>

            {/* Tabela de Produtos */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Imagem</th>
                      <th className="py-3 px-4">Produto & SKU</th>
                      <th className="py-3 px-4">Categorias</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Destaque</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {paginatedProducts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          Nenhum produto localizado com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      paginatedProducts.map((prod) => {
                        const cover = prod.images?.find((i) => i.is_cover)?.public_url || prod.images?.[0]?.public_url;
                        return (
                          <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <div className="w-12 h-12 rounded-lg bg-[#f8f9fa] border border-slate-200 overflow-hidden flex items-center justify-center p-0.5">
                                {cover ? (
                                  <img src={cover} alt="" className="w-full h-full object-contain mix-blend-multiply" />
                                ) : (
                                  <ImageIcon className="w-4 h-4 text-slate-300" />
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-4 max-w-sm">
                              <p className="font-bold text-zeiq-black line-clamp-1">{prod.name}</p>
                              {prod.code_sku && (
                                <span className="font-mono text-[10px] text-slate-500 font-semibold block mt-0.5">
                                  SKU: {prod.code_sku}
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {prod.categories && prod.categories.length > 0 ? (
                                  prod.categories.map((c) => (
                                    <span key={c.id} className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                      {c.name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">Sem categoria</span>
                                )}
                              </div>
                            </td>

                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleTogglePublished(prod)}
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors ${
                                  prod.is_published
                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                                }`}
                              >
                                {prod.is_published ? 'Publicado' : 'Oculto'}
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

              {/* Paginação Suave */}
              <div className="p-4 bg-[#f8f9fa] border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                <span>
                  Exibindo <strong>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong>–<strong>{Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)}</strong> de <strong>{filteredProducts.length}</strong> produtos
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700"
                    title="Página Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg font-bold text-zeiq-black">
                    Página {currentPage} de {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700"
                    title="Próxima Página"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
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
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Pedidos</p>
                <h3 className="text-xl sm:text-2xl font-black text-zeiq-black mt-1">{orders.length}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Todas as ordens de compra</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Em Andamento</p>
                <h3 className="text-xl sm:text-2xl font-black text-amber-600 mt-1">
                  {orders.filter((o) => ['pending', 'approved', 'processing', 'shipped'].includes(o.status)).length}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Pendentes ou em trânsito</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Entregues</p>
                <h3 className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
                  {orders.filter((o) => o.status === 'delivered').length}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Concluídos com sucesso</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Peças</p>
                <h3 className="text-xl sm:text-2xl font-black text-indigo-600 mt-1">
                  {orders.reduce((acc, o) => acc + (o.total_pieces || 0), 0)}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Grade física total</p>
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
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
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

            {/* Tabela de Pedidos */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
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
                              <span className="text-[10px] text-slate-400">
                                {new Date(order.created_at || '').toLocaleDateString('pt-BR')}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <strong className="text-zeiq-black block">
                                {order.buyer_company || order.buyer_name}
                              </strong>
                              {order.buyer_company && (
                                <span className="text-[10px] text-slate-500 block">
                                  Resp: {order.buyer_name}
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
                              <span className="text-[10px] text-slate-400 block">
                                ({order.items?.length || 0} modelos)
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <select
                                value={order.status}
                                onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as OrderStatus)}
                                className="px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 bg-white text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                              >
                                <option value="pending">Pendente (Recebido)</option>
                                <option value="approved">Aprovado</option>
                                <option value="processing">Em Separação</option>
                                <option value="shipped">Despachado</option>
                                <option value="delivered">Entregue</option>
                                <option value="cancelled">Cancelado</option>
                              </select>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
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
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ABA 3: CLIENTES & LOJISTAS CADASTRADOS                  */}
        {/* ======================================================== */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Métricas de Clientes */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Lojistas</p>
                <h3 className="text-xl sm:text-2xl font-black text-zeiq-black mt-1">{clients.length}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Contas cadastradas no portal</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Contas Ativas</p>
                <h3 className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
                  {clients.filter((c) => c.is_approved).length}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Revendedores autorizados</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Arenas & Lojas</p>
                <h3 className="text-xl sm:text-2xl font-black text-zeiq-black mt-1">
                  {clients.filter((c) => c.store_name).length}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Pontos de venda mapeados</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">E-mails Confirmados</p>
                <h3 className="text-xl sm:text-2xl font-black text-blue-600 mt-1">
                  {clients.filter((c) => c.email_confirmed).length}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Autenticação validada</p>
              </div>
            </div>

            {/* Busca de Clientes */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Pesquisar por loja, responsável ou e-mail..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
              </div>

              <span className="text-xs text-slate-500">
                Total de <strong>{filteredClients.length}</strong> lojistas listados
              </span>
            </div>

            {/* Tabela de Clientes */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Loja / Arena</th>
                      <th className="py-3 px-4">Responsável</th>
                      <th className="py-3 px-4">WhatsApp</th>
                      <th className="py-3 px-4">E-mail Cadastrado</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Data de Cadastro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredClients.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          Nenhum cliente ou revendedor localizado.
                        </td>
                      </tr>
                    ) : (
                      filteredClients.map((client) => {
                        const cleanPhone = (client.phone || '').replace(/\D/g, '');
                        return (
                          <tr key={client.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-4">
                              <strong className="text-zeiq-black block">{client.store_name}</strong>
                              {client.role === 'admin' && (
                                <span className="text-[9px] font-black uppercase text-zeiq-orange">
                                  Administrador
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-slate-700">
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
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Ativo
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right text-slate-500">
                              {client.created_at
                                ? new Date(client.created_at).toLocaleDateString('pt-BR')
                                : 'Recente'}
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
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Categorias</p>
                <h3 className="text-xl sm:text-2xl font-black text-zeiq-black mt-1">{categories.length}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Seções ativas no catálogo</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Linhas Esportivas Ativas</p>
                <h3 className="text-xl sm:text-2xl font-black text-zeiq-orange mt-1">{departments.length}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Departamentos no menu do site</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Produtos Distribuídos</p>
                <h3 className="text-xl sm:text-2xl font-black text-zeiq-black mt-1">{products.length}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Catálogo completo vinculado</p>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Lançamentos</p>
                <h3 className="text-xl sm:text-2xl font-black text-amber-600 mt-1">
                  {products.filter((p) => p.tags?.some((t) => t.toLowerCase().includes('lança')) || p.is_featured).length}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Novidades 2026</p>
              </div>
            </div>

            {/* SEÇÃO 1: GERENCIAMENTO DE LINHAS ESPORTIVAS (DEPARTAMENTOS) */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-zeiq-black flex items-center gap-2">
                    <Layers className="w-4 h-4 text-zeiq-orange" />
                    <span>Linhas Esportivas & Departamentos do Menu</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Estas são as linhas que aparecem no menu superior e no Mega-Menu do catálogo (ex: Equipamentos, Corrida, Futvôlei, Treino).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setNewDeptName('');
                    setNewDeptShortName('');
                    setDeptError('');
                    setIsDeptModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zeiq-orange hover:bg-zeiq-orange-hover text-zeiq-black font-extrabold text-xs rounded-xl transition-all shadow-xs shrink-0 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Linha Esportiva</span>
                </button>
              </div>

              {/* Cards das Linhas Ativas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {departments.map((dept) => {
                  const assignedCount = categories.filter((c) =>
                    dept.categoryNames.some((n) => n.toLowerCase() === c.name.toLowerCase())
                  ).length;
                  const isDefault = ['equipamentos', 'vestuario-masculino', 'vestuario-feminino', 'acessorios'].includes(dept.id);

                  return (
                    <div
                      key={dept.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-[#f8f9fa] flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-xs text-zeiq-black block leading-snug">
                            {dept.name}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            Menu curto: <strong>{dept.shortName}</strong>
                          </span>
                        </div>

                        {!isDefault && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDepartment(dept)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Excluir linha esportiva"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
                        <span className="font-mono text-slate-600">
                          {assignedCount} {assignedCount === 1 ? 'categoria' : 'categorias'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {isDefault ? 'Padrão' : 'Personalizado'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SEÇÃO 2: TABELA DE CATEGORIAS & VÍNCULO DE LINHAS */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-zeiq-black">Categorias & Subcategorias do Catálogo</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Vincule cada categoria à sua linha esportiva correspondente usando a coluna "Linha Esportiva".
                </p>
              </div>

              <button
                onClick={() => handleOpenCategoryModal(null)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Nova Categoria
              </button>
            </div>

            {/* Tabela de Categorias */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4 w-16 text-center">Ordem</th>
                      <th className="py-3 px-4">Nome da Categoria</th>
                      <th className="py-3 px-4">Linha Esportiva / Departamento</th>
                      <th className="py-3 px-4">Slug (URL)</th>
                      <th className="py-3 px-4 text-center">Produtos Vinculados</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {categories.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          Nenhuma categoria cadastrada.
                        </td>
                      </tr>
                    ) : (
                      categories.map((cat: any) => {
                        const currentDept = findDepartmentForCategory(cat.name, departments);
                        const assignedDeptId = currentDept ? currentDept.id : 'acessorios';

                        return (
                          <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 text-center font-bold text-slate-500">
                              #{cat.display_order ?? 0}
                            </td>

                            <td className="py-3 px-4">
                              <strong className="text-zeiq-black text-sm block">{cat.name}</strong>
                            </td>

                            <td className="py-3 px-4">
                              <select
                                value={assignedDeptId}
                                onChange={(e) => handleMoveCategoryToDepartment(cat.name, e.target.value)}
                                className="px-2.5 py-1 text-xs font-semibold bg-[#f8f9fa] border border-slate-200 rounded-lg text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                              >
                                {departments.map((dept) => (
                                  <option key={dept.id} value={dept.id}>
                                    {dept.name}
                                  </option>
                                ))}
                              </select>
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
                                  title="Editar Categoria"
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
        )}

      </main>

      {/* ======================================================== */}
      {/* MODAL 1: CRIAÇÃO / EDIÇÃO DE PRODUTO (SEM BUGS)          */}
      {/* ======================================================== */}
      <ProductFormModal
        isOpen={isProductModalOpen}
        product={editingProduct}
        categories={categories}
        onClose={() => setIsProductModalOpen(false)}
        onSaved={fetchDashboardData}
      />

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
                    <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center p-0.5 shrink-0">
                      {it.coverImage ? (
                        <img src={it.coverImage} alt="" className="w-full h-full object-contain mix-blend-multiply" />
                      ) : (
                        <Package className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <strong className="text-zeiq-black block">{it.productName}</strong>
                      {it.sku && <span className="font-mono text-[10px] text-slate-500">SKU: {it.sku}</span>}
                      {it.sizeBreakdown && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(it.sizeBreakdown).map(([sz, qty]) => (
                            <span key={sz} className="px-1.5 py-0.2 bg-white border border-slate-200 rounded font-bold text-[10px]">
                              {sz}: {qty}
                            </span>
                          ))}
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
                  Cadastre e ordene até 5 banners para o carrossel principal. O cliente será redirecionado para o link configurado ao clicar no banner (sem botões sobrepostos na arte).
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
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

            {/* Lista de Banners */}
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
                          value={banner.title}
                          onChange={(e) => handleUpdateBanner(index, 'title', e.target.value)}
                          placeholder="Título do banner (identificação)"
                          className="text-xs sm:text-sm font-bold text-zeiq-black bg-transparent border-b border-transparent hover:border-slate-300 focus:border-zeiq-black focus:outline-none px-1 py-0.5"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Toggle Ativo */}
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer mr-2 select-none">
                          <input
                            type="checkbox"
                            checked={banner.isActive !== false}
                            onChange={(e) => handleUpdateBanner(index, 'isActive', e.target.checked)}
                            className="rounded border-slate-300 text-zeiq-black focus:ring-zeiq-black"
                          />
                          <span>{banner.isActive !== false ? 'Visível' : 'Pausado'}</span>
                        </label>

                        {/* Mover Posição */}
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

                        {/* Remover */}
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
                            <span className="text-[10px] text-slate-400 font-medium">Recomendado: ~1720x430 px</span>
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
                                <span className="text-[11px]">Nenhuma imagem selecionada</span>
                              </div>
                            )}

                            {isUploadingDesktop && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-bold gap-2">
                                <Loader2 className="w-5 h-5 animate-spin text-zeiq-orange" />
                                <span>Enviando imagem...</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-zeiq-black rounded-lg text-xs font-bold transition-colors">
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
                              value={banner.desktopImage}
                              onChange={(e) => handleUpdateBanner(index, 'desktopImage', e.target.value)}
                              placeholder="Ou cole a URL da imagem desktop..."
                              className="flex-1 px-3 py-1.5 text-xs bg-[#f8f9fa] border border-slate-200 rounded-lg text-zeiq-black font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                            />
                          </div>
                        </div>

                        {/* Imagem Mobile */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-zeiq-black flex items-center gap-1.5">
                              <span>Imagem Mobile (Celulares)</span>
                            </label>
                            <span className="text-[10px] text-slate-400 font-medium">Recomendado: ~800x600 px</span>
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
                                <span className="text-[11px]">Nenhuma imagem selecionada</span>
                              </div>
                            )}

                            {isUploadingMobile && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-bold gap-2">
                                <Loader2 className="w-5 h-5 animate-spin text-zeiq-orange" />
                                <span>Enviando imagem...</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-zeiq-black rounded-lg text-xs font-bold transition-colors">
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
                              value={banner.mobileImage}
                              onChange={(e) => handleUpdateBanner(index, 'mobileImage', e.target.value)}
                              placeholder="Ou cole a URL da imagem mobile..."
                              className="flex-1 px-3 py-1.5 text-xs bg-[#f8f9fa] border border-slate-200 rounded-lg text-zeiq-black font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                            />
                          </div>
                        </div>

                      </div>

                      {/* Link de Destino do Banner */}
                      <div className="pt-3 border-t border-slate-100 space-y-2">
                        <label className="text-xs font-bold text-zeiq-black flex items-center justify-between">
                          <span>Link de Destino ao Clicar</span>
                          <span className="text-[10px] text-slate-400 font-normal">Ao tocar no banner, o cliente vai para este link</span>
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={banner.link || ''}
                            onChange={(e) => handleUpdateBanner(index, 'link', e.target.value)}
                            placeholder="Ex: ?search=Leo+Branco, ?dept=equipamentos&cat=raquetes, /portal ou https://..."
                            className="flex-1 px-3 py-2 text-xs bg-[#f8f9fa] border border-slate-200 rounded-lg text-zeiq-black font-mono focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                          />
                        </div>

                        {/* Atalhos Rápidos para Links Frequentes */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[10px] text-slate-400 font-medium mr-1">Atalhos rápidos:</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateBanner(index, 'link', '?search=Leo+Branco')}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          >
                            Coleção Leo Branco
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateBanner(index, 'link', '?dept=equipamentos&cat=raquetes')}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          >
                            Raquetes Beach Tennis
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateBanner(index, 'link', '?dept=lancamentos')}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          >
                            Lançamentos
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateBanner(index, 'link', '?dept=masculino')}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          >
                            Masculino
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateBanner(index, 'link', '?dept=feminino')}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          >
                            Feminino
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateBanner(index, 'link', '/portal')}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                          >
                            Meus Pedidos
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
                <div className="flex gap-2.5">
                  <input
                    type="text"
                    required
                    value={settings.whatsappNumber}
                    onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                    placeholder="Ex: 5516991667020 ou (16) 99166-7020"
                    className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-[#f8f9fa] border border-slate-200 rounded-xl font-mono text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                  />
                  {settings.whatsappNumber && (
                    <a
                      href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent('Olá! Teste de canal comercial Zeiq.')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Testar WhatsApp</span>
                    </a>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
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
                  value={settings.contactEmail}
                  onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                  placeholder="Ex: contato@zeiq.com.br"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
                <p className="text-[11px] text-slate-400">
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
                  value={settings.siteName || ''}
                  onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                  placeholder="Zeiq Sports"
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
              </div>

              {/* Botão Salvar */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 active:scale-95"
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
                  className="w-full px-3 py-2 text-xs font-mono font-bold uppercase bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
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
                  className="w-full px-3 py-2 text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative border border-slate-200">
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
              Configure o nome e a prioridade de ordenação no catálogo.
            </p>

            <form onSubmit={handleSaveCategory} className="space-y-3.5">
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
                  className="w-full px-3 py-2 text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Slug da URL
                </label>
                <input
                  type="text"
                  value={categorySlug}
                  onChange={(e) => setCategorySlug(e.target.value)}
                  placeholder="ex: raquetes-beach-tennis"
                  className="w-full px-3 py-2 text-xs font-mono bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ordem de Exibição (Número)
                </label>
                <input
                  type="number"
                  value={categoryOrder}
                  onChange={(e) => setCategoryOrder(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Linha Esportiva / Departamento
                </label>
                <select
                  value={categoryDepartmentId}
                  onChange={(e) => setCategoryDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
                >
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-zeiq-black"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="px-4 py-2 bg-zeiq-black hover:bg-zeiq-charcoal text-white rounded-xl text-xs font-bold disabled:opacity-50"
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
              Nova Linha Esportiva / Departamento
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Crie uma nova linha para o menu do site (ex: Corrida, Futvôlei, Treino & Fitness, Padel).
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
                  className="w-full px-3 py-2 text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
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
                  className="w-full px-3 py-2 text-xs bg-[#f8f9fa] border border-slate-200 rounded-xl text-zeiq-black focus:outline-none focus:ring-1 focus:ring-zeiq-black"
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
                  {savingDept ? 'Salvando...' : 'Criar Linha Esportiva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
