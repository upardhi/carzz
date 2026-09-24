import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import type { CustomerRequestType } from '@/lib/data/types';

const createRequestSchema = z.object({
  type: z.enum(['PACKAGE_CHANGE', 'ONE_WASH', 'OTHER_SERVICE']),
  carId: z.string().optional().nullable(),
  requestedPackageId: z.string().optional().nullable(),
  washType: z.string().optional().nullable(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  preferredTime: z.string().optional().nullable(),
  serviceDetails: z.string().max(500).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function GET() {
  try {
    const session = await requireApiSession('self:cars');
    if (!session.user.customerId) {
      throw new HttpError(403, 'Customer account required.');
    }

    const store = await getStore();
    const requests = await store.customerRequests.find({
      where: { customerId: session.user.customerId },
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
      limit: 20,
    });

    const [packages, cars] = await Promise.all([
      store.packages.find(),
      store.cars.find({ where: { customerId: session.user.customerId } }),
    ]);

    const packageMap = new Map(packages.map((p) => [p.id, p]));
    const carMap = new Map(cars.map((c) => [c.id, c]));

    const enriched = requests.map((r) => ({
      ...r,
      car: r.carId ? carMap.get(r.carId) : null,
      currentPackage: r.currentPackageId ? packageMap.get(r.currentPackageId) : null,
      requestedPackage: r.requestedPackageId ? packageMap.get(r.requestedPackageId) : null,
    }));

    return NextResponse.json({ ok: true, requests: enriched });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed to fetch requests.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('self:cars');
    if (!session.user.customerId) {
      throw new HttpError(403, 'Customer account required.');
    }

    const body = await request.json().catch(() => null);
    const parsed = createRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request details.' },
        { status: 400 },
      );
    }

    const store = await getStore();
    const customer = await store.customers.get(session.user.customerId);
    if (!customer) throw new HttpError(404, 'Customer account not found.');

    let currentPackageId: string | null = null;
    if (parsed.data.carId) {
      const car = await store.cars.get(parsed.data.carId);
      if (car && car.customerId === customer.id) {
        currentPackageId = car.packageId;
      }
    }

    const created = await store.customerRequests.create({
      customerId: customer.id,
      carId: parsed.data.carId ?? null,
      type: parsed.data.type as CustomerRequestType,
      status: 'PENDING',
      currentPackageId,
      requestedPackageId: parsed.data.requestedPackageId ?? null,
      washType: parsed.data.washType ?? null,
      preferredDate: parsed.data.preferredDate ?? null,
      preferredTime: parsed.data.preferredTime ?? null,
      serviceDetails: parsed.data.serviceDetails ?? null,
      assignedStaffId: null,
      notes: parsed.data.notes ?? null,
      adminRemarks: null,
      paymentStatus: 'PENDING',
      paymentAmount: null,
      createdAt: new Date().toISOString(),
      decidedAt: null,
      decidedByUserId: null,
    });

    return NextResponse.json({
      ok: true,
      request: created,
      message: 'Your request has been submitted to your area manager for review.',
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed to submit request.' }, { status: 500 });
  }
}
