import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { recordPayment } from '@/lib/services/accounts';
import { currentCycle } from '@/lib/util/format';

const schema = z.object({
  amount: z.number().int().positive(),
  mode: z.enum(['CASH', 'MANUAL_UPI', 'GATEWAY']),
});

/**
 * A customer-initiated payment.
 *
 * Only the gateway path confirms itself. Cash and manual UPI are recorded as
 * PENDING because the money has not actually arrived until a manager confirms
 * it — recording them as paid would put the collection report out of step with
 * the cash box.
 */
export async function POST(request: Request) {
  try {
    const session = await requireApiSession('self:payments');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    if (!session.user.customerId) {
      throw new HttpError(403, 'This account has no customer record.');
    }

    const store = await getStore();
    const settings = await store.getAppSettings();
    if (!settings.paymentModesEnabled.includes(parsed.data.mode)) {
      throw new HttpError(400, 'That payment mode is currently switched off.');
    }

    const payment = await recordPayment(store, {
      customerId: session.user.customerId,
      amount: parsed.data.amount,
      mode: parsed.data.mode,
      cycle: currentCycle(),
      recordedByUserId: session.user.id,
      status: parsed.data.mode === 'GATEWAY' ? 'CONFIRMED' : 'PENDING',
      note:
        parsed.data.mode === 'GATEWAY'
          ? 'Paid online by customer'
          : 'Declared by customer, awaiting manager confirmation',
    });

    return NextResponse.json({
      ok: true,
      payment,
      message:
        parsed.data.mode === 'GATEWAY'
          ? 'Payment received. Your receipt is on the way.'
          : parsed.data.mode === 'CASH'
            ? 'Noted. Please hand the cash to your wash boy on the next visit.'
            : 'Noted. Your manager will confirm the UPI transfer.',
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Could not record that payment.' },
      { status: 500 },
    );
  }
}
