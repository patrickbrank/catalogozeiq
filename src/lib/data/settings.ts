import fs from 'fs';
import path from 'path';
import { unstable_cache, revalidateTag } from 'next/cache';
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

async function fetchStoreSettingsUncached(): Promise<StoreSettings> {
  // 1. Tenta carregar do Supabase Storage
  try {
    const supabase = getAdminSupabase();
    if (supabase) {
      const { data, error } = await supabase.storage.from('produtos').download('config/settings.json');
      if (!error && data) {
        const text = await data.text();
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') {
          return {
            ...DEFAULT_STORE_SETTINGS,
            ...parsed,
          };
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
        return {
          ...DEFAULT_STORE_SETTINGS,
          ...parsed,
        };
      }
    }
  } catch {}

  return DEFAULT_STORE_SETTINGS;
}

const getCachedStoreSettings = unstable_cache(
  async () => fetchStoreSettingsUncached(),
  ['zeiq-store-settings'],
  { revalidate: 300, tags: ['settings-config'] }
);

export async function getStoreSettings(): Promise<StoreSettings> {
  try {
    return await getCachedStoreSettings();
  } catch {
    return fetchStoreSettingsUncached();
  }
}

export async function saveStoreSettings(settings: Partial<StoreSettings>): Promise<StoreSettings> {
  const current = await fetchStoreSettingsUncached();
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
        cacheControl: '60',
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

  try {
    revalidateTag('settings-config');
  } catch {}

  return updated;
}
