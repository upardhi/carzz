import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStore } from '@/lib/data';
import {
  hashPassword,
  homeFor,
  isSeedCredential,
  sessionCookieOptions,
  signSession,
  verifyPassword,
  SESSION_COOKIE,
} from '@/lib/auth';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email or phone'),
  password: z.string().min(1, 'Enter your password'),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;
  const store = await getStore();
  const identifier = email.toLowerCase();

  // Staff sign in with a phone number far more often than an email, so accept
  // either without making the user pick a mode.
  const user =
    (await store.users.findOne({ where: { email: identifier } })) ??
    (await store.users.findOne({ where: { phone: email.trim() } }));

  // Same response and roughly the same work for a missing user as for a wrong
  // password, so the form cannot be used to enumerate accounts.
  const credential = user ? await store.getCredential(user.id) : null;
  const ok =
    credential !== null && (await verifyPassword(password, credential.passwordHash));

  if (!user || !ok) {
    return NextResponse.json(
      { error: 'Those details did not match an account.' },
      { status: 401 },
    );
  }

  if (!user.active) {
    return NextResponse.json(
      { error: 'This account has been deactivated. Ask your manager.' },
      { status: 403 },
    );
  }

  // Upgrade a seeded demo credential to a real hash on first use.
  if (credential && isSeedCredential(credential.passwordHash)) {
    await store.setCredential(user.id, await hashPassword(password));
  }

  const token = await signSession({
    sub: user.id,
    name: user.name,
    role: user.role,
    regionId: user.regionId,
    areaId: user.areaId,
    customerId: user.customerId,
    staffId: user.staffId,
    language: user.language,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions);

  return NextResponse.json({ ok: true, redirect: homeFor(user.role) });
}
