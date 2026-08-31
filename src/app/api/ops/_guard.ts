import 'server-only';

import { NextResponse } from 'next/server';
import { HttpError, type Session } from '@/lib/auth/server';
import { WashRuleError } from '@/lib/services/visits';

/**
 * Every ops write must prove the record is inside the caller's areas.
 *
 * This is the enforcement point for the separation the client cares about: an
 * area manager physically cannot act on another area's customer, even by
 * crafting the request, because the area is checked against the session's
 * scope rather than taken from the payload.
 */
export function assertInScope(session: Session, areaId: string): void {
  if (session.scope.areaIds === null) return;
  if (!session.scope.areaIds.includes(areaId)) {
    throw new HttpError(403, 'That record is outside the areas you manage.');
  }
}

/** Uniform error handling so every ops route responds the same way. */
export function opsError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof WashRuleError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const message =
    error instanceof Error ? error.message : 'Something went wrong.';
  return NextResponse.json({ error: message }, { status: 500 });
}
