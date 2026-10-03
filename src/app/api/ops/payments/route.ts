import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { loadCustomerAccount, recordPayment } from '@/lib/services/accounts';
import { notifyPaymentApproved } from '@/lib/services/whatsappNotifications';
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
    amount: z.number().int().positive('Amount must be positive'),
    mode: z.enum(['CASH', 'MANUAL_UPI', 'GATEWAY']),
    kind: z.enum(['PACKAGE', 'ADVANCE', 'REFUND', 'ADJUSTMENT']).optional(),
    reference: z.string().trim().min(1, 'Invoice / Receipt number or transaction reference is required.').max(100).optional(),
    receiptNumber: z.string().trim().min(1).max(100).optional(),
    invoiceNumber: z.string().trim().min(1).max(100).optional(),
    note: z.string().max(300).optional().nullable(),
  }),
  z.object({
    action: z.literal('confirm'),
    paymentId: z.string().min(1),
    reference: z.string().trim().min(1).max(100).optional(),
    receiptNumber: z.string().trim().min(1).max(100).optional(),
    invoiceNumber: z.string().trim().min(1).max(100).optional(),
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
    const raw = await request.json().catch(() => null);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message ?? 'Invalid payment data provided.' },
        { status: 400 },
      );
    }
    const store = await getStore();

    if (parsed.data.action === 'confirm') {
      const payment = await store.payments.get(parsed.data.paymentId);
      if (!payment) throw new HttpError(404, 'Payment not found.');
      assertInScope(session, payment.areaId);
      if (payment.status === 'CONFIRMED') {
        return NextResponse.json({ ok: true, payment });
      }

      const receiptOrInvoiceRef =
        (parsed.data.receiptNumber || parsed.data.invoiceNumber || parsed.data.reference || payment.reference || '').trim();

      if (!receiptOrInvoiceRef) {
        throw new HttpError(400, 'Invoice number or Receipt / Reference number is required to confirm payment.');
      }

      // Check if reference is duplicate among confirmed payments
      const existingWithRef = await store.payments.find({
        where: { reference: receiptOrInvoiceRef } as never,
      });
      const duplicate = existingWithRef.find((p) => p.id !== payment.id && p.status === 'CONFIRMED');
      if (duplicate) {
        throw new HttpError(409, `Payment reference / receipt "${receiptOrInvoiceRef}" is already recorded on another payment.`);
      }

      // Confirming a declared cash or UPI payment marks it CONFIRMED in place
      // preserving the unique Payment ID, and loadCustomerAccount reconciles the ledger.
      const settled = await store.payments.update(payment.id, {
        status: 'CONFIRMED',
        reference: receiptOrInvoiceRef,
        recordedByUserId: session.user.id,
      });
      await loadCustomerAccount(store, payment.customerId, payment.cycle);

      revalidatePaymentPages();
      const receiptNo = settled.reference || `RCP-${settled.id.slice(-6).toUpperCase()}`;

      // Dispatch WhatsApp Payment Approved notification to the customer asynchronously
      notifyPaymentApproved(store, settled, receiptNo).catch((err) =>
        console.error('Failed to dispatch payment approved WhatsApp notification:', err),
      );

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

    // Action === 'record'
    const customer = await store.customers.get(parsed.data.customerId);
    if (!customer) throw new HttpError(404, 'Customer not found.');
    assertInScope(session, customer.areaId);

    const ref = (parsed.data.receiptNumber || parsed.data.invoiceNumber || parsed.data.reference || '').trim();
    if (!ref) {
      throw new HttpError(400, 'Invoice number or Receipt / Reference number is required from backend.');
    }

    const existingRef = await store.payments.find({
      where: { reference: ref } as never,
    });
    if (existingRef.length > 0) {
      throw new HttpError(409, `A payment with reference / receipt "${ref}" has already been recorded.`);
    }

    const payment = await recordPayment(store, {
      customerId: customer.id,
      amount: parsed.data.amount,
      mode: parsed.data.mode,
      kind: parsed.data.kind ?? 'PACKAGE',
      cycle: currentCycle(),
      recordedByUserId: session.user.id,
      reference: ref,
      note: parsed.data.note || null,
      status: 'CONFIRMED',
    });

    revalidatePaymentPages();
    const receiptNo = payment.reference || `RCP-${payment.id.slice(-6).toUpperCase()}`;

    // Dispatch WhatsApp Payment Approved notification to the customer asynchronously
    notifyPaymentApproved(store, payment, receiptNo).catch((err) =>
      console.error('Failed to dispatch payment approved WhatsApp notification:', err),
    );

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
