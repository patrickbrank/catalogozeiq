import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { BannerItem } from '@/types';
import { DEFAULT_BANNERS } from '@/lib/constants/store';

export { DEFAULT_BANNERS };

function getLocalConfigPath() {
  return path.join(process.cwd(), 'dados', 'banners-config.json');
}

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let cachedBanners: { data: BannerItem[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 30 * 1000; // 30s cache

export async function getBanners(): Promise<BannerItem[]> {
  if (cachedBanners && Date.now() - cachedBanners.timestamp < CACHE_TTL_MS) {
    return cachedBanners.data;
  }

  // 1. Tenta carregar do Supabase Storage
  try {
    const supabase = getAdminSupabase();
    if (supabase) {
      const { data, error } = await supabase.storage.from('produtos').download('config/banners.json');
      if (!error && data) {
        const text = await data.text();
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedBanners = { data: parsed, timestamp: Date.now() };
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
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedBanners = { data: parsed, timestamp: Date.now() };
        return parsed;
      }
    }
  } catch {}

  return DEFAULT_BANNERS;
}

export async function saveBanners(banners: BannerItem[]): Promise<BannerItem[]> {
  // Limita estritamente a 5 banners no máximo
  const limited = banners.slice(0, 5).map((b, idx) => ({
    ...b,
    order: idx + 1,
  }));

  const jsonStr = JSON.stringify(limited, null, 2);

  // 1. Salva no Supabase Storage
  try {
    const supabase = getAdminSupabase();
    if (supabase) {
      await supabase.storage.from('produtos').upload('config/banners.json', Buffer.from(jsonStr, 'utf8'), {
        contentType: 'application/json',
        upsert: true,
      });
    }
  } catch (err) {
    console.warn('Erro ao salvar banners no Supabase Storage:', err);
  }

  // 2. Salva localmente
  try {
    const localPath = getLocalConfigPath();
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localPath, jsonStr, 'utf8');
  } catch (err) {
    console.warn('Erro ao salvar banners localmente:', err);
  }

  cachedBanners = { data: limited, timestamp: Date.now() };
  return limited;
}
