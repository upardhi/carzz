import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

/**
 * scrypt password hashing, stored as `scrypt$<saltHex>$<hashHex>`.
 *
 * Node's crypto is used rather than bcrypt so there is no native build step —
 * the app installs and runs the same way on a laptop, a container and a
 * serverless runtime.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  // Seeded demo accounts carry a plain marker so the dataset stays readable.
  // The first successful sign-in replaces it with a real hash.
  if (stored.startsWith('seed:')) return stored.slice(5) === password;

  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isSeedCredential(stored: string): boolean {
  return stored.startsWith('seed:');
}
