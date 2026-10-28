import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin-auth';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET: Retorna lista de revendedores ativos para o select de cadastro do cliente
export async function GET() {
  try {
    const adminSupabase = getAdminClient();
    const serverSupabase = await createServerClient();
    const client = adminSupabase || serverSupabase;

    // 1. Tenta buscar na tabela 'resellers'
    const { data: resellers, error: resErr } = await client
      .from('resellers')
      .select('id, name, email, phone, whatsapp, status, notification_preference')
      .eq('status', 'ativo')
      .order('name', { ascending: true });

    if (!resErr && resellers && resellers.length > 0) {
      return NextResponse.json({
        success: true,
        resellers: resellers.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          phone: r.phone || r.whatsapp,
          whatsapp: r.whatsapp,
          notification_preference: r.notification_preference,
        })),
      });
    }

    // 2. Fallback retrocompatível: busca representantes na tabela profiles se resellers estiver vazia
    const { data: legacyReps } = await client
      .from('profiles')
      .select('id, contact_name, store_name, phone, email, is_approved')
      .eq('role', 'representative')
      .eq('is_approved', true)
      .order('contact_name', { ascending: true });

    const formattedLegacy = (legacyReps || []).map((rep) => ({
      id: rep.id,
      name: rep.contact_name || rep.store_name || rep.email,
      email: rep.email,
      phone: rep.phone,
      whatsapp: (rep.phone || '').replace(/\D/g, ''),
      notification_preference: 'both',
    }));

    return NextResponse.json({
      success: true,
      resellers: formattedLegacy,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message, resellers: [] },
      { status: 500 }
    );
  }
}
