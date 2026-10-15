import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/supabase/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { isAdmin, user } = await verifyAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json(
        { success: false, isAdmin: false, error: 'Acesso restrito a administradores.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      isAdmin: true,
      user: {
        id: user.id,
        email: user.email,
        role: 'admin',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, isAdmin: false, error: err.message },
      { status: 500 }
    );
  }
}
