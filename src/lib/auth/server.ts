import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getStore } from '../data';
import type { User } from '../data/types';
import {
  buildScope,
  can,
  homeFor,
  type AccessScope,
  type Permission,
} from './rbac';
import { SESSION_COOKIE, verifySession, type SessionClaims } from './session';

export interface Session {
  claims: SessionClaims;
  user: User;
  scope: AccessScope;
}

/** Reads and validates the session cookie. Null when signed out. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return null;

  const store = await getStore();
  const user = await store.users.get(claims.sub);
  // A cookie outliving its user (deactivated, deleted) must not grant access.
  if (!user || !user.active) return null;

  const areas = await store.areas.find();
  return { claims, user, scope: buildScope(user, areas) };
}

/** Session or redirect to sign-in. Use at the top of every protected page. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

/**
 * Session plus a permission check. Sends an authenticated user who lacks the
 * permission to their own home rather than to sign-in, which would look like a
 * session bug to them.
 */
export async function requirePermission(
  permission: Permission,
): Promise<Session> {
  const session = await requireSession();
  if (!can(session.user.role, permission)) {
    redirect(homeFor(session.user.role));
  }
  return session;
}

/** Permission check for route handlers: throws instead of redirecting. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireApiSession(
  permission?: Permission,
): Promise<Session> {
  const session = await getSession();
  if (!session) throw new HttpError(401, 'Not signed in');
  if (permission && !can(session.user.role, permission)) {
    throw new HttpError(403, `Missing permission: ${permission}`);
  }
  return session;
}
