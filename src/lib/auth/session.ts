import { SignJWT, jwtVerify } from 'jose';
import type { Id, Language, Role } from '../data/types';

export const SESSION_COOKIE = 'carzz_session';
const ISSUER = 'carzz';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days — these are field devices.

/** The claims carried in the session cookie. Small on purpose. */
export interface SessionClaims {
  sub: Id;
  name: string;
  role: Role;
  regionId: Id | null;
  areaId: Id | null;
  customerId: Id | null;
  staffId: Id | null;
  language: Language;
}

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 24) {
    throw new Error(
      'AUTH_SECRET is missing or too short. Generate one with:\n' +
        '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
    );
  }
  return new TextEncoder().encode(value);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(
  token: string | undefined,
): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER });
    return payload as unknown as SessionClaims;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: MAX_AGE_SECONDS,
};
