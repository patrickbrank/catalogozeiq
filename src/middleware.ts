import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  // Rotas que não exigem autenticação prévia
  const isPublicAuthRoute =
    pathname === '/login' ||
    pathname === '/portal/login' ||
    pathname === '/admin/login' ||
    pathname.startsWith('/api/');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // 1. BLOQUEIO GERAL: Catálogo exclusivo B2B restrito a clientes cadastrados
  if (!user && !isPublicAuthRoute) {
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. Proteção do Painel Administrativo
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!user) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    const email = user.email?.toLowerCase();
    const isMasterEmail = email === 'patrickbrank@outlook.com';
    const hasAdminAppMeta = user.app_metadata?.role === 'admin';

    if (!isMasterEmail && !hasAdminAppMeta) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.role !== 'admin') {
        return NextResponse.redirect(new URL('/admin/login?error=unauthorized', request.url));
      }
    }
  }

  // 3. Redirecionamento se já estiver logado
  if (user) {
    // Se acessar /login ou /portal/login e já estiver autenticado, vai para o catálogo
    if (pathname === '/login' || pathname === '/portal/login') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Se for admin e acessar /admin/login, vai para /admin
    if (pathname === '/admin/login') {
      const email = user.email?.toLowerCase();
      if (email === 'patrickbrank@outlook.com' || user.app_metadata?.role === 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.role === 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
