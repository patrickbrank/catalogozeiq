import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/supabase/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Acesso restrito: permissão insuficiente para upload de imagens.' },
        { status: 403 }
      );
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json(
        { success: false, error: 'Serviço de administração Supabase indisponível.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Nenhum arquivo enviado.' },
        { status: 400 }
      );
    }

    const fileExt = file.name.split('.').pop() || 'jpg';
    const cleanExt = fileExt.toLowerCase().replace(/[^a-z0-9]/g, '');
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${cleanExt}`;
    const storagePath = `admin-uploads/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await adminSupabase.storage
      .from('produtos')
      .upload(storagePath, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { success: false, error: `Falha no armazenamento: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = adminSupabase.storage
      .from('produtos')
      .getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      publicUrl: publicUrlData.publicUrl,
      storagePath,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Erro inesperado ao realizar upload.' },
      { status: 500 }
    );
  }
}
