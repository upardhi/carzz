import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';

async function signOut(request: Request) {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return NextResponse.redirect(new URL('/login', request.url), {
    // 303 so the browser follows with GET after the POST form submit.
    status: 303,
  });
}

export const POST = signOut;
export const GET = signOut;
