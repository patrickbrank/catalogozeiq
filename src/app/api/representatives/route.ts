import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin-auth';

export const dynamic = 'force-dynamic';

// GET: Retorna a lista de Representantes/Revendedores ativos para vinculação no cadastro
export async function GET() {
  try {
    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: true, representatives: [] });
    }

    // 1. Tenta buscar da tabela resellers
    const { data: resellersData } = await adminSupabase
      .from('resellers')
      .select('id, name, email, phone, whatsapp, status')
      .eq('status', 'ativo')
      .order('name', { ascending: true });

    if (resellersData && resellersData.length > 0) {
      const formatted = resellersData.map((rep) => ({
        id: rep.id,
        name: rep.name,
        contact_name: rep.name,
        store_name: rep.name,
        phone: rep.whatsapp || rep.phone,
        whatsapp: rep.whatsapp,
        email: rep.email,
      }));

      return NextResponse.json({
        success: true,
        representatives: formatted,
      });
    }

    // 2. Fallback para tabela profiles
    const { data, error } = await adminSupabase
      .from('profiles')
      .select('id, contact_name, store_name, phone, email, is_approved')
      .eq('role', 'representative')
      .eq('is_approved', true)
      .order('contact_name', { ascending: true });

    if (error) {
      return NextResponse.json({ success: true, representatives: [] });
    }

    const formatted = (data || []).map((rep) => ({
      id: rep.id,
      name: rep.contact_name || rep.store_name || rep.email,
      contact_name: rep.contact_name,
      store_name: rep.store_name,
      phone: rep.phone,
      whatsapp: (rep.phone || '').replace(/\D/g, ''),
      email: rep.email,
    }));

    return NextResponse.json({
      success: true,
      representatives: formatted,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message, representatives: [] },
      { status: 500 }
    );
  }
}
