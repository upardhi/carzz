import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import {
  LEAD_SOURCES,
  WEEKDAY_PATTERNS,
  type Customer,
} from '@/lib/data/types';
import { recordPayment } from '@/lib/services/accounts';
import { generateVisitsForCar } from '@/lib/services/schedule';
import { currentCycle, todayISO } from '@/lib/util/format';
import { assertInScope, opsError } from '../_guard';

const carSchema = z.object({
  model: z.string().trim().min(1),
  make: z.string().trim().min(1),
  colour: z.string().trim().min(1),
  plate: z.string().trim().min(4),
  packageId: z.string().min(1),
  scheduleTime: z.string().regex(/^\d{2}:\d{2}$/),
  specialInstructions: z.string().max(300).optional(),
});

const createSchema = z.object({
  action: z.literal('create'),
  // Step 1 of the wizard: the lead source is compulsory, because it is the
  // only way the owner ever learns which marketing actually works.
  source: z.enum(LEAD_SOURCES),
  referredById: z.string().optional(),
  name: z.string().trim().min(2),
  phone: z.string().trim().min(6),
  altPhone: z.string().trim().optional(),
  address: z.string().trim().min(4),
  landmark: z.string().trim().optional(),
  note: z.string().max(300).optional(),
  areaId: z.string().min(1),
  cars: z.array(carSchema).min(1, 'Add at least one car'),
  schedulePattern: z.enum(WEEKDAY_PATTERNS),
  assignedStaffId: z.string().optional(),
  advance: z.number().int().min(0).default(0),
  paymentMode: z.enum(['CASH', 'MANUAL_UPI', 'GATEWAY']).default('CASH'),
});

const statusSchema = z.object({
  action: z.literal('setStatus'),
  customerId: z.string().min(1),
  status: z.enum(['ACTIVE', 'HOLD', 'INACTIVE']),
  holdUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const schema = z.discriminatedUnion('action', [createSchema, statusSchema]);

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('customer:create');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' },
        { status: 400 },
      );
    }
    const store = await getStore();

    if (parsed.data.action === 'setStatus') {
      const customer = await store.customers.get(parsed.data.customerId);
      if (!customer) throw new HttpError(404, 'Customer not found.');
      assertInScope(session, customer.areaId);

      const updated = await store.customers.update(customer.id, {
        status: parsed.data.status,
        holdUntil:
          parsed.data.status === 'HOLD' ? (parsed.data.holdUntil ?? null) : null,
      });

      // Pausing an account must also pause the work, or wash boys keep turning
      // up at a house that is no longer paying.
      if (parsed.data.status !== 'ACTIVE') {
        await store.visits.updateMany(
          {
            customerId: customer.id,
            status: 'PENDING',
            scheduledDate: { gte: todayISO() },
          } as never,
          { staffId: null },
        );
      }

      return NextResponse.json({ ok: true, customer: updated });
    }

    const data = parsed.data;
    assertInScope(session, data.areaId);

    const cycle = currentCycle();
    const customer = await store.customers.create({
      userId: null,
      areaId: data.areaId,
      name: data.name,
      phone: data.phone,
      altPhone: data.altPhone || null,
      address: data.address,
      landmark: data.landmark || null,
      lat: null,
      lng: null,
      source: data.source,
      referredById: data.referredById || null,
      status: 'ACTIVE',
      holdUntil: null,
      note: data.note || null,
      joinedOn: todayISO(),
    } as Omit<Customer, 'id'>);

    let monthly = 0;
    for (const input of data.cars) {
      const pkg = await store.packages.get(input.packageId);
      if (!pkg) throw new HttpError(400, 'Unknown package on one of the cars.');
      monthly += pkg.price;

      const car = await store.cars.create({
        customerId: customer.id,
        model: input.model,
        make: input.make,
        colour: input.colour,
        plate: input.plate.toUpperCase(),
        packageId: input.packageId,
        assignedStaffId: data.assignedStaffId || null,
        schedulePattern: data.schedulePattern,
        scheduleTime: input.scheduleTime,
        specialInstructions: input.specialInstructions || null,
        active: true,
      });

      // Saving the customer creates the month's visits, so the wash boy's
      // route is populated the same day rather than the next month.
      await generateVisitsForCar(store, car, customer, cycle);
    }

    await store.invoices.create({
      customerId: customer.id,
      areaId: customer.areaId,
      cycle,
      amount: monthly,
      dueOn: `${cycle}-05`,
      paidAmount: 0,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    });

    if (data.advance > 0) {
      await recordPayment(store, {
        customerId: customer.id,
        amount: data.advance,
        mode: data.paymentMode,
        kind: 'ADVANCE',
        cycle,
        recordedByUserId: session.user.id,
        note: 'Opening advance',
      });
    }

    const visits = await store.visits.count({ customerId: customer.id, cycle });

    return NextResponse.json({
      ok: true,
      customer,
      message: `Saved. ${visits} wash ${visits === 1 ? 'visit' : 'visits'} generated for this month.`,
    });
  } catch (error) {
    return opsError(error);
  }
}
