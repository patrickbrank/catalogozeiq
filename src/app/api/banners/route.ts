import { NextResponse } from 'next/server';
import { getBanners } from '@/lib/data/banners';

export const revalidate = 30; // 30s cache

export async function GET() {
  try {
    const banners = await getBanners();
    const activeOnly = banners.filter((b) => b.isActive !== false);
    return NextResponse.json({ success: true, banners: activeOnly });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
