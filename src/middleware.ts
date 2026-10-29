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
    pathname === '/revendedor/login' ||
    pathname === '/reseller/login' ||
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
  const userAppRole = user?.app_metadata?.role || user?.user_metadata?.role;
  const isRepresentative = userAppRole === 'representative';
  const isResellerRole = userAppRole === 'ROLE_RESELLER';
  const isStaff = isMaster || ['master', 'admin', 'stock', 'representative'].includes(userAppRole);

  // Redirecionamento amigável /reseller -> /revendedor
  if (pathname.startsWith('/reseller')) {
    const target = pathname.replace('/reseller', '/revendedor');
    return NextResponse.redirect(new URL(target, request.url));
  }

  // 1. BLOQUEIO GERAL: Rotas protegidas exigem autenticação
  if (!user && !isPublicAuthRoute) {
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    if (pathname.startsWith('/revendedor')) {
      return NextResponse.redirect(new URL('/revendedor/login', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 1.1 BLOQUEIO DE USUÁRIOS PENDENTES DE APROVAÇÃO (apenas lojistas clientes)
  if (user && !isStaff && !isResellerRole && !isPublicAuthRoute) {
    const isApprovedMeta = user.app_metadata?.is_approved ?? user.user_metadata?.is_approved;
    if (isApprovedMeta === false) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_approved, role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.role === 'ROLE_RESELLER') {
        // Revendedor não cai no bloqueio de cliente
      } else if (profile?.is_approved === false) {
        return NextResponse.redirect(new URL('/login?pending_approval=1', request.url));
      }
    }
  }

  // 2. Proteção do Painel Administrativo Master (/admin)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!user) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    // Revendedor comercial externo nunca acessa o Admin Master (mas representantes autorizados têm acesso à sua carteira)
    if (isResellerRole && !isStaff) {
      return NextResponse.redirect(new URL('/revendedor', request.url));
    }

    if (!isStaff) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const profileRole = profile?.role;
      if (profileRole === 'ROLE_RESELLER') {
        return NextResponse.redirect(new URL('/revendedor', request.url));
      }

      if (!['master', 'admin', 'stock', 'representative'].includes(profileRole)) {
        return NextResponse.redirect(new URL('/?unauthorized_admin=1', request.url));
      }
    }
  }

  // 2.1 Proteção do Painel do Revendedor (/revendedor)
  if (pathname.startsWith('/revendedor') && pathname !== '/revendedor/login') {
    if (!user) {
      return NextResponse.redirect(new URL('/revendedor/login', request.url));
    }

    // Master, Administradores e Representantes têm acesso autorizado
    if (!isMaster && !['master', 'admin', 'representative'].includes(userAppRole)) {
      let isAllowedReseller = isResellerRole;

      if (!isAllowedReseller) {
        // Valida no profiles ou tabela resellers
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.role === 'ROLE_RESELLER' || profile?.role === 'representative') {
          isAllowedReseller = true;
        } else {
          // Checa se existe na tabela resellers
          const { data: resellerData } = await supabase
            .from('resellers')
            .select('id, status')
            .or(`user_id.eq.${user.id},email.eq.${user.email}`)
            .eq('status', 'ativo')
            .maybeSingle();

          if (resellerData) {
            isAllowedReseller = true;
          }
        }
      }

      if (!isAllowedReseller) {
        // Lojistas comuns são barrados do painel do revendedor
        return NextResponse.redirect(new URL('/?unauthorized_reseller=1', request.url));
      }
    }
  }

  // 3. Redirecionamento inteligente se o usuário já estiver logado
  // Se for um link de recuperação/redefinição de senha, nunca intercepta para permitir a troca de senha
  const isRecoveryRequest =
    request.nextUrl.searchParams.get('type') === 'recovery' ||
    request.nextUrl.searchParams.has('token_hash') ||
    request.nextUrl.searchParams.has('code');

  if (user && !isRecoveryRequest) {
    // Se acessar /login ou /portal/login e já estiver autenticado:
    if (pathname === '/login' || pathname === '/portal/login') {
      if (isResellerRole) {
        return NextResponse.redirect(new URL('/revendedor', request.url));
      }

      const isApprovedMeta = user.app_metadata?.is_approved ?? user.user_metadata?.is_approved;
      if (isApprovedMeta !== false || isStaff) {
        return NextResponse.redirect(new URL('/', request.url));
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_approved, role')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.role === 'ROLE_RESELLER' || profile?.role === 'representative') {
          return NextResponse.redirect(new URL('/revendedor', request.url));
        }

        if (profile?.is_approved === true) {
          return NextResponse.redirect(new URL('/', request.url));
        }
      }
    }

    // Se acessar /revendedor/login e já estiver logado como revendedor ou staff:
    if (pathname === '/revendedor/login') {
      if (isResellerRole || isStaff) {
        return NextResponse.redirect(new URL('/revendedor', request.url));
      }
    }

    // Se acessar /admin/login:
    if (pathname === '/admin/login') {
      if (isResellerRole && !isStaff) {
        return NextResponse.redirect(new URL('/revendedor', request.url));
      }
      if (isStaff) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.role === 'ROLE_RESELLER') {
        return NextResponse.redirect(new URL('/revendedor', request.url));
      }
      if (['master', 'admin', 'stock', 'representative'].includes(profile?.role)) {
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
