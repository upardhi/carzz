import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { pocketAllowance } from '@/lib/services/payroll';
import { currentCycle, money } from '@/lib/util/format';

const schema = z.object({ amount: z.number().int().positive() });

/**
 * A wash boy asking for an advance against earnings.
 *
 * The cap is checked server-side and the request is stored either way — a
 * request over the limit still reaches the manager, flagged, rather than being
 * silently refused, because the manager may have a good reason to allow it.
 */
export async function POST(request: Request) {
  try {
    const session = await requireApiSession('pocket:request');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Enter an amount.' }, { status: 400 });
    }
    if (!session.user.staffId) {
      throw new HttpError(403, 'This account has no staff record.');
    }

    const store = await getStore();
    const cycle = currentCycle();
    const allowance = await pocketAllowance(store, session.user.staffId, cycle);

    const pending = await store.pocketRequests.findOne({
      where: { staffId: session.user.staffId, status: 'PENDING' },
    });
    if (pending) {
      throw new HttpError(
        409,
        'You already have a request waiting with your manager.',
      );
    }

    const overCap = parsed.data.amount > allowance.available;

    const created = await store.pocketRequests.create({
      staffId: session.user.staffId,
      amount: parsed.data.amount,
      status: 'PENDING',
      requestedAt: new Date().toISOString(),
      decidedAt: null,
      decidedByUserId: null,
      overrodeCap: overCap,
      note: overCap
        ? `Over the weekly limit of ${money(allowance.available)}`
        : null,
    });

    return NextResponse.json({
      ok: true,
      request: created,
      message: overCap
        ? `Sent — but it is above your ${money(allowance.available)} limit, so your manager has to approve it specially.`
        : 'Sent to your area manager for approval.',
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Could not send that request.' },
      { status: 500 },
    );
  }
}
