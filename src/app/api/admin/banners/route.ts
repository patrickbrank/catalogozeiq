import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdmin } from '@/lib/supabase/admin-auth';
import { getBanners, saveBanners } from '@/lib/data/banners';
import { BannerItem } from '@/types';

export async function GET() {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const banners = await getBanners();
    return NextResponse.json({ success: true, banners });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const body = await request.json();
    const { banners } = body;

    if (!Array.isArray(banners)) {
      return NextResponse.json({ success: false, error: 'A lista de banners deve ser um array.' }, { status: 400 });
    }

    if (banners.length > 5) {
      return NextResponse.json({ success: false, error: 'O limite máximo é de 5 banners.' }, { status: 400 });
    }

    const updated = await saveBanners(banners as BannerItem[]);
    return NextResponse.json({ success: true, banners: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
