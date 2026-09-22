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
  const rawCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = await verifySession(rawCookie);

  // If a session cookie is present but malformed or unverified, purge it on
  // public routes so the browser does not send it continuously.
  if (rawCookie && !claims && (pathname === '/' || pathname === '/login')) {
    const res = NextResponse.next();
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  // The marketing site at `/` and the `/login` screen are public.
  // We deliberately do NOT redirect away from `/login` in middleware:
  // middleware cannot verify whether the user account is active in the database.
  // Stale session claims in cookies would cause infinite ping-pong redirect loops
  // between middleware and requireSession(). LoginPage server component handles
  // genuine session redirection safely.
  if (pathname === '/' || pathname === '/login') return NextResponse.next();

  if (!requiredRoles) return NextResponse.next();

  if (!claims) {
    const url = new URL('/login', request.url);
    if (pathname && pathname !== '/login' && !pathname.startsWith('/login')) {
      url.searchParams.set('next', pathname);
    }
    const res = NextResponse.redirect(url);
    if (rawCookie) {
      res.cookies.delete(SESSION_COOKIE);
    }
    return res;
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
