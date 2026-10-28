import { NextResponse } from 'next/server';
import { getCatalogData } from '@/lib/data/products';

export const revalidate = 60; // 60s cache

export async function GET() {
  try {
    const { products } = await getCatalogData();
    return NextResponse.json({
      success: true,
      products: products || [],
      total: products?.length || 0,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Erro ao carregar produtos.' },
      { status: 500 }
    );
  }
}
