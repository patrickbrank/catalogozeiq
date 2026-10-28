const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hhgiodgcsvioulevorud.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!key) {
  console.error('SUPABASE_SERVICE_ROLE_KEY não encontrada em .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

const INITIAL_PASSWORD = process.env.DEFAULT_RESELLER_PASSWORD || 'Zeiq@2026';

async function sync() {
  console.log('=== SINCRONIZANDO AUTENTICAÇÃO DOS REVENDEDORES ===');

  // 1. Busca revendedores cadastrados na tabela
  const { data: resellers, error: rErr } = await supabase.from('resellers').select('*');
  if (rErr) {
    console.error('Erro ao ler resellers:', rErr.message);
    process.exit(1);
  }

  // 2. Busca usuários existentes no Auth
  const { data: authList } = await supabase.auth.admin.listUsers({ perPage: 250 });
  const authMap = new Map();
  (authList?.users || []).forEach(u => authMap.set(u.email.toLowerCase(), u));

  for (const r of resellers) {
    const cleanEmail = r.email.toLowerCase().trim();
    const existing = authMap.get(cleanEmail);

    if (existing) {
      console.log(`\nAtualizando usuário existente: ${r.name} (${cleanEmail})`);
      // Atualiza role no Supabase Auth para ROLE_RESELLER
      const { error: updErr } = await supabase.auth.admin.updateUserById(existing.id, {
        app_metadata: {
          role: 'ROLE_RESELLER',
        },
        user_metadata: {
          role: 'ROLE_RESELLER',
          contact_name: r.name,
          phone: r.whatsapp,
          is_approved: true,
        },
      });

      if (updErr) {
        console.error(`Erro ao atualizar auth de ${cleanEmail}:`, updErr.message);
      } else {
        console.log(`✓ Auth atualizado para ROLE_RESELLER`);
      }

      // Atualiza tabela profiles
      await supabase.from('profiles').upsert({
        id: existing.id,
        email: cleanEmail,
        role: 'ROLE_RESELLER',
        contact_name: r.name,
        store_name: 'Representação Comercial Zeiq',
        phone: r.whatsapp,
        is_approved: true,
      });

      // Vincula user_id na tabela resellers se não estiver
      if (r.user_id !== existing.id) {
        await supabase.from('resellers').update({ user_id: existing.id }).eq('id', r.id);
        console.log(`✓ user_id vinculado na tabela resellers`);
      }
    } else {
      console.log(`\nCriando nova conta de acesso para: ${r.name} (${cleanEmail})`);
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: INITIAL_PASSWORD,
        email_confirm: true,
        app_metadata: {
          role: 'ROLE_RESELLER',
        },
        user_metadata: {
          role: 'ROLE_RESELLER',
          contact_name: r.name,
          phone: r.whatsapp,
          is_approved: true,
        },
      });

      if (createErr) {
        console.error(`Erro ao criar auth de ${cleanEmail}:`, createErr.message);
      } else {
        const userId = newUser.user.id;
        console.log(`✓ Conta Auth criada com sucesso! ID: ${userId}`);

        // Insere profile
        await supabase.from('profiles').upsert({
          id: userId,
          email: cleanEmail,
          role: 'ROLE_RESELLER',
          contact_name: r.name,
          store_name: 'Representação Comercial Zeiq',
          phone: r.whatsapp,
          is_approved: true,
        });

        // Atualiza resellers com o novo user_id
        await supabase.from('resellers').update({ user_id: userId }).eq('id', r.id);
        console.log(`✓ user_id vinculado na tabela resellers`);
      }
    }
  }

  console.log('\n=== SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO ===');
}

sync().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
