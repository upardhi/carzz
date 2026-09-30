import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { createRazorpayOrder } from '@/lib/services/razorpay';

const schema = z.object({
  amount: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('self:payments');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payment amount requested.' }, { status: 400 });
    }

    if (!session.user.customerId) {
      throw new HttpError(403, 'This account has no associated customer record.');
    }

    const store = await getStore();
    const customer = await store.customers.get(session.user.customerId);
    if (!customer) {
      throw new HttpError(404, 'Customer account was not found.');
    }

    const settings = await store.getAppSettings();
    if (!settings.paymentModesEnabled.includes('GATEWAY')) {
      throw new HttpError(400, 'Online payment gateway is currently disabled.');
    }

    const order = await createRazorpayOrder({
      amount: parsed.data.amount,
      currency: 'INR',
      receipt: `rcpt_${customer.id.slice(-6)}_${Date.now()}`,
      notes: {
        customerId: customer.id,
        areaId: customer.areaId,
        customerName: customer.name,
      },
    });

    return NextResponse.json({
      ok: true,
      orderId: order.orderId,
      amount: parsed.data.amount, // in rupees
      amountPaise: order.amount,
      currency: order.currency,
      keyId: order.keyId,
      isMock: order.isMock ?? false,
      customer: {
        name: customer.name,
        phone: customer.phone,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not initialize online payment.' },
      { status: 500 },
    );
  }
}
