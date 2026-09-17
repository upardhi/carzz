import 'server-only';

import { cache } from 'react';
import { cookies, headers } from 'next/headers';
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

/** Reads and validates the session cookie or Bearer token. Null when signed out. */
export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  let token = jar.get(SESSION_COOKIE)?.value;

  if (!token) {
    const head = await headers();
    const authHeader = head.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  const claims = await verifySession(token);
  if (!claims) return null;

  try {
    const store = await getStore();
    const user = await store.users.get(claims.sub);
    // A cookie outliving its user (deactivated, deleted) must not grant access.
    if (!user || !user.active) return null;

    // Only AREA_ADMIN uses the areas table to map its region; other roles
    // determine their scope directly from the user record.
    const areas = user.role === 'AREA_ADMIN' ? await store.areas.find() : [];
    return { claims, user, scope: buildScope(user, areas) };
  } catch (err) {
    console.warn('[Offline/DB Connection] Unable to reach database for session user validation. Using claims fallback:', err);
    const fallbackUser: User = {
      id: claims.sub,
      role: claims.role,
      name: claims.name,
      email: '',
      phone: '',
      active: true,
      regionId: claims.regionId ?? null,
      areaId: claims.areaId ?? null,
      customerId: claims.customerId ?? null,
      staffId: claims.staffId ?? null,
      language: claims.language ?? 'en',
      createdAt: new Date().toISOString(),
    };
    return { claims, user: fallbackUser, scope: buildScope(fallbackUser, []) };
  }
});

/** Session or redirect to sign-in. Use at the top of every protected page. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    try {
      const jar = await cookies();
      jar.delete(SESSION_COOKIE);
    } catch {
      /* cookies already committed */
    }
    redirect('/login');
  }
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
