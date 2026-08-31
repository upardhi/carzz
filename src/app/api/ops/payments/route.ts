import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { recordPayment } from '@/lib/services/accounts';
import { currentCycle } from '@/lib/util/format';
import { assertInScope, opsError } from '../_guard';

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('record'),
    customerId: z.string().min(1),
    amount: z.number().int().positive(),
    mode: z.enum(['CASH', 'MANUAL_UPI', 'GATEWAY']),
    note: z.string().max(300).optional(),
  }),
  z.object({
    action: z.literal('confirm'),
    paymentId: z.string().min(1),
  }),
]);

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('payment:record');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const store = await getStore();

    if (parsed.data.action === 'confirm') {
      const payment = await store.payments.get(parsed.data.paymentId);
      if (!payment) throw new HttpError(404, 'Payment not found.');
      assertInScope(session, payment.areaId);
      if (payment.status === 'CONFIRMED') {
        return NextResponse.json({ ok: true, payment });
      }

      // Confirming a declared cash or UPI payment is what actually settles it
      // against the customer's invoices, so re-run it through recordPayment
      // rather than just flipping a flag.
      await store.payments.delete(payment.id);
      const settled = await recordPayment(store, {
        customerId: payment.customerId,
        amount: payment.amount,
        mode: payment.mode,
        kind: payment.kind,
        cycle: payment.cycle,
        recordedByUserId: session.user.id,
        note: payment.note,
        reference: payment.reference,
        status: 'CONFIRMED',
      });

      return NextResponse.json({
        ok: true,
        payment: settled,
        message: 'Payment confirmed and receipt sent.',
      });
    }

    const customer = await store.customers.get(parsed.data.customerId);
    if (!customer) throw new HttpError(404, 'Customer not found.');
    assertInScope(session, customer.areaId);

    const payment = await recordPayment(store, {
      customerId: customer.id,
      amount: parsed.data.amount,
      mode: parsed.data.mode,
      cycle: currentCycle(),
      recordedByUserId: session.user.id,
      note: parsed.data.note,
      status: 'CONFIRMED',
    });

    return NextResponse.json({
      ok: true,
      payment,
      message: 'Payment recorded and receipt sent.',
    });
  } catch (error) {
    return opsError(error);
  }
}
