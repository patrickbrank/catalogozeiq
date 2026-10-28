export interface Category {
  id: string;
  name: string;
  slug: string;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  legacy_url?: string;
  storage_path: string;
  public_url: string;
  sort_order: number;
  is_cover: boolean;
}

export interface ProductHighlight {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  legacy_id?: string;
  name: string;
  slug: string;
  code_sku?: string | null;
  ean?: string | null;
  description?: string | null;
  price?: number | null;
  original_price?: number | null;
  is_published: boolean;
  is_featured: boolean;
  display_order: number;
  tags: string[];
  sizes?: string[];
  highlights?: ProductHighlight[];
  stock_by_size?: Record<string, number> | null;
  total_stock?: number | null;
  created_at?: string;
  updated_at?: string;
  images?: ProductImage[];
  categories?: Category[];
}

export interface QuoteItem {
  productId: string;
  productName: string;
  productSlug: string;
  sku?: string | null;
  coverImage?: string;
  quantity: number;
  price?: number | null;
  selectedSize?: string;
  sizeBreakdown?: Record<string, number>; // Grade de atacado: { 'PP': 2, 'P': 4, 'M': 6, 'G': 4 }
  notes?: string;
}

export type OrderStatus = 'pending' | 'approved' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export type UserRole = 'master' | 'admin' | 'representative' | 'stock' | 'reseller' | 'ROLE_RESELLER';

export type NotificationPreference = 'whatsapp_only' | 'email_only' | 'both';

export type ResellerStatus = 'ativo' | 'inativo';

export interface Reseller {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  whatsapp: string; // Ex: 62999999999 - apenas números
  status: ResellerStatus; // 'ativo' | 'inativo'
  notification_preference: NotificationPreference; // 'whatsapp_only' | 'email_only' | 'both'
  user_id?: string | null;
  customers_count?: number;
  orders_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface RepresentativeSummary {
  id: string;
  contact_name?: string | null;
  store_name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  is_master?: boolean;
  store_name?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  cnpj_cpf?: string | null;
  city?: string | null;
  state?: string | null;
  avatar_url?: string | null;
  address?: string | null;
  cep?: string | null;
  reseller_id?: string | null;
  reseller?: Reseller | RepresentativeSummary | null;
  representative_id?: string | null;
  representative?: RepresentativeSummary | null;
  is_approved: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id?: string | null;
  user_id?: string | null;
  reseller_id?: string | null;
  reseller_name?: string | null;
  reseller_whatsapp?: string | null;
  reseller_email?: string | null;
  representative_id?: string | null;
  representative_name?: string | null;
  buyer_name: string;
  buyer_company?: string | null;
  buyer_phone: string;
  buyer_email?: string | null;
  status: OrderStatus;
  items: QuoteItem[];
  total_pieces: number;
  tracking_code?: string | null;
  tracking_url?: string | null;
  stock_deducted?: boolean | null;
  commercial_notes?: string | null;
  customer_notes?: string | null;
  notification_status?: 'pending' | 'sent' | 'failed' | 'fallback_ready' | null;
  notification_error?: string | null;
  whatsapp_notified_at?: string | null;
  email_notified_at?: string | null;
  whatsapp_share_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BannerItem {
  id: string;
  title: string;
  desktopImage: string;
  mobileImage: string;
  link?: string;
  isActive: boolean;
  order: number;
}

export interface StoreSettings {
  whatsappNumber: string;
  contactEmail: string;
  siteName?: string;
}

