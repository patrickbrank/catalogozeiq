import { NextResponse, type NextRequest } from 'next/server';
import { verifyAdmin } from '@/lib/supabase/admin-auth';
import { getStoreSettings, saveStoreSettings } from '@/lib/data/settings';

export async function GET() {
  try {
    const { isAdmin } = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Acesso restrito a administradores.' }, { status: 403 });
    }

    const settings = await getStoreSettings();
    return NextResponse.json({ success: true, settings });
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
    const { whatsappNumber, contactEmail, siteName } = body;

    const updated = await saveStoreSettings({
      whatsappNumber,
      contactEmail,
      siteName,
    });

    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
