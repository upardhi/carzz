import { NextResponse, type NextRequest } from 'next/server';
import { homeFor, rolesForPath } from './lib/auth/rbac';
import { SESSION_COOKIE, verifySession } from './lib/auth/session';

/**
 * First line of defence: keeps a signed-out visitor out of every role section
 * and stops a signed-in one wandering into another role's console.
 *
 * Pages and route handlers re-check with `requireSession` / `requirePermission`
 * because middleware alone cannot see per-record ownership.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requiredRoles = rolesForPath(pathname);
  const claims = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === '/login' || pathname === '/') {
    if (claims) {
      return NextResponse.redirect(new URL(homeFor(claims.role), request.url));
    }
    return NextResponse.next();
  }

  if (!requiredRoles) return NextResponse.next();

  if (!claims) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (!requiredRoles.includes(claims.role)) {
    return NextResponse.redirect(new URL(homeFor(claims.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/admin/:path*',
    '/area/:path*',
    '/manager/:path*',
    '/staff/:path*',
    '/app/:path*',
  ],
};
