import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/supabase/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const adminSupabase = getAdminClient();
    if (!adminSupabase) {
      return NextResponse.json({ success: false, error: 'Chave administrativa não configurada.' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = (formData.get('type') as string) || 'desktop';

    if (!file) {
      return NextResponse.json({ success: false, error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop() || 'webp';
    const cleanExt = fileExt.toLowerCase().replace(/[^a-z0-9]/g, '');
    const fileName = `banner-${type}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${cleanExt}`;
    const storagePath = `banners/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await adminSupabase.storage
      .from('produtos')
      .upload(storagePath, buffer, {
        contentType: file.type || 'image/webp',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });
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
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
