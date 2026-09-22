import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';

async function signOut(request: Request) {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);

  const url = new URL(request.url);
  const next = url.searchParams.get('next');
  const target = new URL('/login', request.url);

  if (
    next &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.startsWith('/login') &&
    !next.startsWith('/api/')
  ) {
    target.searchParams.set('next', next);
  }

  return NextResponse.redirect(target, {
    // 303 so the browser follows with GET after the POST form submit.
    status: 303,
  });
}

export const POST = signOut;
export const GET = signOut;
