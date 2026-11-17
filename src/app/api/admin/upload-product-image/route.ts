import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdmin, getAdminClient } from '@/lib/supabase/admin-auth';
import {
  optimizeProductImageBuffer,
  STORAGE_CACHE_CONTROL,
} from '@/lib/utils/server-image-optimizer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    const baseName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    let mainBuffer: Buffer;
    let thumbBuffer: Buffer | null = null;
    let mainPath = `admin-uploads/${baseName}-opt.webp`;
    let thumbPath = `admin-uploads/${baseName}-opt-thumb.webp`;
    let contentType = 'image/webp';

    try {
      const optimized = await optimizeProductImageBuffer(inputBuffer);
      mainBuffer = optimized.mainBuffer;
      thumbBuffer = optimized.thumbBuffer;
    } catch (optErr) {
      console.warn('Fallback no processamento sharp (produto), mantendo arquivo original:', optErr);
      const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      mainPath = `admin-uploads/${baseName}.${fileExt}`;
      mainBuffer = inputBuffer;
      contentType = file.type || 'image/jpeg';
    }

    const { error: uploadError } = await adminSupabase.storage
      .from('produtos')
      .upload(mainPath, mainBuffer, {
        contentType,
        cacheControl: STORAGE_CACHE_CONTROL,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { success: false, error: `Falha no armazenamento: ${uploadError.message}` },
        { status: 500 }
      );
    }

    let thumbUrl: string | undefined;
    if (thumbBuffer) {
      const { error: thumbErr } = await adminSupabase.storage
        .from('produtos')
        .upload(thumbPath, thumbBuffer, {
          contentType: 'image/webp',
          cacheControl: STORAGE_CACHE_CONTROL,
          upsert: true,
        });

      if (!thumbErr) {
        const { data: thumbUrlData } = adminSupabase.storage
          .from('produtos')
          .getPublicUrl(thumbPath);
        thumbUrl = thumbUrlData.publicUrl;
      }
    }

    const { data: publicUrlData } = adminSupabase.storage
      .from('produtos')
      .getPublicUrl(mainPath);

    return NextResponse.json({
      success: true,
      publicUrl: publicUrlData.publicUrl,
      storagePath: mainPath,
      thumbUrl: thumbUrl || publicUrlData.publicUrl,
      thumbStoragePath: thumbBuffer ? thumbPath : undefined,
      originalBytes: inputBuffer.length,
      optimizedBytes: mainBuffer.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Erro inesperado ao realizar upload.' },
      { status: 500 }
    );
  }
}
