import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { recordPayment } from '@/lib/services/accounts';
import { currentCycle } from '@/lib/util/format';

const schema = z.object({
  amount: z.number().int().positive(),
  mode: z.enum(['CASH', 'MANUAL_UPI', 'GATEWAY']),
  reference: z.string().optional(),
  requestId: z.string().optional(),
  description: z.string().optional(),
  note: z.string().optional(),
});

/**
 * A customer-initiated payment.
 *
 * None of these confirm themselves: there is no payment-gateway webhook wired
 * up to verify money actually moved, so a "GATEWAY" mode here is still just
 * the customer's own say-so, same as cash or manual UPI. Every mode is
 * recorded as PENDING until a manager confirms it — auto-confirming a
 * self-reported gateway payment would let anyone grant themselves account
 * credit for free.
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

    const noteText = [
      parsed.data.description ? `For: ${parsed.data.description}` : null,
      parsed.data.note || 'Declared by customer, awaiting manager confirmation',
    ]
      .filter(Boolean)
      .join(' · ');

    const payment = await recordPayment(store, {
      customerId: session.user.customerId,
      amount: parsed.data.amount,
      mode: parsed.data.mode,
      cycle: parsed.data.description ? `ONE-TIME (${parsed.data.description})` : currentCycle(),
      recordedByUserId: session.user.id,
      status: 'PENDING',
      reference: parsed.data.reference || (parsed.data.mode === 'CASH' ? 'CASH-PAYMENT' : undefined),
      note: noteText,
    });

    return NextResponse.json({
      ok: true,
      payment,
      message:
        parsed.data.mode === 'CASH'
          ? 'Noted. Please hand the cash to your wash boy on the next visit.'
          : 'Noted. Your manager will confirm the payment shortly.',
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
