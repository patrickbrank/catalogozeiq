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
  description?: string | null;
  is_published: boolean;
  is_featured: boolean;
  display_order: number;
  tags: string[];
  sizes?: string[];
  highlights?: ProductHighlight[];
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
  selectedSize?: string;
  sizeBreakdown?: Record<string, number>; // Grade de atacado: { 'PP': 2, 'P': 4, 'M': 6, 'G': 4 }
  notes?: string;
}

export type OrderStatus = 'pending' | 'approved' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'reseller';
  store_name?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  cnpj_cpf?: string | null;
  city?: string | null;
  state?: string | null;
  is_approved: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id?: string | null;
  buyer_name: string;
  buyer_company?: string | null;
  buyer_phone: string;
  buyer_email?: string | null;
  status: OrderStatus;
  items: QuoteItem[];
  total_pieces: number;
  tracking_code?: string | null;
  tracking_url?: string | null;
  commercial_notes?: string | null;
  customer_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}
