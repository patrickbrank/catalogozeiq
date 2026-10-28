import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/supabase/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { isAdmin, isMaster, role, user } = await verifyAdmin();
    if (!isAdmin || !user) {
      return NextResponse.json(
        { success: false, isAdmin: false, error: 'Acesso restrito à equipe e administração.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      isAdmin: true,
      isMaster,
      role,
      user: {
        id: user.id,
        email: user.email,
        role: role,
        is_master: isMaster,
        contact_name: user.user_metadata?.contact_name || user.email?.split('@')[0],
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, isAdmin: false, error: err.message },
      { status: 500 }
    );
  }
}
