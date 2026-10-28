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
  auth: { persistSession: false, autoRefreshToken: false }
});

const XLS_PATH = path.join(__dirname, '..', 'public', 'TabeladePrecoOut26.xls');

if (!fs.existsSync(XLS_PATH)) {
  console.error(`❌ Arquivo de planilha não encontrado em: ${XLS_PATH}`);
  process.exit(1);
}

function cleanSku(s) {
  if (!s) return '';
  return s.trim().replace(/\s+/g, '');
}

function parsePriceLine(line) {
  const lastQuoteStart = line.lastIndexOf(',"');
  if (lastQuoteStart !== -1) {
    const firstComma = line.indexOf(',');
    const sku = line.slice(0, firstComma).trim();
    const desc = line.slice(firstComma + 1, lastQuoteStart).trim();
    const rawPrice = line.slice(lastQuoteStart + 2).replace(/"/g, '').trim();
    const num = parseFloat(rawPrice.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(num)) return { sku, desc, price: num, rawPrice };
  } else {
    const lastComma = line.lastIndexOf(',');
    const firstComma = line.indexOf(',');
    if (firstComma !== -1 && lastComma > firstComma) {
      const sku = line.slice(0, firstComma).trim();
      const desc = line.slice(firstComma + 1, lastComma).trim();
      const rawPrice = line.slice(lastComma + 1).replace(/"/g, '').trim();
      const num = parseFloat(rawPrice.replace(/\./g, '').replace(',', '.'));
      if (!isNaN(num)) return { sku, desc, price: num, rawPrice };
    }
  }
  return null;
}

async function main() {
  console.log('📊 1. Extraindo dados da planilha:', XLS_PATH);
  const csvOutput = execSync(`npx --yes xlsx-cli "${XLS_PATH}"`, { encoding: 'utf8' });
  const lines = csvOutput.split('\n').map((l) => l.trim()).filter(Boolean);

  const skuPriceMap = new Map();
  for (let i = 1; i < lines.length; i++) {
    const r = parsePriceLine(lines[i]);
    if (r) {
      const clean = cleanSku(r.sku).toLowerCase();
      skuPriceMap.set(clean, r.price);
    }
  }

  console.log(`✅ ${skuPriceMap.size} SKUs válidos processados da planilha.`);

  console.log('🔄 2. Carregando produtos cadastrados no Supabase...');
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, name, code_sku, price');

  if (prodErr || !products) {
    console.error('❌ Erro ao consultar produtos:', prodErr);
    process.exit(1);
  }

  console.log(`📦 ${products.length} produtos encontrados no catálogo.`);

  let updatedCount = 0;
  let skippedCount = 0;
  const updates = [];

  for (const p of products) {
    let raw = cleanSku(p.code_sku);
    if (!raw) {
      const m = p.name.match(/^([A-Z0-9\.\_\-\s]+?)\s*[-–—]/i);
      if (m) raw = cleanSku(m[1]);
    }

    const lower = raw.toLowerCase();
    let price = skuPriceMap.get(lower);

    if (price === undefined && lower.startsWith('mg')) {
      price = skuPriceMap.get(lower.slice(2));
    }
    if (price === undefined && !lower.startsWith('mg')) {
      price = skuPriceMap.get('mg' + lower);
    }
    if (price === undefined && lower.startsWith('0')) {
      price = skuPriceMap.get(lower.slice(1));
    }
    if (price === undefined && !lower.startsWith('0') && /^[0-9]/.test(lower)) {
      price = skuPriceMap.get('0' + lower);
    }

    if (price !== undefined) {
      updates.push({
        id: p.id,
        sku: p.code_sku || raw,
        name: p.name,
        oldPrice: p.price,
        newPrice: price,
      });
    } else {
      skippedCount++;
    }
  }

  console.log(`\n🚀 3. Iniciando gravação de preços no banco (${updates.length} produtos correspondentes)...`);

  const BATCH_SIZE = 25;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    await Promise.all(
      chunk.map(async (item) => {
        const updatePayload = {
          price: item.newPrice,
          updated_at: new Date().toISOString(),
        };

        // Se o produto não tinha SKU gravado, atualiza também o code_sku
        if (!item.oldSku && item.sku) {
          updatePayload.code_sku = item.sku;
        }

        const { error } = await supabase
          .from('products')
          .update(updatePayload)
          .eq('id', item.id);

        if (!error) {
          updatedCount++;
        } else {
          console.warn(`Aviso ao atualizar ${item.name}:`, error.message);
        }
      })
    );

    const progress = Math.min(i + BATCH_SIZE, updates.length);
    process.stdout.write(`\r   Progresso: ${progress}/${updates.length} (${Math.round((progress / updates.length) * 100)}%)`);
  }

  console.log('\n\n==============================================');
  console.log(`🎉 ATUALIZAÇÃO CONCLUÍDA COM SUCESSO!`);
  console.log(`- Produtos atualizados com novos preços: ${updatedCount}`);
  console.log(`- Produtos sem alteração/correspondência: ${skippedCount}`);
  console.log('==============================================\n');

  console.log('Exemplos de produtos com preços atualizados:');
  updates.slice(0, 8).forEach((u) => {
    console.log(` • [${u.sku}] ${u.name.slice(0, 45)}: R$ ${u.newPrice.toFixed(2).replace('.', ',')}`);
  });
}

main().catch(console.error);
