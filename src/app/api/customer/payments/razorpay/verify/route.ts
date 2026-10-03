import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { recordPayment } from '@/lib/services/accounts';
import { verifyRazorpaySignature } from '@/lib/services/razorpay';
import { currentCycle, money } from '@/lib/util/format';

const schema = z.object({
  amount: z.number().int().positive(),
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
  requestId: z.string().optional(),
  description: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('self:payments');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid verification payload.' }, { status: 400 });
    }

    if (!session.user.customerId) {
      throw new HttpError(403, 'This account has no associated customer record.');
    }

    const { amount, razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

    // Verify cryptographic signature
    const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Payment signature verification failed. Untrusted response.' },
        { status: 400 },
      );
    }

    const store = await getStore();
    const customer = await store.customers.get(session.user.customerId);
    if (!customer) {
      throw new HttpError(404, 'Customer account was not found.');
    }

    // Check if this payment was already registered to prevent duplicates
    const existing = await store.payments.find({
      where: {
        reference: razorpayPaymentId,
      } as never,
    });
    if (existing.length > 0) {
      return NextResponse.json({
        ok: true,
        payment: existing[0],
        message: 'This payment has already been recorded.',
      });
    }

    const noteText = parsed.data.description
      ? `Online Razorpay Payment: ${parsed.data.description} (Order: ${razorpayOrderId}, Txn: ${razorpayPaymentId}) — Awaiting Admin/Manager Approval`
      : `Online Razorpay Payment (Order: ${razorpayOrderId}, Txn: ${razorpayPaymentId}) — Awaiting Admin/Manager Approval`;

    const payment = await recordPayment(store, {
      customerId: customer.id,
      amount,
      mode: 'GATEWAY',
      cycle: parsed.data.description ? `ONE-TIME (${parsed.data.description})` : currentCycle(),
      recordedByUserId: session.user.id,
      status: 'PENDING',
      reference: razorpayPaymentId,
      note: noteText,
    });

    return NextResponse.json({
      ok: true,
      payment,
      message: `Payment of ${money(amount)} captured successfully via Razorpay (Txn ID: ${razorpayPaymentId}). Awaiting manager/admin approval before credit is added to your account.`,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not verify online payment.' },
      { status: 500 },
    );
  }
}
