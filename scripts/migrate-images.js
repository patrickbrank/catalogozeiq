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
const CSV_FILE_NAME = process.env.CSV_FILE || (fs.existsSync(path.join(__dirname, '..', 'dados', 'lista novos produtos.csv')) ? 'lista novos produtos.csv' : 'wc-product-export-13-10-2026-1791938769430.csv');
const CSV_PATH = path.join(__dirname, '..', 'dados', CSV_FILE_NAME);
const STATE_FILE = path.join(__dirname, 'migration-images-state.json');
const CONCURRENCY_LIMIT = 8;

// Parser CSV com suporte a campos multilinhas
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

// Extrai o caminho relativo preservando estrutura /ano/mes/arquivo.ext
function getStoragePath(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const match = parsed.pathname.match(/\/wp-content\/uploads\/(.+)/i);
    let subpath = match ? match[1] : parsed.pathname.replace(/^\//, '');
    // Decodifica %20 e caracteres especiais para nomes limpos
    return decodeURIComponent(subpath);
  } catch (e) {
    return path.basename(urlStr);
  }
}

// Helper com retry e timeout
async function fetchWithRetry(url, retries = 3, timeoutMs = 25000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ZeiqCatalogMigrator/1.0'
        }
      });
      clearTimeout(timeout);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      return { buffer, contentType };
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === retries) throw err;
      const delay = attempt * 1500;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function main() {
  console.log('=====================================================');
  console.log('🚀 INICIANDO MIGRAÇÃO DE IMAGENS: HOSTINGER -> SUPABASE');
  console.log(`Bucket de destino: "${BUCKET_NAME}"`);
  console.log(`URL do Supabase: ${SUPABASE_URL}`);
  console.log('=====================================================\n');

  // 1. Carrega ou cria estado de migração
  let state = { completed: {}, failed: {} };
  if (fs.existsSync(STATE_FILE)) {
    try {
      state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      console.log(`📌 Checkpoint encontrado: ${Object.keys(state.completed).length} imagens já migradas anteriormente.`);
    } catch (e) {
      console.warn('⚠️ Não foi possível ler o arquivo de checkpoint anterior, iniciando do zero.');
    }
  }

  // 2. Lê e filtra produtos publicados do CSV
  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(content);
  const header = rows[0];
  const colPublished = header.indexOf('Publicado');
  const colImages = header.indexOf('Imagens');

  const uniqueImagesMap = new Map(); // originalUrl -> storagePath

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const isPub = (row[colPublished] || '').trim() === '1';
    const hasImgs = !!(row[colImages] && row[colImages].trim());
    if (isPub || hasImgs) {
      const images = (row[colImages] || '').split(',').map(u => u.trim()).filter(Boolean);
      for (const imgUrl of images) {
        if (!uniqueImagesMap.has(imgUrl)) {
          uniqueImagesMap.set(imgUrl, getStoragePath(imgUrl));
        }
      }
    }
  }

  const allItems = Array.from(uniqueImagesMap.entries()).map(([url, storagePath]) => ({
    url,
    storagePath
  }));

  const total = allItems.length;
  console.log(`📊 Total de imagens únicas de produtos publicados: ${total}`);

  // Filtra as que ainda faltam
  const pendingItems = allItems.filter(item => !state.completed[item.url]);
  console.log(`⏳ Imagens pendentes para envio: ${pendingItems.length}\n`);

  if (pendingItems.length === 0) {
    console.log('✅ Todas as imagens já foram migradas com sucesso!');
    return;
  }

  let processedCount = total - pendingItems.length;
  let successCount = 0;
  let failCount = 0;

  // Função para salvar estado periodicamente
  const saveState = () => {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  };

  // Processamento com concorrência limitada (Worker Pool)
  let currentIndex = 0;

  async function worker(workerId) {
    while (currentIndex < pendingItems.length) {
      const idx = currentIndex++;
      const item = pendingItems[idx];
      processedCount++;
      const currentPct = ((processedCount / total) * 100).toFixed(1);

      try {
        // Baixa da Hostinger
        const { buffer, contentType } = await fetchWithRetry(item.url);

        // Envia para o Supabase Storage (com upsert: true para idempotência)
        const { data, error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(item.storagePath, buffer, {
            contentType,
            upsert: true
          });

        if (uploadError) {
          throw uploadError;
        }

        // Obtém a URL pública final
        const { data: publicUrlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(item.storagePath);

        state.completed[item.url] = {
          storagePath: item.storagePath,
          publicUrl: publicUrlData.publicUrl,
          migratedAt: new Date().toISOString()
        };
        delete state.failed[item.url];
        successCount++;

        console.log(`[${processedCount}/${total}] (${currentPct}%) [W${workerId}] OK: ${path.basename(item.storagePath)}`);
      } catch (err) {
        failCount++;
        state.failed[item.url] = {
          storagePath: item.storagePath,
          error: err.message,
          failedAt: new Date().toISOString()
        };
        console.error(`[${processedCount}/${total}] (${currentPct}%) [W${workerId}] ❌ FALHA: ${path.basename(item.storagePath)} -> ${err.message}`);
      }

      // Salva checkpoint a cada 20 itens processados
      if (processedCount % 20 === 0) {
        saveState();
      }
    }
  }

  const workers = [];
  for (let w = 1; w <= CONCURRENCY_LIMIT; w++) {
    workers.push(worker(w));
  }

  await Promise.all(workers);
  saveState();

  console.log('\n=====================================================');
  console.log('🎉 MIGRAÇÃO DE IMAGENS CONCLUÍDA');
  console.log(`Total geral: ${total}`);
  console.log(`Sucessos nesta execução: ${successCount}`);
  console.log(`Falhas nesta execução: ${failCount}`);
  console.log(`Total acumulado no Supabase: ${Object.keys(state.completed).length}`);
  console.log('=====================================================\n');
}

main().catch(err => {
  console.error('Erro fatal durante a migração de imagens:', err);
  process.exit(1);
});
