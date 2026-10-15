import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { StoreSettings } from '@/types';
import { DEFAULT_STORE_SETTINGS } from '@/lib/constants/store';

export { DEFAULT_STORE_SETTINGS };

function getLocalConfigPath() {
  return path.join(process.cwd(), 'dados', 'settings-config.json');
}

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let cachedSettings: { data: StoreSettings; timestamp: number } | null = null;
const CACHE_TTL_MS = 30 * 1000; // 30s cache

export async function getStoreSettings(): Promise<StoreSettings> {
  if (cachedSettings && Date.now() - cachedSettings.timestamp < CACHE_TTL_MS) {
    return cachedSettings.data;
  }

  // 1. Tenta carregar do Supabase Storage
  try {
    const supabase = getAdminSupabase();
    if (supabase) {
      const { data, error } = await supabase.storage.from('produtos').download('config/settings.json');
      if (!error && data) {
        const text = await data.text();
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') {
          const finalSettings = {
            ...DEFAULT_STORE_SETTINGS,
            ...parsed,
          };
          cachedSettings = { data: finalSettings, timestamp: Date.now() };
          return finalSettings;
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
        const finalSettings = {
          ...DEFAULT_STORE_SETTINGS,
          ...parsed,
        };
        cachedSettings = { data: finalSettings, timestamp: Date.now() };
        return finalSettings;
      }
    }
  } catch {}

  return DEFAULT_STORE_SETTINGS;
}

export async function saveStoreSettings(settings: Partial<StoreSettings>): Promise<StoreSettings> {
  const current = await getStoreSettings();
  const updated: StoreSettings = {
    ...current,
    ...settings,
    whatsappNumber: settings.whatsappNumber ? settings.whatsappNumber.trim() : current.whatsappNumber,
    contactEmail: settings.contactEmail ? settings.contactEmail.trim() : current.contactEmail,
  };

  const jsonStr = JSON.stringify(updated, null, 2);

  // 1. Salva no Supabase Storage
  try {
    const supabase = getAdminSupabase();
    if (supabase) {
      await supabase.storage.from('produtos').upload('config/settings.json', Buffer.from(jsonStr, 'utf8'), {
        contentType: 'application/json',
        upsert: true,
      });
    }
  } catch (err) {
    console.warn('Erro ao salvar settings no Supabase Storage:', err);
  }

  // 2. Salva localmente
  try {
    const localPath = getLocalConfigPath();
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localPath, jsonStr, 'utf8');
  } catch (err) {
    console.warn('Erro ao salvar settings localmente:', err);
  }

  cachedSettings = { data: updated, timestamp: Date.now() };
  return updated;
}
