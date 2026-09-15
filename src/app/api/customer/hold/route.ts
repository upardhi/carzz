import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { formatDateFull } from '@/lib/util/format';
import type { DateOnly } from '@/lib/data/types';

const toIso = (d: Date) => d.toISOString().slice(0, 10);

const HoldRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('pause'),
    holdUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    note: z.string().optional(),
  }),
  z.object({
    action: z.literal('resume'),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession('self:cars');
    if (!session.user.customerId) {
      throw new HttpError(403, 'This account is not linked to a customer record.');
    }

    const body = await request.json();
    const parsed = HoldRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body.', details: parsed.error.format() },
        { status: 400 },
      );
    }

    const store = await getStore();
    const customer = await store.customers.get(session.user.customerId);
    if (!customer) {
      throw new HttpError(404, 'Customer account not found.');
    }

    const today = toIso(new Date());

    if (parsed.data.action === 'pause') {
      const holdUntil = parsed.data.holdUntil as DateOnly;
      if (holdUntil <= today) {
        throw new HttpError(400, 'Vacation end date must be in the future.');
      }

      // Update customer status to HOLD
      const updatedCustomer = await store.customers.update(customer.id, {
        status: 'HOLD',
        holdUntil,
        note: parsed.data.note || 'Vacation hold requested via customer app',
      });

      // Find any pending visits during the hold window and mark them skipped so they remain in customer quota
      const pendingVisits = await store.visits.find({
        where: {
          customerId: customer.id,
          status: 'PENDING',
        } as never,
      });

      const visitsInHold = pendingVisits.filter(
        (v) => v.scheduledDate >= today && v.scheduledDate <= holdUntil,
      );

      for (const visit of visitsInHold) {
        await store.visits.update(visit.id, {
          status: 'MISSED',
          missReason: 'CUSTOMER_SKIPPED',
          missNote: `Vacation pause until ${holdUntil}`,
        });
      }

      return NextResponse.json({
        ok: true,
        message: `Subscription paused until ${formatDateFull(holdUntil)}. Your washes will resume automatically.`,
        customer: updatedCustomer,
        pausedVisitsCount: visitsInHold.length,
      });
    }

    if (parsed.data.action === 'resume') {
      const updatedCustomer = await store.customers.update(customer.id, {
        status: 'ACTIVE',
        holdUntil: null,
      });

      return NextResponse.json({
        ok: true,
        message: 'Subscription resumed successfully. Your regular wash schedule is active.',
        customer: updatedCustomer,
      });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error handling customer hold action:', error);
    return NextResponse.json(
      { error: 'Could not update vacation hold status.' },
      { status: 500 },
    );
  }
}
