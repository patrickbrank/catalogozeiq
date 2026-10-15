import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { Product, Category } from '@/types';
import { Department, DEFAULT_DEPARTMENTS } from '@/lib/data/departments';

function getPublicSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function loadDepartmentsConfig(): Department[] {
  try {
    const configPath = path.join(process.cwd(), 'dados', 'departments-config.json');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_DEPARTMENTS;
}

// Cache em memória de alta performance (evita re-consultas redundantes)
let cachedCatalog: { products: Product[]; categories: Category[]; departments: Department[]; timestamp: number } | null = null;
let cachedLocalCSV: { products: Product[]; categories: Category[]; departments: Department[] } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 segundos em memória

function slugify(text: string) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function cleanProductDescription(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/<del>[^<]*<\/del>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseCSV(text: string): string[][] {
  const p: string[][] = [];
  let row = [''];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') { i++; }
      p.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') p.push(row);
  return p;
}

// Fallback que carrega diretamente do CSV local com cache em memória
export function getLocalCSVProducts(): { products: Product[]; categories: Category[]; departments: Department[] } {
  if (cachedLocalCSV) {
    return cachedLocalCSV;
  }
  const departments = loadDepartmentsConfig();
  try {
    const csvPath = path.join(process.cwd(), 'dados', 'wc-product-export-13-10-2026-1791938769430.csv');
    if (!fs.existsSync(csvPath)) {
      return { products: [], categories: [], departments };
    }

    const content = fs.readFileSync(csvPath, 'utf8');
    const rows = parseCSV(content);
    const header = rows[0];

    const colId = header.indexOf('ID') !== -1 ? header.indexOf('ID') : 0;
    const colName = header.indexOf('Nome');
    const colPublished = header.indexOf('Publicado');
    const colFeatured = header.indexOf('Em destaque?');
    const colShortDesc = header.indexOf('Descrição curta');
    const colDesc = header.indexOf('Descrição');
    const colCategories = header.indexOf('Categorias');
    const colTags = header.indexOf('Tags');
    const colImages = header.indexOf('Imagens');
    const colSku = header.indexOf('SKU');
    const colPosition = header.indexOf('Posição');

    const publishedRows = rows.slice(1).filter(r => (r[colPublished] || '').trim() === '1');

    const categoryNamesMap = new Map<string, Category>();
    let catCounter = 1;

    const products: Product[] = publishedRows.map((r, idx) => {
      const legacyId = (r[colId] || '').trim() || String(idx + 1);
      const name = (r[colName] || '').trim();
      const rawSku = colSku !== -1 ? r[colSku] : '';
      const matchSku = name.match(/^([A-Z0-9\.\-\_]+)\s*[-–—]/i);
      const sku = rawSku && rawSku.trim() !== '' ? rawSku.trim() : (matchSku ? matchSku[1].trim() : null);

      const rawDesc = (r[colShortDesc] || '').trim() || (colDesc !== -1 ? (r[colDesc] || '').trim() : '');
      const desc = cleanProductDescription(rawDesc);

      const catsRaw = (r[colCategories] || '').split(',').map(c => c.trim()).filter(Boolean);
      const prodCategories: Category[] = catsRaw.map(cName => {
        if (!categoryNamesMap.has(cName)) {
          categoryNamesMap.set(cName, {
            id: `cat-${catCounter}`,
            name: cName,
            slug: slugify(cName),
            display_order: catCounter++,
          });
        }
        return categoryNamesMap.get(cName)!;
      });

      const imagesRaw = (r[colImages] || '').split(',').map(u => u.trim()).filter(Boolean);
      const images = imagesRaw.map((url, imgIdx) => ({
        id: `img-${legacyId}-${imgIdx}`,
        product_id: legacyId,
        storage_path: url,
        public_url: url, // usa url original da Hostinger como fallback até a migração
        sort_order: imgIdx,
        is_cover: imgIdx === 0,
      }));

      const tags = (r[colTags] || '').split(',').map(t => t.trim()).filter(Boolean);

      return {
        id: legacyId,
        legacy_id: legacyId,
        name: name,
        slug: `${slugify(name)}-${legacyId}`,
        code_sku: sku,
        description: desc,
        is_published: true,
        is_featured: (r[colFeatured] || '').trim() === '1',
        display_order: parseInt(r[colPosition], 10) || idx,
        tags: tags,
        categories: prodCategories,
        images: images,
      };
    });

    const categories = Array.from(categoryNamesMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    cachedLocalCSV = { products, categories, departments };
    return cachedLocalCSV;
  } catch (err) {
    console.error('Erro ao ler CSV local:', err);
    return { products: [], categories: [], departments: DEFAULT_DEPARTMENTS };
  }
}

// Busca principal com conexão Supabase, cache e fallback
export async function getCatalogData(): Promise<{ products: Product[]; categories: Category[]; departments: Department[] }> {
  // Retorna instantaneamente se estiver no cache em memória
  if (cachedCatalog && Date.now() - cachedCatalog.timestamp < CACHE_TTL_MS) {
    return {
      products: cachedCatalog.products,
      categories: cachedCatalog.categories,
      departments: cachedCatalog.departments,
    };
  }

  const departments = loadDepartmentsConfig();

  try {
    const supabase = getPublicSupabase();

    // Tenta buscar categorias no Supabase
    const { data: dbCategories, error: catError } = await supabase
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true });

    // Tenta buscar produtos no Supabase
    const { data: dbProducts, error: prodError } = await supabase
      .from('products')
      .select(`
        *,
        images:product_images(*),
        categories:product_categories(
          category:categories(*)
        )
      `)
      .eq('is_published', true)
      .order('display_order', { ascending: true });

    if (!catError && !prodError && dbProducts && dbProducts.length > 0) {
      const formattedProducts: Product[] = dbProducts.map((p: any) => ({
        ...p,
        description: cleanProductDescription(p.description),
        images: (p.images || []).sort((a: any, b: any) => {
          if (a.is_cover && !b.is_cover) return -1;
          if (!a.is_cover && b.is_cover) return 1;
          return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        }),
        categories: p.categories?.map((c: any) => c.category).filter(Boolean) || [],
      }));

      cachedCatalog = {
        products: formattedProducts,
        categories: dbCategories || [],
        departments: departments,
        timestamp: Date.now(),
      };

      return {
        products: formattedProducts,
        categories: dbCategories || [],
        departments: departments,
      };
    }
  } catch (e) {
    // Falha de conexão com o Supabase ou variáveis ainda não configuradas
  }

  // Se o Supabase estiver vazio ou indisponível temporariamente, carrega o catálogo local do CSV
  const fallback = getLocalCSVProducts();
  return fallback;
}
