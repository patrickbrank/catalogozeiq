import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  // Rotas que não exigem autenticação prévia
  const isPublicAuthRoute =
    pathname === '/portal' ||
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

  const userEmail = user?.email?.toLowerCase().trim();
  const isMaster = userEmail === 'marketing@zeiq.com.br' || userEmail === 'patrickbrank@outlook.com';
  const userAppRole = user?.app_metadata?.role;
  const isStaff = isMaster || ['admin', 'marketing', 'stock'].includes(userAppRole);

  // 1. BLOQUEIO GERAL: Catálogo exclusivo B2B restrito a clientes cadastrados
  if (!user && !isPublicAuthRoute) {
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 1.1 BLOQUEIO DE USUÁRIOS PENDENTES DE APROVAÇÃO
  if (user && !isStaff && !isPublicAuthRoute) {
    const isApprovedMeta = user.app_metadata?.is_approved ?? user.user_metadata?.is_approved;
    if (isApprovedMeta === false) {
      // Checa diretamente no profiles para garantir que aprovação recente no painel não seja barrada por token antigo
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_approved')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.is_approved === false) {
        return NextResponse.redirect(new URL('/login?pending_approval=1', request.url));
      }
    }
  }

  // 2. Proteção do Painel Administrativo
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!user) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    if (!isStaff) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const profileRole = profile?.role;
      if (!['admin', 'marketing', 'stock'].includes(profileRole)) {
        // Bloqueio rigoroso: lojistas b2b cadastrados nunca entram no painel administrativo
        return NextResponse.redirect(new URL('/?unauthorized_admin=1', request.url));
      }
    }
  }

  // 3. Redirecionamento se já estiver logado
  if (user) {
    // Se acessar /login ou /portal/login e já estiver autenticado e aprovado, vai para o catálogo
    if (pathname === '/login' || pathname === '/portal/login') {
      const isApprovedMeta = user.app_metadata?.is_approved ?? user.user_metadata?.is_approved;
      if (isApprovedMeta !== false || isStaff) {
        return NextResponse.redirect(new URL('/', request.url));
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_approved')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.is_approved === true) {
          return NextResponse.redirect(new URL('/', request.url));
        }
      }
    }

    // Se acessar /admin/login:
    // Se for admin/equipe, vai para /admin. Se for lojista comum, vai para o catálogo /
    if (pathname === '/admin/login') {
      if (isStaff) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (['admin', 'marketing', 'stock'].includes(profile?.role)) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }

      return NextResponse.redirect(new URL('/?unauthorized_admin=1', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
