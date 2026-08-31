import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { COMPLAINT_TYPES } from '@/lib/data/types';

const schema = z.object({
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

    // Attach the most recent completed wash so the manager opens the complaint
    // with the photos and the wash boy already in front of them.
    const lastVisit = await store.visits.findOne({
      where: { customerId: customer.id, status: 'DONE' },
      orderBy: [{ field: 'scheduledDate', dir: 'desc' }],
    });

    const complaint = await store.complaints.create({
      customerId: customer.id,
      areaId: customer.areaId,
      staffId: lastVisit?.staffId ?? null,
      visitId: lastVisit?.id ?? null,
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
      message: 'Sent to your area manager. You will get a reply here.',
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
