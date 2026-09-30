import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { recordPayment } from '@/lib/services/accounts';
import { currentCycle } from '@/lib/util/format';
import { assertInScope, opsError } from '../_guard';

function revalidatePaymentPages() {
  try {
    for (const base of ['/admin', '/manager', '/area']) {
      revalidatePath(`${base}/customers`);
      revalidatePath(`${base}/customers/[customerId]`, 'page');
    }
    revalidatePath('/admin/accounting');
    revalidatePath('/admin');
    // A payment an admin/manager records or confirms must show up on the
    // customer's own account immediately, not just the console side.
    revalidatePath('/app');
    revalidatePath('/app/payments');
    revalidatePath('/app/cars');
    revalidatePath('/app/help');
  } catch {
    // ignore — running outside a request context
  }
}

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('record'),
    customerId: z.string().min(1),
    amount: z.number().int().positive(),
    mode: z.enum(['CASH', 'MANUAL_UPI', 'GATEWAY']),
    kind: z.enum(['PACKAGE', 'ADVANCE', 'REFUND', 'ADJUSTMENT']).optional(),
    reference: z.string().max(100).optional().nullable(),
    note: z.string().max(300).optional().nullable(),
  }),
  z.object({
    action: z.literal('confirm'),
    paymentId: z.string().min(1),
  }),
  z.object({
    action: z.literal('reject'),
    paymentId: z.string().min(1),
    reason: z.string().max(300).optional(),
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

      revalidatePaymentPages();
      const receiptNo = `RCP-${settled.id.slice(-6).toUpperCase()}`;
      return NextResponse.json({
        ok: true,
        payment: settled,
        receiptNo,
        message: `Payment confirmed successfully. Receipt #${receiptNo}`,
      });
    }

    if (parsed.data.action === 'reject') {
      const payment = await store.payments.get(parsed.data.paymentId);
      if (!payment) throw new HttpError(404, 'Payment not found.');
      assertInScope(session, payment.areaId);
      if (payment.status === 'CONFIRMED') {
        throw new HttpError(400, 'Cannot reject an already confirmed payment.');
      }

      const reasonNote = parsed.data.reason
        ? `Rejection reason: ${parsed.data.reason}`
        : 'Rejected by manager/admin';

      const updated = await store.payments.update(payment.id, {
        status: 'FAILED',
        note: payment.note ? `${payment.note} (${reasonNote})` : reasonNote,
      });

      revalidatePaymentPages();
      return NextResponse.json({
        ok: true,
        payment: updated,
        message: 'Payment rejected. No credit was added to the customer account.',
      });
    }

    const customer = await store.customers.get(parsed.data.customerId);
    if (!customer) throw new HttpError(404, 'Customer not found.');
    assertInScope(session, customer.areaId);

    const payment = await recordPayment(store, {
      customerId: customer.id,
      amount: parsed.data.amount,
      mode: parsed.data.mode,
      kind: parsed.data.kind ?? 'PACKAGE',
      cycle: currentCycle(),
      recordedByUserId: session.user.id,
      reference: parsed.data.reference || null,
      note: parsed.data.note || null,
      status: 'CONFIRMED',
    });

    revalidatePaymentPages();
    const receiptNo = `RCP-${payment.id.slice(-6).toUpperCase()}`;
    return NextResponse.json({
      ok: true,
      payment,
      receiptNo,
      message: `Payment of ₹${payment.amount.toLocaleString('en-IN')} recorded. Receipt #${receiptNo}`,
    });
  } catch (error) {
    return opsError(error);
  }
}
