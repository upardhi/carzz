import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { hashPassword } from '@/lib/auth/password';
import { getStore } from '@/lib/data';
import type { DataStore } from '@/lib/data/ports/store';
import {
  LEAD_SOURCES,
  WEEKDAYS,
  maxWeeklyDaysForPackage,
  type BillingPeriod,
  type Customer,
  type Car,
} from '@/lib/data/types';
import { loadCustomerAccount, recordPayment } from '@/lib/services/accounts';
import { generateVisitsForCar, plannedServiceFor, rescheduleVisit } from '@/lib/services/schedule';
import { currentCycle, nextCycle, todayISO } from '@/lib/util/format';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import { assertInScope, opsError } from '../_guard';

/** A number plate identifies one real vehicle — two cars must never share one. */
async function assertPlateAvailable(
  store: DataStore,
  plate: string,
  excludeCarId?: string,
): Promise<void> {
  const existing = await store.cars.findOne({ where: { plate } as never });
  if (existing && existing.id !== excludeCarId) {
    throw new HttpError(409, `Plate ${plate} is already registered to another car.`);
  }
}

/** A 4-wash/month package spread across all 7 days front-loads the whole
 * month's quota into the first week — cap the weekly-day count server-side
 * too, since the client's own guardrail can be bypassed by a direct call. */
function assertWeeklyDaysFitPackage(
  weeklyDays: string[],
  pkg: { washesPerMonth: number; billingPeriod?: BillingPeriod; washesPerPeriod?: number },
): void {
  const max = maxWeeklyDaysForPackage(pkg);
  if (weeklyDays.length > max) {
    throw new HttpError(
      400,
      `This package (${pkg.washesPerMonth}/month) allows at most ${max} day${max === 1 ? '' : 's'}/week — ${weeklyDays.length} were selected.`,
    );
  }
}

function revalidateCustomerPages() {
  try {
    for (const base of ['/admin', '/manager', '/area']) {
      revalidatePath(`${base}/customers`);
      revalidatePath(`${base}/customers/[customerId]`, 'page');
      revalidatePath(`${base}/schedule`);
    }
    revalidatePath('/admin/referrals');
    revalidatePath('/area/referrals');
    revalidatePath('/staff/refer');
  } catch {
    // ignore — running outside a request context
  }
}

const weeklyDaysSchema = z.array(z.enum(WEEKDAYS)).min(1, 'Pick at least one wash day.');
const dayServicesSchema = z.record(z.enum(WEEKDAYS), z.string()).optional().nullable();

const carSchema = z.object({
  model: z.string().trim().min(1),
  make: z.string().trim().min(1),
  colour: z.string().trim().min(1),
  plate: z.string().trim().min(4),
  packageId: z.string().min(1, 'Please select a wash package (or create one first)'),
  weeklyDays: weeklyDaysSchema,
  dayServices: dayServicesSchema,
  scheduleTime: z.string().regex(/^\d{2}:\d{2}$/),
  specialInstructions: z.string().max(300).optional(),
});

const createSchema = z.object({
  action: z.literal('create'),
  source: z.enum(LEAD_SOURCES),
  /** The only way a customer can be attributed to a wash boy — picked from
   * that wash boy's own approved StaffReferral, never typed in free-hand,
   * so the bonus payroll.ts pays always traces back to a real, dual-signed
   * referral rather than whoever an admin happened to pick from a list. */
  referralId: z.string().optional(),
  name: z.string().trim().min(2),
  phone: z.string().trim().min(6),
  altPhone: z.string().trim().optional(),
  address: z.string().trim().min(4),
  landmark: z.string().trim().optional(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  note: z.string().max(300).optional(),
  areaId: z.string().min(1),
  cars: z.array(carSchema).min(1, 'Add at least one car'),
  assignedStaffId: z.string().optional(),
  advance: z.number().int().min(0).optional().default(0),
  paymentMode: z.enum(['CASH', 'MANUAL_UPI', 'GATEWAY']).optional().default('CASH'),
  createLogin: z.boolean().optional(),
  loginEmail: z.string().trim().email().optional(),
  loginPassword: z.string().min(6).optional(),
  enquiryId: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

const statusSchema = z.object({
  action: z.literal('setStatus'),
  customerId: z.string().min(1),
  status: z.enum(['ACTIVE', 'HOLD', 'INACTIVE']),
  holdUntil: z.string().optional().nullable(),
});

const createLoginSchema = z.object({
  action: z.literal('createLogin'),
  customerId: z.string().min(1),
  email: z.string().trim().email(),
  password: z.string().min(6),
});

const startCarServiceSchema = z.object({
  action: z.literal('startCarService'),
  customerId: z.string().min(1),
  carId: z.string().min(1),
  assignedStaffId: z.string().optional().nullable(),
  note: z.string().max(300).optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

const updateCustomerSchema = z.object({
  action: z.literal('updateCustomer'),
  customerId: z.string().min(1),
  name: z.string().trim().min(2).optional(),
  phone: z.string().trim().min(6).optional(),
  altPhone: z.string().trim().optional().nullable(),
  address: z.string().trim().min(4).optional(),
  landmark: z.string().trim().optional().nullable(),
  areaId: z.string().min(1).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  note: z.string().max(500).optional().nullable(),
  status: z.enum(['ACTIVE', 'HOLD', 'INACTIVE']).optional(),
});

const updateCarSchema = z.object({
  action: z.literal('updateCar'),
  customerId: z.string().min(1),
  carId: z.string().min(1),
  make: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  colour: z.string().trim().min(1).optional(),
  plate: z.string().trim().min(3).optional(),
  packageId: z.string().min(1).optional(),
  assignedStaffId: z.string().optional().nullable(),
  weeklyDays: weeklyDaysSchema.optional(),
  dayServices: dayServicesSchema,
  scheduleTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  specialInstructions: z.string().max(300).optional().nullable(),
  active: z.boolean().optional(),
});

const addCarSchema = z.object({
  action: z.literal('addCar'),
  customerId: z.string().min(1),
  make: z.string().trim().min(1),
  model: z.string().trim().min(1),
  colour: z.string().trim().min(1),
  plate: z.string().trim().min(3),
  packageId: z.string().min(1, 'Please select a wash package'),
  weeklyDays: weeklyDaysSchema,
  dayServices: dayServicesSchema,
  scheduleTime: z.string().regex(/^\d{2}:\d{2}$/),
  assignedStaffId: z.string().optional().nullable(),
  specialInstructions: z.string().max(300).optional().nullable(),
  autoStartService: z.boolean().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

const deleteCarSchema = z.object({
  action: z.literal('deleteCar'),
  customerId: z.string().min(1),
  carId: z.string().min(1),
});

const adhocWashSchema = z.object({
  action: z.literal('adhocWash'),
  customerId: z.string().min(1),
  carId: z.string().min(1),
  assignedStaffId: z.string().min(1),
  note: z.string().max(300).optional().nullable(),
});

const rescheduleVisitSchema = z.object({
  action: z.literal('rescheduleVisit'),
  customerId: z.string().min(1),
  visitId: z.string().min(1),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  staffId: z.string().optional().nullable(),
});

const schema = z.discriminatedUnion('action', [
  createSchema,
  statusSchema,
  createLoginSchema,
  startCarServiceSchema,
  updateCustomerSchema,
  updateCarSchema,
  addCarSchema,
  rescheduleVisitSchema,
  deleteCarSchema,
  adhocWashSchema,
]);

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

      revalidateCustomerPages();
      return NextResponse.json({ ok: true, customer: updated });
    }

    if (parsed.data.action === 'createLogin') {
      const customer = await store.customers.get(parsed.data.customerId);
      if (!customer) throw new HttpError(404, 'Customer not found.');
      assertInScope(session, customer.areaId);

      const existingUser = await store.users.findOne({
        where: { email: parsed.data.email.toLowerCase() },
      });
      if (existingUser && existingUser.id !== customer.userId) {
        throw new HttpError(409, 'Someone already uses that email.');
      }

      let userId = customer.userId;
      if (userId) {
        await store.users.update(userId, {
          email: parsed.data.email.toLowerCase(),
          phone: customer.phone,
          active: true,
        });
        await store.setCredential(userId, await hashPassword(parsed.data.password));
      } else {
        const user = await store.users.create({
          name: customer.name,
          email: parsed.data.email.toLowerCase(),
          phone: customer.phone,
          role: 'CUSTOMER',
          regionId: null,
          areaId: customer.areaId,
          customerId: customer.id,
          staffId: null,
          language: 'en',
          active: true,
          createdAt: new Date().toISOString(),
        });
        userId = user.id;
        await store.customers.update(customer.id, { userId });
        await store.setCredential(user.id, await hashPassword(parsed.data.password));
      }

      revalidateCustomerPages();
      return NextResponse.json({
        ok: true,
        message: `App login created for ${customer.name} (${parsed.data.email.toLowerCase()}).`,
      });
    }

    if (parsed.data.action === 'startCarService') {
      const customer = await store.customers.get(parsed.data.customerId);
      if (!customer) throw new HttpError(404, 'Customer not found.');
      assertInScope(session, customer.areaId);

      const car = await store.cars.get(parsed.data.carId);
      if (!car || car.customerId !== customer.id) {
        throw new HttpError(404, 'Car not found for this customer.');
      }

      if (car.serviceStarted) {
        revalidateCustomerPages();
        return NextResponse.json({
          ok: true,
          car,
          message: 'Service is already active for this car.',
        });
      }

      const patch: Partial<Car> = {
        serviceStarted: true,
        serviceStartedAt: new Date().toISOString(),
        serviceStartedBeforePayment: true,
        serviceStartedByUserId: session.user.id,
        serviceStartNote: parsed.data.note?.trim() || 'Started manually before payment by manager/admin',
      };
      if (parsed.data.assignedStaffId !== undefined) {
        patch.assignedStaffId = parsed.data.assignedStaffId || null;
      }

      const updatedCar = await store.cars.update(car.id, patch);

      const cycle = currentCycle();
      await generateVisitsForCar(store, updatedCar, customer, cycle, parsed.data.startDate ?? undefined);

      if (updatedCar.assignedStaffId) {
        await store.visits.updateMany(
          { carId: car.id, status: 'PENDING', scheduledDate: { gte: todayISO() } } as never,
          { staffId: updatedCar.assignedStaffId },
        );
      }

      revalidateCustomerPages();
      return NextResponse.json({
        ok: true,
        car: updatedCar,
        message: `Service started for ${car.make} ${car.model}. Washes scheduled immediately.`,
      });
    }

    if (parsed.data.action === 'adhocWash') {
      const customer = await store.customers.get(parsed.data.customerId);
      if (!customer) throw new HttpError(404, 'Customer not found.');
      assertInScope(session, customer.areaId);

      const car = await store.cars.get(parsed.data.carId);
      if (!car || car.customerId !== customer.id) {
        throw new HttpError(404, 'Car not found for this customer.');
      }
      if (!car.serviceStarted) {
        throw new HttpError(400, 'Service is not active for this car. Start service first.');
      }
      
      const staff = await store.staff.get(parsed.data.assignedStaffId);
      if (!staff || staff.areaId !== customer.areaId) {
        throw new HttpError(400, 'Invalid staff selected.');
      }

      const cycle = currentCycle();
      const today = todayISO();
      
      // Delete any existing PENDING visit for today to avoid duplicate washes on the same day
      const existingToday = await store.visits.find({
        where: { carId: car.id, scheduledDate: today, status: 'PENDING' } as never,
      });
      for (const v of existingToday) {
        await store.visits.delete(v.id);
      }

      const visit = await store.visits.create({
        carId: car.id,
        customerId: customer.id,
        areaId: customer.areaId,
        staffId: staff.id,
        cycle,
        scheduledDate: today,
        scheduledTime: car.scheduleTime || '09:00',
        status: 'PENDING',
        startedAt: null,
        completedAt: null,
        plannedService: plannedServiceFor(car, today),
        servicesDone: [],
        beforePhotoUrl: null,
        afterPhotoUrl: null,
        beforePhotoBytes: null,
        afterPhotoBytes: null,
        missReason: null,
        missNote: null,
        rescheduledToVisitId: null,
        rating: null,
        ratingComment: null,
        onTime: false,
        managerRating: null,
        managerRatingComment: null,
        managerRatedAt: null,
        managerRatedByUserId: null,
      });

      revalidateCustomerPages();
      return NextResponse.json({
        ok: true,
        visit,
        message: `Ad-hoc wash scheduled for today and assigned to ${staff.name}.`,
      });
    }

    if (parsed.data.action === 'updateCustomer') {
      const customer = await store.customers.get(parsed.data.customerId);
      if (!customer) throw new HttpError(404, 'Customer not found.');
      assertInScope(session, customer.areaId);
      if (parsed.data.areaId && parsed.data.areaId !== customer.areaId) {
        assertInScope(session, parsed.data.areaId);
      }

      const patch: Partial<Customer> = {};
      if (parsed.data.name !== undefined) patch.name = parsed.data.name;
      if (parsed.data.phone !== undefined) patch.phone = parsed.data.phone;
      if (parsed.data.altPhone !== undefined) patch.altPhone = parsed.data.altPhone;
      if (parsed.data.address !== undefined) patch.address = parsed.data.address;
      if (parsed.data.landmark !== undefined) patch.landmark = parsed.data.landmark;
      if (parsed.data.areaId !== undefined) patch.areaId = parsed.data.areaId;
      if (parsed.data.source !== undefined) patch.source = parsed.data.source;
      if (parsed.data.note !== undefined) patch.note = parsed.data.note;
      if (parsed.data.status !== undefined) patch.status = parsed.data.status;

      const updated = await store.customers.update(customer.id, patch);

      // If area changed, also update customer's cars and pending visits areaId
      if (parsed.data.areaId && parsed.data.areaId !== customer.areaId) {
        await store.visits.updateMany(
          { customerId: customer.id, status: 'PENDING', scheduledDate: { gte: todayISO() } } as never,
          { areaId: parsed.data.areaId },
        );
      }

      revalidateCustomerPages();
      return NextResponse.json({
        ok: true,
        customer: updated,
        message: 'Customer details updated successfully.',
      });
    }

    if (parsed.data.action === 'updateCar') {
      const customer = await store.customers.get(parsed.data.customerId);
      if (!customer) throw new HttpError(404, 'Customer not found.');
      assertInScope(session, customer.areaId);

      const car = await store.cars.get(parsed.data.carId);
      if (!car || car.customerId !== customer.id) throw new HttpError(404, 'Car not found.');

      if (parsed.data.assignedStaffId) {
        const assignee = await store.staff.get(parsed.data.assignedStaffId);
        if (!assignee) throw new HttpError(404, 'That staff member was not found.');
        if (!assignee.active) {
          throw new HttpError(400, `${assignee.name} is deactivated and cannot be assigned washes.`);
        }
      }

      if (parsed.data.plate !== undefined) {
        await assertPlateAvailable(store, parsed.data.plate.toUpperCase(), car.id);
      }

      let effectivePackage = null as Awaited<ReturnType<typeof store.packages.get>>;
      if (parsed.data.packageId !== undefined) {
        effectivePackage = await store.packages.get(parsed.data.packageId);
        // An unvalidated packageId would silently zero out this car's
        // billing everywhere `packageById.get(car.packageId)` is looked up.
        if (!effectivePackage || !effectivePackage.active) {
          throw new HttpError(400, 'Selected package is not available.');
        }
      }

      if (parsed.data.weeklyDays !== undefined || parsed.data.packageId !== undefined) {
        const pkgForCheck = effectivePackage ?? (await store.packages.get(car.packageId));
        const daysForCheck = parsed.data.weeklyDays ?? car.weeklyDays;
        if (pkgForCheck) assertWeeklyDaysFitPackage(daysForCheck, pkgForCheck);
      }

      const patch: Partial<Car> = {};
      if (parsed.data.make !== undefined) patch.make = parsed.data.make;
      if (parsed.data.model !== undefined) patch.model = parsed.data.model;
      if (parsed.data.colour !== undefined) patch.colour = parsed.data.colour;
      if (parsed.data.plate !== undefined) patch.plate = parsed.data.plate.toUpperCase();
      if (parsed.data.packageId !== undefined) patch.packageId = parsed.data.packageId;
      if (parsed.data.assignedStaffId !== undefined) patch.assignedStaffId = parsed.data.assignedStaffId;
      if (parsed.data.weeklyDays !== undefined) patch.weeklyDays = parsed.data.weeklyDays;
      if (parsed.data.dayServices !== undefined) patch.dayServices = parsed.data.dayServices;
      if (parsed.data.scheduleTime !== undefined) patch.scheduleTime = parsed.data.scheduleTime;
      if (parsed.data.specialInstructions !== undefined) patch.specialInstructions = parsed.data.specialInstructions;
      if (parsed.data.active !== undefined) patch.active = parsed.data.active;

      const updatedCar = await store.cars.update(car.id, patch);

      // If staff assignment changed, update pending future visits
      if (parsed.data.assignedStaffId !== undefined) {
        await store.visits.updateMany(
          { carId: car.id, status: 'PENDING', scheduledDate: { gte: todayISO() } } as never,
          { staffId: parsed.data.assignedStaffId },
        );
      }

      revalidateCustomerPages();
      return NextResponse.json({
        ok: true,
        car: updatedCar,
        message: `${updatedCar.make} ${updatedCar.model} updated successfully.`,
      });
    }

    if (parsed.data.action === 'addCar') {
      const customer = await store.customers.get(parsed.data.customerId);
      if (!customer) throw new HttpError(404, 'Customer not found.');
      assertInScope(session, customer.areaId);

      const pkg = await store.packages.get(parsed.data.packageId);
      if (!pkg || !pkg.active) throw new HttpError(400, 'Selected package is not available.');
      assertWeeklyDaysFitPackage(parsed.data.weeklyDays, pkg);

      await assertPlateAvailable(store, parsed.data.plate.toUpperCase());

      const car = await store.cars.create({
        customerId: customer.id,
        model: parsed.data.model,
        make: parsed.data.make,
        colour: parsed.data.colour,
        plate: parsed.data.plate.toUpperCase(),
        packageId: parsed.data.packageId,
        assignedStaffId: parsed.data.assignedStaffId || null,
        weeklyDays: parsed.data.weeklyDays,
        dayServices: parsed.data.dayServices || null,
        scheduleTime: parsed.data.scheduleTime,
        specialInstructions: parsed.data.specialInstructions || null,
        active: true,
        serviceStarted: parsed.data.autoStartService ?? true,
        serviceStartedAt: (parsed.data.autoStartService ?? true) ? new Date().toISOString() : null,
        serviceStartedBeforePayment: false,
        serviceStartedByUserId: session.user.id,
        serviceStartNote: 'Added from Customer Management',
      });

      const cycle = currentCycle();
      if (car.serviceStarted) {
        await generateVisitsForCar(store, car, customer, cycle, parsed.data.startDate ?? undefined);
      }

      revalidateCustomerPages();
      return NextResponse.json({
        ok: true,
        car,
        message: `Added ${car.make} ${car.model} (${car.plate}). Schedule generated.`,
      });
    }

    if (parsed.data.action === 'rescheduleVisit') {
      const customer = await store.customers.get(parsed.data.customerId);
      if (!customer) throw new HttpError(404, 'Customer not found.');
      assertInScope(session, customer.areaId);

      const visit = await store.visits.get(parsed.data.visitId);
      if (!visit || visit.customerId !== customer.id) {
        throw new HttpError(404, 'Wash visit not found for this customer.');
      }

      if (parsed.data.staffId) {
        const assignee = await store.staff.get(parsed.data.staffId);
        if (!assignee || !assignee.active) {
          throw new HttpError(400, 'Selected staff member is not available.');
        }
      }

      const updated = await rescheduleVisit(store, visit.id, {
        scheduledDate: parsed.data.scheduledDate as never,
        scheduledTime: parsed.data.scheduledTime,
        staffId: parsed.data.staffId === undefined ? undefined : parsed.data.staffId,
      }).catch((err: Error) => {
        throw new HttpError(400, err.message);
      });

      revalidateCustomerPages();
      return NextResponse.json({
        ok: true,
        visit: updated,
        message: 'Wash rescheduled — this is a one-off change, next week still follows the usual plan.',
      });
    }

    if (parsed.data.action === 'deleteCar') {
      const customer = await store.customers.get(parsed.data.customerId);
      if (!customer) throw new HttpError(404, 'Customer not found.');
      assertInScope(session, customer.areaId);

      const car = await store.cars.get(parsed.data.carId);
      if (!car || car.customerId !== customer.id) throw new HttpError(404, 'Car not found.');

      const completedCount = await store.visits.count({ carId: car.id, status: 'DONE' } as never);
      if (completedCount > 0) {
        await store.cars.update(car.id, { active: false });
        await store.visits.updateMany(
          { carId: car.id, status: 'PENDING', scheduledDate: { gte: todayISO() } } as never,
          { status: 'MISSED', missReason: 'CUSTOMER_CANCELLED', missNote: 'Car deactivated by admin' } as never,
        );
        revalidateCustomerPages();
        return NextResponse.json({
          ok: true,
          message: `${car.make} ${car.model} has past wash history and was marked inactive. Future visits cancelled.`,
        });
      } else {
        await store.visits.deleteMany({ carId: car.id, status: 'PENDING' } as never);
        await store.cars.delete(car.id);
        revalidateCustomerPages();
        return NextResponse.json({
          ok: true,
          message: `${car.make} ${car.model} deleted.`,
        });
      }
    }

    const data = parsed.data;
    assertInScope(session, data.areaId);

    // The bonus lives on Customer.referredById, but the ONLY legitimate way
    // to populate it is by picking an already dual-approved StaffReferral —
    // never a free-hand staff pick — so it always matches a real, audited
    // referral rather than whichever wash boy an admin happened to choose.
    let referredById: string | null = null;
    let referral: Awaited<ReturnType<typeof store.staffReferrals.get>> = null;
    if (data.referralId) {
      referral = await store.staffReferrals.get(data.referralId);
      if (!referral) throw new HttpError(404, 'That referral was not found.');
      if (referral.type !== 'CUSTOMER') {
        throw new HttpError(400, 'That referral is for a new wash boy, not a new customer.');
      }
      if (referral.status !== 'APPROVED') {
        throw new HttpError(400, 'That referral has not been approved by both the area admin and the owner yet.');
      }
      if (referral.convertedCustomerId) {
        throw new HttpError(409, 'That referral has already been used for another customer.');
      }
      assertInScope(session, referral.areaId);
      referredById = referral.referredByStaffId;
    }

    if (data.createLogin && data.loginEmail) {
      const existing = await store.users.findOne({
        where: { email: data.loginEmail.toLowerCase() },
      });
      if (existing) {
        throw new HttpError(409, 'Someone already uses that login email.');
      }
    }

    // Check every car's plate and package before creating anything, so a
    // problem on the second car of a multi-car signup doesn't leave a
    // half-created customer behind.
    const requestedPlates = new Set<string>();
    for (const input of data.cars) {
      const plate = input.plate.toUpperCase();
      if (requestedPlates.has(plate)) {
        throw new HttpError(409, `Plate ${plate} was entered for more than one car in this request.`);
      }
      requestedPlates.add(plate);
      await assertPlateAvailable(store, plate);
      const pkg = await store.packages.get(input.packageId);
      if (!pkg || !pkg.active) {
        throw new HttpError(400, 'Unknown or discontinued package on one of the cars.');
      }
      assertWeeklyDaysFitPackage(input.weeklyDays, pkg);
    }

    const cycle = currentCycle();
    const customer = await store.customers.create({
      userId: null,
      areaId: data.areaId,
      name: data.name,
      phone: data.phone,
      altPhone: data.altPhone || null,
      address: data.address,
      landmark: data.landmark || null,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      source: data.source,
      referredById,
      status: 'ACTIVE',
      holdUntil: null,
      note: data.note || null,
      joinedOn: todayISO(),
    } as Omit<Customer, 'id'>);

    // Everything from here on can still fail (a car's schedule generation, an
    // unexpected DB hiccup) — this repository layer has no cross-model
    // transaction, so a failure here must be unwound by hand, or the customer
    // and their login are left behind with no car and no way to sign up
    // again against the same email/plate.
    let createdUserId: string | null = null;
    try {
      if (data.createLogin && data.loginEmail && data.loginPassword) {
        const user = await store.users.create({
          name: data.name,
          email: data.loginEmail.toLowerCase(),
          phone: data.phone,
          role: 'CUSTOMER',
          regionId: null,
          areaId: data.areaId,
          customerId: customer.id,
          staffId: null,
          language: 'en',
          active: true,
          createdAt: new Date().toISOString(),
        });
        createdUserId = user.id;
        await store.customers.update(customer.id, { userId: user.id });
        await store.setCredential(user.id, await hashPassword(data.loginPassword));
      }

      let monthly = 0;
      const isPrepaidPaid = data.advance > 0;

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
          weeklyDays: input.weeklyDays,
          dayServices: input.dayServices || null,
          scheduleTime: input.scheduleTime,
          specialInstructions: input.specialInstructions || null,
          active: true,
          serviceStarted: isPrepaidPaid,
          serviceStartedAt: isPrepaidPaid ? new Date().toISOString() : null,
          serviceStartedBeforePayment: false,
          serviceStartedByUserId: isPrepaidPaid ? session.user.id : null,
          serviceStartNote: null,
        });

        if (isPrepaidPaid) {
          await generateVisitsForCar(store, car, customer, cycle, data.startDate ?? undefined);
        }
      }

      // Billing always falls due on the 5th, but a customer signing up after
      // the 5th must not be billed as already overdue on day one — that both
      // reads badly to them and wrongly puts them on the manager's overdue
      // list before they have ever had a chance to pay. Push the due date to
      // the following cycle's 5th in that case.
      const firstDueOn =
        `${cycle}-05` < todayISO() ? `${nextCycle(cycle)}-05` : `${cycle}-05`;

      await store.invoices.create({
        customerId: customer.id,
        areaId: customer.areaId,
        cycle,
        amount: monthly,
        dueOn: firstDueOn,
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

      if (data.enquiryId) {
        const enq = await store.enquiries.get(data.enquiryId);
        if (enq) {
          await store.enquiries.update(enq.id, {
            status: 'CONVERTED',
            convertedCustomerId: customer.id,
            handledByUserId: session.user.id,
            handledAt: new Date().toISOString(),
          });
        }
      }

      if (referral) {
        await store.staffReferrals.update(referral.id, { convertedCustomerId: customer.id });
      }
    } catch (innerError) {
      try {
        await store.customers.delete(customer.id);
        if (createdUserId) await store.users.delete(createdUserId);
      } catch (cleanupError) {
        console.error('Failed to unwind a half-created customer signup:', cleanupError);
      }
      throw innerError;
    }

    const visits = await store.visits.count({ customerId: customer.id, cycle });

    revalidateCustomerPages();
    return NextResponse.json({
      ok: true,
      customer,
      message: `Saved. ${visits} wash ${visits === 1 ? 'visit' : 'visits'} generated for this month.`,
    });
  } catch (error) {
    return opsError(error);
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireApiSession('customer:view');
    const store = await getStore();
    const cycle = currentCycle();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (customerId) {
      const account = await loadCustomerAccount(store, customerId, cycle);
      if (!account) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
      }
      assertInScope(session, account.customer.areaId);
      const [area, staff, user, allAreas, allPackages] = await Promise.all([
        store.areas.get(account.customer.areaId),
        store.staff.find({ where: { areaId: account.customer.areaId, role: 'EMPLOYEE' } }),
        account.customer.userId ? store.users.get(account.customer.userId) : Promise.resolve(null),
        store.areas.find(),
        store.packages.find(),
      ]);

      return NextResponse.json({
        ok: true,
        data: {
          account,
          area: area ? { id: area.id, name: area.name, city: area.city } : null,
          staff: staff.map((s) => ({ id: s.id, name: s.name, phone: s.phone })),
          user: user ? { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role } : null,
          allAreas: allAreas.map((a) => ({ id: a.id, name: a.name })),
          allPackages: allPackages.map((p) => ({ id: p.id, name: p.name, price: p.price, washesPerMonth: p.washesPerMonth, services: p.services })),
        },
      });
    }

    const areaFilter = scopeAreaFilter(session.scope);
    const [all, areas, staff, packages, invoices, users] = await Promise.all([
      store.customers.find({
        where: areaFilter as never,
        orderBy: [{ field: 'name' }],
      }),
      store.areas.find(),
      store.staff.find({ where: { role: 'EMPLOYEE', ...areaFilter } as never }),
      store.packages.find(),
      store.invoices.find({ where: { cycle, ...areaFilter } as never }),
      store.users.find(),
    ]);

    const userByUserId = new Map(users.map((u) => [u.id, u]));
    const userByCustomerId = new Map(
      users.filter((u) => u.customerId).map((u) => [u.customerId!, u]),
    );

    const customerIds = all.map((c) => c.id);
    const scopedCars = customerIds.length
      ? await store.cars.find({ where: { customerId: { in: customerIds } } as never })
      : [];

    const carsByCustomer = new Map<string, Car[]>();
    for (const car of scopedCars) {
      const list = carsByCustomer.get(car.customerId) ?? [];
      list.push(car);
      carsByCustomer.set(car.customerId, list);
    }

    const invoiceByCustomer = new Map(invoices.map((i) => [i.customerId, i]));
    const staffById = new Map(staff.map((s) => [s.id, s]));
    const areaById = new Map(areas.map((a) => [a.id, a]));
    const packageById = new Map(packages.map((p) => [p.id, p]));

    const totalCustomers = all.length;
    const activeCustomers = all.filter((c) => c.status === 'ACTIVE').length;
    const holdCustomers = all.filter((c) => c.status === 'HOLD').length;
    const inactiveCustomers = all.filter((c) => c.status === 'INACTIVE').length;

    const activePercent = totalCustomers > 0 ? ((activeCustomers / totalCustomers) * 100).toFixed(1) : '0.0';
    const holdPercent = totalCustomers > 0 ? ((holdCustomers / totalCustomers) * 100).toFixed(1) : '0.0';
    const inactivePercent = totalCustomers > 0 ? ((inactiveCustomers / totalCustomers) * 100).toFixed(1) : '0.0';
    const totalCarsCount = scopedCars.length;

    const unpaidInvoices = invoices.filter((i) => i.status !== 'PAID' && i.amount - i.paidAmount > 0);
    const unpaidCount = unpaidInvoices.length;
    const unpaidAmount = unpaidInvoices.reduce((sum, i) => sum + (i.amount - i.paidAmount), 0);

    const customers = all.map((customer) => {
      const own = carsByCustomer.get(customer.id) ?? [];
      const user = (customer.userId ? userByUserId.get(customer.userId) : null) ?? userByCustomerId.get(customer.id);
      const invoice = invoiceByCustomer.get(customer.id);
      const owed = invoice ? Math.max(0, invoice.amount - invoice.paidAmount) : 0;
      const paymentStatus = !invoice
        ? 'NONE'
        : owed <= 0
        ? 'PAID'
        : invoice.paidAmount > 0
        ? 'PARTIAL'
        : 'PENDING';

      const monthlyAmount = own.reduce(
        (sum, car) => sum + (packageById.get(car.packageId)?.price ?? 0),
        0,
      );

      const firstCar = own[0];
      const assignedStaff = firstCar?.assignedStaffId ? staffById.get(firstCar.assignedStaffId) : null;

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        altPhone: customer.altPhone,
        address: customer.address,
        landmark: customer.landmark,
        lat: customer.lat,
        lng: customer.lng,
        joinedOn: customer.joinedOn,
        areaId: customer.areaId,
        areaName: areaById.get(customer.areaId)?.name || 'Area',
        status: customer.status,
        source: customer.source,
        note: customer.note,
        email: user?.email || '',
        userId: customer.userId,
        carsCount: own.length,
        cars: own.map((car) => ({
          id: car.id,
          make: car.make,
          model: car.model,
          plate: car.plate,
          colour: car.colour,
          packageId: car.packageId,
          packageName: packageById.get(car.packageId)?.name,
          packagePrice: packageById.get(car.packageId)?.price,
          weeklyDays: car.weeklyDays,
          dayServices: car.dayServices,
          scheduleTime: car.scheduleTime,
          assignedStaffId: car.assignedStaffId,
          assignedStaffName: car.assignedStaffId ? staffById.get(car.assignedStaffId)?.name : undefined,
          serviceStarted: car.serviceStarted,
          serviceStartedBeforePayment: car.serviceStartedBeforePayment,
        })),
        monthlyAmount,
        paymentStatus,
        outstandingAmount: owed,
        weeklyDays: firstCar?.weeklyDays,
        scheduleTime: firstCar?.scheduleTime,
        assignedStaffId: firstCar?.assignedStaffId,
        assignedStaffName: assignedStaff?.name,
      };
    });

    return NextResponse.json({
      ok: true,
      data: {
        customers,
        stats: {
          totalCustomers,
          activeCustomers,
          holdCustomers,
          inactiveCustomers,
          activePercent,
          holdPercent,
          inactivePercent,
          totalCarsCount,
          unpaidCount,
          unpaidAmount,
        },
        staff: staff.map((s) => ({ id: s.id, name: s.name })),
        packages: packages.map((p) => ({ id: p.id, name: p.name, price: p.price })),
        areas: areas.map((a) => ({ id: a.id, name: a.name })),
      },
    });
  } catch (error) {
    return opsError(error);
  }
}
