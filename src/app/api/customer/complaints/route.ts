import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { COMPLAINT_TYPES } from '@/lib/data/types';

const schema = z.object({
  visitId: z.string().optional().nullable(),
  carId: z.string().optional().nullable(),
  type: z.enum(COMPLAINT_TYPES),
  body: z.string().trim().min(5, 'Please tell us what happened.').max(1000),
});

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('self:feedback');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }
    if (!session.user.customerId) {
      throw new HttpError(403, 'This account has no customer record.');
    }

    const store = await getStore();
    const customer = await store.customers.get(session.user.customerId);
    if (!customer) throw new HttpError(404, 'Customer record not found.');

    let targetVisit: Awaited<ReturnType<typeof store.visits.get>> = null;

    // 1. If explicit visitId is provided, link to that exact wash
    if (parsed.data.visitId) {
      const visit = await store.visits.get(parsed.data.visitId);
      if (visit && visit.customerId === customer.id) {
        targetVisit = visit;
      }
    }

    // 2. If no exact visitId, search by carId or latest visit
    if (!targetVisit) {
      if (parsed.data.carId) {
        targetVisit =
          (await store.visits.findOne({
            where: { customerId: customer.id, carId: parsed.data.carId, status: 'DONE' },
            orderBy: [{ field: 'scheduledDate', dir: 'desc' }],
          })) ||
          (await store.visits.findOne({
            where: { customerId: customer.id, carId: parsed.data.carId },
            orderBy: [{ field: 'scheduledDate', dir: 'desc' }],
          }));
      } else {
        targetVisit =
          (await store.visits.findOne({
            where: { customerId: customer.id, status: 'DONE' },
            orderBy: [{ field: 'scheduledDate', dir: 'desc' }],
          })) ||
          (await store.visits.findOne({
            where: { customerId: customer.id },
            orderBy: [{ field: 'scheduledDate', dir: 'desc' }],
          }));
      }
    }

    const complaint = await store.complaints.create({
      customerId: customer.id,
      areaId: customer.areaId,
      staffId: targetVisit?.staffId ?? null,
      visitId: targetVisit?.id ?? null,
      type: parsed.data.type,
      body: parsed.data.body,
      status: 'OPEN',
      resolution: null,
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      handledByUserId: null,
    });

    return NextResponse.json({
      ok: true,
      complaint,
      message: 'Complaint submitted to your area manager. You can track resolutions in Help & Support.',
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Could not send your complaint.' },
      { status: 500 },
    );
  }
}
