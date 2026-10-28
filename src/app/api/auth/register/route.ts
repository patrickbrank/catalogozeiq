import { NextResponse, type NextRequest } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      contact_name,
      store_name,
      cnpj_cpf,
      phone,
      city,
      state,
      email,
      password,
      reseller_id,
      representative_id,
    } = body;

    // 1. Validações básicas de campos obrigatórios
    if (!contact_name?.trim()) {
      return NextResponse.json({ success: false, error: 'Nome do responsável é obrigatório.' }, { status: 400 });
    }
    if (!store_name?.trim()) {
      return NextResponse.json({ success: false, error: 'Nome da loja ou empresa é obrigatório.' }, { status: 400 });
    }
    if (!cnpj_cpf?.trim()) {
      return NextResponse.json({ success: false, error: 'CNPJ ou CPF é obrigatório.' }, { status: 400 });
    }
    if (!phone?.trim()) {
      return NextResponse.json({ success: false, error: 'WhatsApp / Telefone para contato é obrigatório.' }, { status: 400 });
    }
    if (!email?.trim()) {
      return NextResponse.json({ success: false, error: 'E-mail para login é obrigatório.' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ success: false, error: 'A senha de acesso deve ter pelo menos 6 caracteres.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanContactName = contact_name.trim();
    const cleanStoreName = store_name.trim();
    const cleanCnpjCpf = cnpj_cpf.trim();
    const cleanPhone = phone.trim();
    const cleanCity = city?.trim() || '';
    const cleanState = state?.trim()?.toUpperCase() || '';
    const cleanResellerId = (reseller_id || representative_id)?.trim() || null;

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json(
        { success: false, error: 'Serviço de administração Supabase temporariamente indisponível.' },
        { status: 500 }
      );
    }

    // Validação estrita: Seleção do revendedor é OBRIGATÓRIA se houver revendedores ativos cadastrados
    if (!cleanResellerId) {
      let activeCount = 0;
      try {
        const { count } = await adminSupabase
          .from('resellers')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'ativo');
        activeCount = count || 0;
      } catch {}

      if (activeCount > 0) {
        return NextResponse.json(
          { success: false, error: 'Por favor, selecione seu revendedor comercial no formulário.' },
          { status: 400 }
        );
      }
    }

    // 2. Cria usuário no Supabase Auth com email confirmado e is_approved: false
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      app_metadata: {
        role: 'reseller',
        is_approved: false,
        reseller_id: cleanResellerId,
        representative_id: cleanResellerId,
      },
      user_metadata: {
        role: 'reseller',
        contact_name: cleanContactName,
        store_name: cleanStoreName,
        phone: cleanPhone,
        cnpj_cpf: cleanCnpjCpf,
        city: cleanCity,
        state: cleanState,
        reseller_id: cleanResellerId,
        representative_id: cleanResellerId,
        is_approved: false,
      },
    });

    if (authError) {
      const errMsg = authError.message.toLowerCase();
      if (errMsg.includes('already registered') || errMsg.includes('already exists') || errMsg.includes('unique')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Este e-mail já possui cadastro. Se você já solicitou o acesso, aguarde a aprovação do seu revendedor comercial.',
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: false, error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // 3. Salva os dados cadastrais na tabela profiles com is_approved: false e vínculo permanente com reseller_id
    try {
      await adminSupabase.from('profiles').upsert({
        id: userId,
        email: cleanEmail,
        role: 'reseller',
        contact_name: cleanContactName,
        store_name: cleanStoreName,
        phone: cleanPhone,
        cnpj_cpf: cleanCnpjCpf,
        city: cleanCity,
        state: cleanState,
        reseller_id: cleanResellerId,
        representative_id: cleanResellerId,
        is_approved: false,
      });
    } catch (profileErr) {
      console.warn('Aviso ao gravar tabela profiles no auto-cadastro:', profileErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Cadastro solicitado com sucesso! Seus dados foram encaminhados para aprovação do seu revendedor comercial.',
      user: {
        id: userId,
        email: cleanEmail,
        store_name: cleanStoreName,
        contact_name: cleanContactName,
        reseller_id: cleanResellerId,
        is_approved: false,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao processar solicitação de cadastro.' },
      { status: 500 }
    );
  }
}
