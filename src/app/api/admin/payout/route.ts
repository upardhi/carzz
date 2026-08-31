import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { approvePayout, computePayout, computePayoutRun } from '@/lib/services/payroll';
import { money } from '@/lib/util/format';

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approveOne'),
    staffId: z.string().min(1),
    cycle: z.string().regex(/^\d{4}-\d{2}$/),
  }),
  z.object({
    action: z.literal('approveAll'),
    cycle: z.string().regex(/^\d{4}-\d{2}$/),
  }),
  z.object({
    action: z.literal('hold'),
    staffId: z.string().min(1),
    cycle: z.string().regex(/^\d{4}-\d{2}$/),
  }),
]);

/**
 * Payout approval.
 *
 * The system calculates every line; the owner approves. Nothing is treated as
 * payable until that happens, which is why approval writes a snapshot rather
 * than leaving the payout as a live calculation that could drift afterwards.
 */
export async function POST(request: Request) {
  try {
    const session = await requireApiSession('payout:approve');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const store = await getStore();

    if (parsed.data.action === 'approveAll') {
      const run = await computePayoutRun(store, parsed.data.cycle, null);
      const pending = run.filter((p) => p.status === 'DRAFT');
      for (const payout of pending) {
        await approvePayout(store, payout, session.user.id);
      }
      const total = pending.reduce((sum, p) => sum + p.net, 0);

      return NextResponse.json({
        ok: true,
        approved: pending.length,
        message: pending.length
          ? `Approved ${pending.length} staff · ${money(total)}. Payment advice generated.`
          : 'Everyone was already approved for this month.',
      });
    }

    const payout = await computePayout(store, parsed.data.staffId, parsed.data.cycle);

    if (parsed.data.action === 'hold') {
      const existing = await store.payouts.findOne({
        where: { staffId: parsed.data.staffId, cycle: parsed.data.cycle },
      });
      const held = { ...payout, status: 'HELD' as const };
      const saved = existing
        ? await store.payouts.update(existing.id, held)
        : await store.payouts.create(held);
      return NextResponse.json({
        ok: true,
        payout: saved,
        message: 'Held. This one will not be paid until you release it.',
      });
    }

    if (payout.status === 'APPROVED') {
      throw new HttpError(409, 'That payout is already approved.');
    }

    const saved = await approvePayout(store, payout, session.user.id);
    return NextResponse.json({
      ok: true,
      payout: saved,
      message: `Approved · ${money(saved.net)}.`,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Could not process that payout.' },
      { status: 500 },
    );
  }
}
