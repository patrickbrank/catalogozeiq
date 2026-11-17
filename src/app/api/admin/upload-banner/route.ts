import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/supabase/admin-auth';
import {
  optimizeBannerImageBuffer,
  STORAGE_CACHE_CONTROL,
} from '@/lib/utils/server-image-optimizer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    const cleanType = type === 'mobile' ? 'mobile' : 'desktop';
    const baseName = `banner-${cleanType}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    let finalBuffer: Buffer;
    let storagePath = `banners/${baseName}-opt.webp`;
    let contentType = 'image/webp';

    try {
      finalBuffer = await optimizeBannerImageBuffer(inputBuffer, cleanType);
    } catch (optErr) {
      console.warn('Fallback no processamento sharp (banner), mantendo arquivo original:', optErr);
      const fileExt = (file.name.split('.').pop() || 'webp').toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp';
      storagePath = `banners/${baseName}.${fileExt}`;
      finalBuffer = inputBuffer;
      contentType = file.type || 'image/webp';
    }

    const { error: uploadError } = await adminSupabase.storage
      .from('produtos')
      .upload(storagePath, finalBuffer, {
        contentType,
        cacheControl: STORAGE_CACHE_CONTROL,
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
      originalBytes: inputBuffer.length,
      optimizedBytes: finalBuffer.length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
