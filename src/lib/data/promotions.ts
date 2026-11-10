import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { Product } from '@/types';
import { cleanSkuKey } from '@/lib/utils/pricing';

export { cleanSkuKey };

export interface ProductPromotionConfig {
  promotional_price: number;
  promo_start_at?: string | null;
  promo_end_at?: string | null;
  updated_at?: string;
}

export type PromotionsMap = Record<string, ProductPromotionConfig>;

function getLocalConfigPath(): string {
  return path.join(process.cwd(), 'dados', 'promotions-config.json');
}

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let cachedPromotions: { data: PromotionsMap; timestamp: number } | null = null;
const CACHE_TTL_MS = 20 * 1000; // 20 segundos

export async function getPromotionsMap(): Promise<PromotionsMap> {
  if (cachedPromotions && Date.now() - cachedPromotions.timestamp < CACHE_TTL_MS) {
    return cachedPromotions.data;
  }

  // 1. Tenta carregar do Supabase Storage
  try {
    const supabase = getAdminSupabase();
    if (supabase) {
      const { data, error } = await supabase.storage.from('produtos').download('config/promotions.json');
      if (!error && data) {
        const text = await data.text();
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') {
          cachedPromotions = { data: parsed, timestamp: Date.now() };
          return parsed;
        }
      }
    }
  } catch {}

  // 2. Fallback: Arquivo local
  try {
    const localPath = getLocalConfigPath();
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        cachedPromotions = { data: parsed, timestamp: Date.now() };
        return parsed;
      }
    }
  } catch {}

  return {};
}

export async function savePromotionsMap(map: PromotionsMap): Promise<PromotionsMap> {
  const jsonStr = JSON.stringify(map, null, 2);

  // 1. Salva no Supabase Storage
  try {
    const supabase = getAdminSupabase();
    if (supabase) {
      await supabase.storage.from('produtos').upload('config/promotions.json', Buffer.from(jsonStr, 'utf8'), {
        contentType: 'application/json',
        upsert: true,
      });
    }
  } catch (err) {
    console.warn('Erro ao salvar promotions no Supabase Storage:', err);
  }

  // 2. Salva localmente
  try {
    const localPath = getLocalConfigPath();
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localPath, jsonStr, 'utf8');
  } catch (err) {
    console.warn('Erro ao salvar promotions localmente:', err);
  }

  cachedPromotions = { data: map, timestamp: Date.now() };
  return map;
}

export async function mergePromotionsIntoProducts(products: Product[]): Promise<Product[]> {
  const promoMap = await getPromotionsMap();
  if (!promoMap || Object.keys(promoMap).length === 0) {
    return products;
  }

  return products.map((p) => {
    // Se o produto já possui preço promocional gravado diretamente no banco
    if (p.promotional_price != null && p.promotional_price > 0) {
      return p;
    }

    // Busca por id ou sku no mapa
    const byId = promoMap[p.id];
    const bySku = p.code_sku ? promoMap[cleanSkuKey(p.code_sku)] : null;
    const promo = byId || bySku;

    if (promo && typeof promo.promotional_price === 'number' && promo.promotional_price > 0) {
      return {
        ...p,
        promotional_price: promo.promotional_price,
        promo_start_at: promo.promo_start_at || p.promo_start_at || null,
        promo_end_at: promo.promo_end_at || p.promo_end_at || null,
      };
    }

    return p;
  });
}
