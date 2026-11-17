const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKET_NAME = 'produtos';
const CACHE_CONTROL = '31536000'; // 1 ano
const STATE_FILE = path.join(__dirname, 'optimize-images-state.json');
const CONCURRENCY = 8;

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const CLEANUP_OLD = args.has('--cleanup');

function buildOptimizedStoragePath(oldPath) {
  const clean = String(oldPath || '').replace(/^\/+/, '');
  if (/-opt\.webp$/i.test(clean)) {
    return {
      mainPath: clean,
      thumbPath: clean.replace(/-opt\.webp$/i, '-opt-thumb.webp'),
    };
  }
  const withoutExt = clean.replace(/\.[^./]+$/, '');
  return {
    mainPath: `${withoutExt}-opt.webp`,
    thumbPath: `${withoutExt}-opt-thumb.webp`,
  };
}

function extractStoragePathFromUrl(urlStr) {
  try {
    const marker = `/storage/v1/object/public/${BUCKET_NAME}/`;
    const idx = urlStr.indexOf(marker);
    if (idx !== -1) {
      return decodeURIComponent(urlStr.slice(idx + marker.length).split('?')[0]);
    }
  } catch {}
  return null;
}

async function fetchBufferWithRetry(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
}

async function optimizeProductBuffers(origBuf) {
  const image = sharp(origBuf, { failOn: 'none' }).rotate();
  const meta = await image.metadata();

  const [reencodedMain, thumbBuf] = await Promise.all([
    image
      .clone()
      .resize({ width: 1200, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84, effort: 6 })
      .toBuffer(),
    image
      .clone()
      .resize({ width: 480, height: 640, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 6 })
      .toBuffer(),
  ]);

  // Se já é WebP dentro do tamanho máximo e a recompressão economizar menos de 10%,
  // preserva os bytes originais exatos para evitar perda geracional de qualidade.
  const alreadySmallWebp =
    meta.format === 'webp' &&
    (meta.width || 0) <= 1200 &&
    (meta.height || 0) <= 1600 &&
    reencodedMain.length >= origBuf.length * 0.9;

  const mainBuf = alreadySmallWebp ? origBuf : reencodedMain;
  return { mainBuf, thumbBuf, preservedOriginal: alreadySmallWebp };
}

async function optimizeBannerBuffer(origBuf, type) {
  const isMobile = type === 'mobile';
  const image = sharp(origBuf, { failOn: 'none' }).rotate();
  const meta = await image.metadata();
  const maxW = isMobile ? 900 : 1720;
  const maxH = isMobile ? 900 : 800;

  const reencoded = await image
    .clone()
    .resize({ width: maxW, height: maxH, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: isMobile ? 83 : 85, effort: 6 })
    .toBuffer();

  const alreadyGoodWebp =
    meta.format === 'webp' &&
    (meta.width || 0) <= maxW &&
    (meta.height || 0) <= maxH &&
    reencoded.length >= origBuf.length * 0.9;

  return alreadyGoodWebp ? origBuf : reencoded;
}

async function checkThumbColumnExists() {
  const { error } = await supabase.from('product_images').select('thumb_url').limit(1);
  return !error;
}

async function listAllStorageObjects(prefix = '') {
  const files = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).list(prefix, { limit, offset });
    if (error || !data || data.length === 0) break;
    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        // pasta
        const nested = await listAllStorageObjects(fullPath);
        files.push(...nested);
      } else {
        files.push({ path: fullPath, size: item.metadata?.size || 0 });
      }
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return files;
}

async function optimizeAllProductImages(state, hasThumbCol) {
  console.log('\n📦 1/3 Carregando tabela product_images...');
  const allRows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('product_images')
      .select('id, product_id, storage_path, public_url')
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }

  // Agrupa linhas pelo storage_path/public_url para processar cada arquivo único uma só vez
  const groupsMap = new Map();
  for (const row of allRows) {
    const pathFromUrl = extractStoragePathFromUrl(row.public_url || '');
    const sourcePath = pathFromUrl || row.storage_path;
    if (!sourcePath || !row.public_url || !row.public_url.includes('supabase.co')) {
      continue;
    }
    const key = sourcePath;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        sourcePath,
        sourceUrl: row.public_url,
        rowIds: [],
      });
    }
    groupsMap.get(key).rowIds.push(row.id);
  }

  const groups = Array.from(groupsMap.values());
  console.log(`🔎 Encontradas ${allRows.length} linhas (${groups.length} imagens únicas no bucket).`);

  let idx = 0;
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let origTotalBytes = 0;
  let optMainBytes = 0;
  let optThumbBytes = 0;

  const saveState = () => {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  };

  async function worker() {
    while (idx < groups.length) {
      const currentIdx = idx++;
      const item = groups[currentIdx];
      const { mainPath, thumbPath } = buildOptimizedStoragePath(item.sourcePath);

      // Verifica se já está completamente otimizado (checkpoint ou URL já é -opt.webp com thumb)
      const doneEntry = state.products[item.sourcePath];
      if (doneEntry && doneEntry.mainPath === mainPath && item.sourcePath === mainPath) {
        skipped++;
        processed++;
        continue;
      }

      try {
        const origBuf = await fetchBufferWithRetry(item.sourceUrl);
        origTotalBytes += origBuf.length;

        const { mainBuf, thumbBuf } = await optimizeProductBuffers(origBuf);
        optMainBytes += mainBuf.length;
        optThumbBytes += thumbBuf.length;

        if (!DRY_RUN) {
          const [upMain, upThumb] = await Promise.all([
            supabase.storage.from(BUCKET_NAME).upload(mainPath, mainBuf, {
              contentType: 'image/webp',
              cacheControl: CACHE_CONTROL,
              upsert: true,
            }),
            supabase.storage.from(BUCKET_NAME).upload(thumbPath, thumbBuf, {
              contentType: 'image/webp',
              cacheControl: CACHE_CONTROL,
              upsert: true,
            }),
          ]);

          if (upMain.error) throw upMain.error;
          if (upThumb.error) throw upThumb.error;

          const { data: mainUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(mainPath);
          const { data: thumbUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(thumbPath);

          const updatePayload = {
            storage_path: mainPath,
            public_url: mainUrlData.publicUrl,
          };
          if (hasThumbCol) {
            updatePayload.thumb_url = thumbUrlData.publicUrl;
          }

          const { error: dbErr } = await supabase
            .from('product_images')
            .update(updatePayload)
            .in('id', item.rowIds);

          if (dbErr) throw dbErr;

          state.products[mainPath] = {
            oldPath: item.sourcePath,
            mainPath,
            thumbPath,
            origBytes: origBuf.length,
            mainBytes: mainBuf.length,
            thumbBytes: thumbBuf.length,
            updatedAt: new Date().toISOString(),
          };
        }

        processed++;
        if (processed % 40 === 0 || processed === groups.length) {
          const pct = ((processed / groups.length) * 100).toFixed(1);
          console.log(
            `  [${processed}/${groups.length}] (${pct}%) Orig: ${(origTotalBytes / 1024 / 1024).toFixed(1)} MB -> WebP 1200px: ${(optMainBytes / 1024 / 1024).toFixed(1)} MB | Thumbs 480px: ${(optThumbBytes / 1024 / 1024).toFixed(1)} MB`
          );
          if (!DRY_RUN) saveState();
        }
      } catch (err) {
        failed++;
        processed++;
        state.errors[item.sourcePath] = { error: err.message, at: new Date().toISOString() };
        console.error(`  ❌ Erro em ${item.sourcePath}: ${err.message}`);
      }
    }
  }

  const workers = [];
  for (let w = 0; w < CONCURRENCY; w++) workers.push(worker());
  await Promise.all(workers);

  if (!DRY_RUN) saveState();

  console.log(`\n✅ Produtos concluídos: ${processed - failed - skipped} otimizados, ${skipped} já estavam ok, ${failed} falhas.`);
  console.log(
    `📉 Economia nas fotos de produtos: ${(origTotalBytes / 1024 / 1024).toFixed(2)} MB -> Principal: ${(optMainBytes / 1024 / 1024).toFixed(2)} MB | Miniaturas: ${(optThumbBytes / 1024 / 1024).toFixed(2)} MB`
  );
}

async function optimizeBanners() {
  console.log('\n🖼️ 2/3 Verificando banners em config/banners.json...');
  const { data: bFile, error } = await supabase.storage.from(BUCKET_NAME).download('config/banners.json');
  if (error || !bFile) {
    console.log('  Nenhum config/banners.json encontrado no Storage, pulando.');
    return;
  }

  const banners = JSON.parse(await bFile.text());
  if (!Array.isArray(banners) || banners.length === 0) return;

  let changed = false;
  for (const banner of banners) {
    for (const field of ['desktopImage', 'mobileImage']) {
      const url = banner[field];
      if (!url || !url.includes('supabase.co')) continue;
      const oldPath = extractStoragePathFromUrl(url);
      if (!oldPath) continue;
      if (/-opt\.webp$/i.test(oldPath)) continue;

      const { mainPath } = buildOptimizedStoragePath(oldPath);
      const origBuf = await fetchBufferWithRetry(url);
      const type = field === 'mobileImage' ? 'mobile' : 'desktop';
      const optBuf = await optimizeBannerBuffer(origBuf, type);

      console.log(
        `  Banner "${banner.title}" (${type}): ${(origBuf.length / 1024).toFixed(1)} KB -> ${(optBuf.length / 1024).toFixed(1)} KB`
      );

      if (!DRY_RUN) {
        const { error: upErr } = await supabase.storage.from(BUCKET_NAME).upload(mainPath, optBuf, {
          contentType: 'image/webp',
          cacheControl: CACHE_CONTROL,
          upsert: true,
        });
        if (upErr) throw upErr;
        const { data: pubData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(mainPath);
        banner[field] = pubData.publicUrl;
        changed = true;
      }
    }
  }

  if (changed && !DRY_RUN) {
    await supabase.storage.from(BUCKET_NAME).upload(
      'config/banners.json',
      Buffer.from(JSON.stringify(banners, null, 2), 'utf8'),
      { contentType: 'application/json', cacheControl: '60', upsert: true }
    );
    console.log('  ✅ config/banners.json atualizado com banners WebP otimizados!');
  } else {
    console.log('  ✅ Banners já otimizados.');
  }
}

async function cleanupUnreferencedFiles() {
  console.log('\n🧹 3/3 Limpando arquivos antigos/órfãos não referenciados no bucket...');
  const referenced = new Set([
    'config/banners.json',
    'config/departments.json',
    'config/promotions.json',
    'config/settings.json',
  ]);

  // 1. Todas as imagens de produtos (principal + thumb)
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('product_images')
      .select('storage_path, public_url')
      .range(from, from + 999);
    if (error || !data || data.length === 0) break;
    for (const row of data) {
      const p = extractStoragePathFromUrl(row.public_url || '') || row.storage_path;
      if (p) {
        referenced.add(p);
        if (/-opt\.webp$/i.test(p)) {
          referenced.add(p.replace(/-opt\.webp$/i, '-opt-thumb.webp'));
        }
      }
    }
    if (data.length < 1000) break;
    from += 1000;
  }

  // 2. Banners referenciados
  try {
    const { data: bFile } = await supabase.storage.from(BUCKET_NAME).download('config/banners.json');
    if (bFile) {
      const banners = JSON.parse(await bFile.text());
      for (const b of banners) {
        for (const f of ['desktopImage', 'mobileImage']) {
          const p = extractStoragePathFromUrl(b[f] || '');
          if (p) referenced.add(p);
        }
      }
    }
  } catch {}

  // 3. Avatares de profiles
  try {
    const { data: profs } = await supabase.from('profiles').select('avatar_url').not('avatar_url', 'is', null);
    for (const prof of profs || []) {
      const p = extractStoragePathFromUrl(prof.avatar_url || '');
      if (p) referenced.add(p);
    }
  } catch {}

  const allObjects = await listAllStorageObjects('');
  const toDelete = allObjects.filter((obj) => !referenced.has(obj.path));
  const deleteMB = toDelete.reduce((acc, o) => acc + (o.size || 0), 0) / 1024 / 1024;

  console.log(`  Total no bucket: ${allObjects.length} arquivos | Referenciados: ${referenced.size} | Órfãos/antigos a remover: ${toDelete.length} (~${deleteMB.toFixed(2)} MB)`);

  if (toDelete.length === 0 || DRY_RUN) return;

  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100).map((o) => o.path);
    const { error } = await supabase.storage.from(BUCKET_NAME).remove(batch);
    if (error) {
      console.warn('  ⚠️ Erro ao remover lote:', error.message);
    }
  }
  console.log(`  ✅ Limpeza concluída! ~${deleteMB.toFixed(2)} MB liberados no Storage.`);
}

async function main() {
  console.log('=====================================================');
  console.log('🖼️ OTIMIZAÇÃO DE IMAGENS PARA WEBP + MINIATURAS (ZEIQ)');
  console.log(`Modo: ${DRY_RUN ? 'SIMULAÇÃO (--dry-run)' : CLEANUP_OLD ? 'OTIMIZAÇÃO + LIMPEZA (--cleanup)' : 'OTIMIZAÇÃO SEGURA (mantém antigas até --cleanup)'}`);
  console.log('=====================================================');

  let state = { products: {}, errors: {} };
  if (fs.existsSync(STATE_FILE)) {
    try {
      state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      state.products = state.products || {};
      state.errors = state.errors || {};
    } catch {}
  }

  const hasThumbCol = await checkThumbColumnExists();
  console.log(`Coluna product_images.thumb_url no banco: ${hasThumbCol ? 'Presente ✅' : 'Ausente (usando resolução automática -opt-thumb.webp ✅)'}`);

  await optimizeAllProductImages(state, hasThumbCol);
  await optimizeBanners();

  if (CLEANUP_OLD) {
    await cleanupUnreferencedFiles();
  } else {
    console.log('\n💡 Dica: Após conferir o catálogo no ar, rode com "--cleanup" para remover os arquivos antigos substituídos e reduzir o espaço ocupado no Storage.');
  }
}

main().catch((err) => {
  console.error('Erro fatal na otimização:', err);
  process.exit(1);
});
