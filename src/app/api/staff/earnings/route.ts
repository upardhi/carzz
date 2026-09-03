import { NextResponse } from 'next/server';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { computePayout } from '@/lib/services/payroll';
import { currentCycle } from '@/lib/util/format';

export async function GET(request: Request) {
  try {
    const session = await requireApiSession('pocket:request');
    if (!session.user.staffId) {
      throw new HttpError(403, 'This account is not linked to a staff record.');
    }

    const { searchParams } = new URL(request.url);
    const cycle = searchParams.get('cycle') || currentCycle();

    const store = await getStore();
    const payout = await computePayout(store, session.user.staffId, cycle);
    const rules = await store.getPayoutSettings();

    return NextResponse.json({
      ok: true,
      cycle,
      payout,
      rules,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error computing staff earnings:', error);
    return NextResponse.json(
      { error: 'Could not fetch staff earnings details.' },
      { status: 500 },
    );
  }
}
