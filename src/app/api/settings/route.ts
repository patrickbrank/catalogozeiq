import { NextResponse } from 'next/server';
import { getStoreSettings } from '@/lib/data/settings';

export const revalidate = 30; // 30s cache

export async function GET() {
  try {
    const settings = await getStoreSettings();
    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
