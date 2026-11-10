const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ ERRO: Credenciais do Supabase não configuradas no .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const XLSX_PATH = path.join(__dirname, '..', 'docs', 'Revenda_Black.xlsx');

if (!fs.existsSync(XLSX_PATH)) {
  console.error(`❌ Arquivo não encontrado: ${XLSX_PATH}`);
  process.exit(1);
}

function cleanSkuKey(s) {
  if (!s) return '';
  return s.trim().toLowerCase().replace(/^mg/i, '');
}

async function run() {
  console.log('========================================================');
  console.log('🔥 IMPORTANDO PLANILHA REVENDA_BLACK (BLACK FRIDAY ZEIQ)');
  console.log('Período: 03/11/2026 a 30/11/2026');
  console.log('========================================================\n');

  console.log('📊 1. Extraindo dados de:', XLSX_PATH);
  const csvOutput = execSync(`npx --yes xlsx-cli "${XLSX_PATH}"`, { encoding: 'utf8' });
  const lines = csvOutput.split('\n').map((l) => l.trim()).filter(Boolean);

  const promoMapBySku = new Map();

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const rawSku = parts[0]?.trim();
    const rawPrice = parts[parts.length - 1]?.trim();

    if (!rawSku || !rawPrice) continue;

    const cleanPriceStr = rawPrice.replace(/[^\d\.,]/g, '');
    if (!cleanPriceStr) continue;

    const numPrice = cleanPriceStr.includes(',')
      ? parseFloat(cleanPriceStr.replace(/\./g, '').replace(',', '.'))
      : parseFloat(cleanPriceStr);

    if (!isNaN(numPrice) && numPrice > 0) {
      promoMapBySku.set(cleanSkuKey(rawSku), {
        originalSku: rawSku,
        promoPrice: numPrice,
      });
    }
  }

  console.log(`✅ ${promoMapBySku.size} itens com preço novo válidos na planilha.`);

  console.log('\n🔄 2. Consultando produtos no Supabase...');
  const { data: dbProducts, error: prodErr } = await supabase
    .from('products')
    .select('id, name, code_sku, price');

  if (prodErr || !dbProducts) {
    console.error('❌ Erro ao buscar produtos:', prodErr);
    process.exit(1);
  }

  console.log(`📦 ${dbProducts.length} produtos cadastrados no catálogo.`);

  const PROMO_START = '2026-11-03T00:00:00.000Z';
  const PROMO_END = '2026-11-30T23:59:59.000Z';

  const promotionsConfig = {};
  const matched = [];

  for (const p of dbProducts) {
    let key = p.code_sku ? cleanSkuKey(p.code_sku) : '';
    if (!key) {
      const m = p.name.match(/^([A-Z0-9\.\_\-]+)\s*[-–—]/i);
      if (m) key = cleanSkuKey(m[1]);
    }

    const promoItem = promoMapBySku.get(key);
    if (promoItem) {
      promotionsConfig[p.id] = {
        promotional_price: promoItem.promoPrice,
        promo_start_at: PROMO_START,
        promo_end_at: PROMO_END,
        updated_at: new Date().toISOString(),
      };

      if (p.code_sku) {
        promotionsConfig[cleanSkuKey(p.code_sku)] = promotionsConfig[p.id];
      }

      matched.push({
        id: p.id,
        sku: p.code_sku || promoItem.originalSku,
        name: p.name,
        oldPrice: p.price,
        promoPrice: promoItem.promoPrice,
      });
    }
  }

  console.log(`\n🎯 3. ${matched.length} produtos correspondentes localizados no catálogo!`);

  // Salva localmente em dados/promotions-config.json
  const localConfigPath = path.join(__dirname, '..', 'dados', 'promotions-config.json');
  fs.writeFileSync(localConfigPath, JSON.stringify(promotionsConfig, null, 2), 'utf8');
  console.log('💾 Arquivo local salvo em:', localConfigPath);

  // Salva no Supabase Storage (produtos/config/promotions.json)
  console.log('☁️ 4. Enviando configurações para o Supabase Storage...');
  try {
    const { data: upData, error: upErr } = await supabase.storage.from('produtos').upload(
      'config/promotions.json',
      Buffer.from(JSON.stringify(promotionsConfig, null, 2), 'utf8'),
      { contentType: 'application/json', upsert: true }
    );
    if (upErr) {
      console.warn('⚠️ Aviso ao subir no storage:', upErr.message);
    } else {
      console.log('✅ Upload no Supabase Storage concluído com sucesso!');
    }
  } catch (e) {
    console.warn('⚠️ Erro ao subir no storage:', e.message);
  }

  // Tenta atualizar colunas na tabela products do Supabase caso já existam
  console.log('🗄️ 5. Atualizando colunas na tabela products do banco de dados...');
  let dbUpdates = 0;
  for (const m of matched) {
    try {
      const { error: updErr } = await supabase
        .from('products')
        .update({
          promotional_price: m.promoPrice,
          promo_start_at: PROMO_START,
          promo_end_at: PROMO_END,
          updated_at: new Date().toISOString(),
        })
        .eq('id', m.id);
      if (!updErr) dbUpdates++;
    } catch {}
  }
  console.log(`✅ ${dbUpdates} produtos sincronizados diretamente nas colunas do banco.`);

  console.log('\n========================================================');
  console.log(`🎉 SUCESSO! Campanha Black Friday ativada para ${matched.length} produtos.`);
  console.log(`Vigência: 03/11/2026 até 30/11/2026`);
  console.log('========================================================\n');
}

run();
