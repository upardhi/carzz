import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';

/**
 * One URL that says whether a deployment is actually configured.
 *
 * A misconfigured host fails as an opaque 500 on whatever page the user
 * happens to open, which tells them nothing. This names the cause instead:
 * which store is in use, whether the session secret is usable, whether the
 * database answers, and whether it has anything in it.
 *
 * It reports states, never values — no connection string, no secret, nothing
 * that would be worth reading if the URL were found.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const provider = process.env.DATA_PROVIDER ?? 'memory';
  const secret = process.env.AUTH_SECRET ?? '';

  const health = {
    ok: false,
    provider,
    // The store is per-process, so on the in-memory provider every instance
    // holds its own copy and saves do not survive being recycled.
    storage: provider === 'memory' ? 'in-memory (data is not saved)' : 'database',
    authSecret: !secret
      ? 'missing — set AUTH_SECRET'
      : secret.length < 24
        ? 'too short — needs 24 characters or more'
        : 'ok',
    database: 'not applicable',
    accounts: 0,
    detail: '',
  };

  try {
    const store = await getStore();
    health.accounts = await store.users.count();
    health.database = provider === 'memory' ? 'not applicable' : 'connected';
    if (health.accounts === 0) {
      health.detail = 'No accounts yet. Redeploy to let the build seed it.';
    }
  } catch (error) {
    health.database = 'unreachable';
    health.detail = error instanceof Error ? error.message : String(error);
  }

  health.ok =
    health.authSecret === 'ok' &&
    health.database !== 'unreachable' &&
    health.accounts > 0;

  return NextResponse.json(health, { status: health.ok ? 200 : 503 });
}
