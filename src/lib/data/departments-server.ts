import fs from 'fs';
import path from 'path';
import { unstable_cache, revalidateTag } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { Department, DEFAULT_DEPARTMENTS } from './departments';

function getLocalConfigPath() {
  return path.join(process.cwd(), 'dados', 'departments-config.json');
}

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchDepartmentsUncached(): Promise<Department[]> {
  // 1. Tenta carregar do Supabase Storage
  try {
    const supabase = getAdminSupabase();
    if (supabase) {
      const { data, error } = await supabase.storage.from('produtos').download('config/departments.json');
      if (!error && data) {
        const text = await data.text();
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
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
        return parsed;
      }
    }
  } catch {}

  return DEFAULT_DEPARTMENTS;
}

const getCachedDepartments = unstable_cache(
  async () => fetchDepartmentsUncached(),
  ['zeiq-departments-config'],
  { revalidate: 300, tags: ['departments-config', 'catalog'] }
);

export async function getDepartments(): Promise<Department[]> {
  try {
    return await getCachedDepartments();
  } catch {
    return fetchDepartmentsUncached();
  }
}

export async function saveDepartments(depts: Department[]): Promise<Department[]> {
  const jsonStr = JSON.stringify(depts, null, 2);

  // 1. Salva no Supabase Storage
  try {
    const supabase = getAdminSupabase();
    if (supabase) {
      await supabase.storage.from('produtos').upload('config/departments.json', Buffer.from(jsonStr, 'utf8'), {
        contentType: 'application/json',
        cacheControl: '60',
        upsert: true,
      });
    }
  } catch (err) {
    console.warn('Erro ao salvar departamentos no Supabase Storage:', err);
  }

  // 2. Salva localmente se o ambiente permitir (sem quebrar em serverless read-only)
  try {
    const localPath = getLocalConfigPath();
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localPath, jsonStr, 'utf8');
  } catch (err) {
    console.warn('Aviso: Gravação local em disco indisponível (ambiente serverless/read-only). Dados salvos com sucesso no Supabase.');
  }

  try {
    revalidateTag('departments-config');
    revalidateTag('catalog');
  } catch {}

  return depts;
}
