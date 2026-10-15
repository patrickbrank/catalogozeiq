const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\n❌ ERRO: SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.');
  console.error('Por favor, configure o arquivo .env ou .env.local na raiz do projeto com as credenciais do Supabase.\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

const BUCKET_NAME = 'produtos';
const CSV_PATH = path.join(__dirname, '..', 'dados', 'wc-product-export-13-10-2026-1791938769430.csv');
const IMAGES_STATE_FILE = path.join(__dirname, 'migration-images-state.json');
const REPORT_FILE = path.join(__dirname, 'migration-database-report.json');

// Função para gerar slugs amigáveis
function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Extrai SKU do código inicial do produto (ex: '308.010 - Nome' -> '308.010')
function extractSku(name, rawSku) {
  if (rawSku && rawSku.trim() !== '') return rawSku.trim();
  const match = name.match(/^([A-Z0-9\.\-\_]+)\s*[-–—]/i);
  if (match) return match[1].trim();
  return null;
}

// Extrai subcaminho do arquivo de imagem
function getStoragePath(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const match = parsed.pathname.match(/\/wp-content\/uploads\/(.+)/i);
    let subpath = match ? match[1] : parsed.pathname.replace(/^\//, '');
    return decodeURIComponent(subpath);
  } catch (e) {
    return path.basename(urlStr);
  }
}

// Parser CSV com suporte a campos com aspas e quebras de linha
function parseCSV(text) {
  const p = [];
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

async function main() {
  console.log('=====================================================');
  console.log('📦 INICIANDO IMPORTAÇÃO DE DADOS (BATCH): CSV -> SUPABASE');
  console.log(`URL do Supabase: ${SUPABASE_URL}`);
  console.log('=====================================================\n');

  // Carrega mapeamento de imagens já migradas se existir
  let imagesState = { completed: {} };
  if (fs.existsSync(IMAGES_STATE_FILE)) {
    try {
      imagesState = JSON.parse(fs.readFileSync(IMAGES_STATE_FILE, 'utf8'));
      console.log(`📸 Checkpoint de imagens carregado: ${Object.keys(imagesState.completed).length} fotos no estado.`);
    } catch (e) {}
  }

  const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(csvContent);
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

  // 1. Filtrar somente os 454 produtos publicados
  const publishedRows = rows.slice(1).filter(r => (r[colPublished] || '').trim() === '1');
  console.log(`📋 Total de produtos publicados a importar: ${publishedRows.length}\n`);

  // 2. Extrair e criar categorias em lote
  console.log('--- ETAPA 1: Sincronizando Categorias em Lote ---');
  const categoryNamesSet = new Set();
  publishedRows.forEach(r => {
    const cats = (r[colCategories] || '').split(',').map(c => c.trim()).filter(Boolean);
    cats.forEach(c => categoryNamesSet.add(c));
  });

  const categoriesToUpsert = Array.from(categoryNamesSet).map((catName, idx) => ({
    name: catName,
    slug: slugify(catName) || `categoria-${idx + 1}`,
    display_order: idx + 1,
  }));

  const { data: insertedCats, error: catErr } = await supabase
    .from('categories')
    .upsert(categoriesToUpsert, { onConflict: 'name' })
    .select('id, name');

  if (catErr) {
    throw new Error(`Erro ao upsert categorias: ${catErr.message}`);
  }

  const categoriesMap = new Map();
  insertedCats.forEach(c => categoriesMap.set(c.name, c.id));
  console.log(`✅ ${categoriesMap.size} categorias salvas com sucesso.\n`);

  // 3. Preparar produtos
  console.log('--- ETAPA 2: Preparando e Inserindo Produtos em Lote ---');
  const productsToUpsert = [];
  const legacyToRawRow = new Map();

  for (let i = 0; i < publishedRows.length; i++) {
    const r = publishedRows[i];
    const legacyId = (r[colId] || '').trim() || String(i + 1);
    const name = (r[colName] || '').trim();
    const rawSku = colSku !== -1 ? r[colSku] : '';
    const sku = extractSku(name, rawSku);

    let description = (r[colShortDesc] || '').trim();
    if (!description && colDesc !== -1) {
      description = (r[colDesc] || '').trim();
    }
    description = description
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&nbsp;/gi, ' ')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\\n/g, '\n')
      .trim();

    const isFeatured = (r[colFeatured] || '').trim() === '1';
    const position = parseInt(r[colPosition], 10) || i;
    const tags = (r[colTags] || '').split(',').map(t => t.trim()).filter(Boolean);
    const baseSlug = slugify(name);
    const slug = baseSlug ? `${baseSlug}-${legacyId}` : `produto-${legacyId}`;

    productsToUpsert.push({
      legacy_id: legacyId,
      name: name,
      slug: slug,
      code_sku: sku,
      description: description,
      is_published: true,
      is_featured: isFeatured,
      display_order: position,
      tags: tags
    });

    legacyToRawRow.set(legacyId, r);
  }

  // Inserção de produtos em lotes de 100
  const legacyToDbId = new Map();
  const BATCH_SIZE = 100;

  for (let i = 0; i < productsToUpsert.length; i += BATCH_SIZE) {
    const batch = productsToUpsert.slice(i, i + BATCH_SIZE);
    const { data: upsertedProds, error: prodErr } = await supabase
      .from('products')
      .upsert(batch, { onConflict: 'legacy_id' })
      .select('id, legacy_id');

    if (prodErr) {
      throw new Error(`Erro ao fazer batch upsert de produtos: ${prodErr.message}`);
    }

    upsertedProds.forEach(p => legacyToDbId.set(p.legacy_id, p.id));
    console.log(`📦 [${Math.min(i + BATCH_SIZE, productsToUpsert.length)}/${productsToUpsert.length}] Produtos salvos no banco.`);
  }

  // 4. Preparar relações Produto <-> Categorias e Imagens
  console.log('\n--- ETAPA 3: Montando Relações de Categorias e Galeria de Fotos ---');
  const allProductCategories = [];
  const allProductImages = [];
  const allDbProductIds = Array.from(legacyToDbId.values());

  // Limpa relações anteriores para evitar duplicatas em re-execução
  for (let i = 0; i < allDbProductIds.length; i += 200) {
    const chunkIds = allDbProductIds.slice(i, i + 200);
    await supabase.from('product_images').delete().in('product_id', chunkIds);
    await supabase.from('product_categories').delete().in('product_id', chunkIds);
  }

  for (const [legacyId, dbId] of legacyToDbId.entries()) {
    const r = legacyToRawRow.get(legacyId);
    if (!r) continue;

    // Categorias
    const productCats = (r[colCategories] || '').split(',').map(c => c.trim()).filter(Boolean);
    for (const catName of productCats) {
      const catId = categoriesMap.get(catName);
      if (catId) {
        allProductCategories.push({
          product_id: dbId,
          category_id: catId,
        });
      }
    }

    // Imagens
    const rawImages = (r[colImages] || '').split(',').map(u => u.trim()).filter(Boolean);
    for (let imgIdx = 0; imgIdx < rawImages.length; imgIdx++) {
      const originalUrl = rawImages[imgIdx];
      const storagePath = getStoragePath(originalUrl);

      let publicUrl = '';
      if (imagesState.completed && imagesState.completed[originalUrl]) {
        publicUrl = imagesState.completed[originalUrl].publicUrl;
      } else {
        const { data: pUrl } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
        publicUrl = pUrl.publicUrl;
      }

      allProductImages.push({
        product_id: dbId,
        legacy_url: originalUrl,
        storage_path: storagePath,
        public_url: publicUrl,
        sort_order: imgIdx,
        is_cover: imgIdx === 0,
      });
    }
  }

  // Inserir categorias em lotes de 500
  console.log(`🔗 Inserindo ${allProductCategories.length} vínculos de produtos com categorias...`);
  for (let i = 0; i < allProductCategories.length; i += 500) {
    const catBatch = allProductCategories.slice(i, i + 500);
    const { error: catRelErr } = await supabase.from('product_categories').upsert(catBatch, { onConflict: 'product_id,category_id' });
    if (catRelErr) console.warn('Aviso vínculo categorias:', catRelErr.message);
  }

  // Inserir imagens em lotes de 500
  console.log(`🖼️ Inserindo ${allProductImages.length} referências de imagens...`);
  for (let i = 0; i < allProductImages.length; i += 500) {
    const imgBatch = allProductImages.slice(i, i + 500);
    const { error: imgRelErr } = await supabase.from('product_images').insert(imgBatch);
    if (imgRelErr) console.warn('Aviso inserção imagens:', imgRelErr.message);
  }

  const report = {
    totalTarget: publishedRows.length,
    success: legacyToDbId.size,
    categoriesCount: categoriesMap.size,
    imagesCount: allProductImages.length,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n=====================================================');
  console.log('🎉 MIGRAÇÃO DE BANCO FINALIZADA COM SUCESSO ABSOLUTO!');
  console.log(`Produtos Importados: ${report.success} de ${report.totalTarget}`);
  console.log(`Categorias Sincronizadas: ${report.categoriesCount}`);
  console.log(`Imagens Vinculadas: ${report.imagesCount}`);
  console.log(`Relatório salvo em: scripts/migration-database-report.json`);
  console.log('=====================================================\n');
}

main().catch(err => {
  console.error('Erro fatal durante a importação do banco:', err);
  process.exit(1);
});
