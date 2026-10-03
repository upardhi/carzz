import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { maxWeeklyDaysForPackage, parsePackageServices } from '@/lib/data/types';
import { loadCustomerAccount } from '@/lib/services/accounts';
import { currentCycle } from '@/lib/util/format';
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession('self:cars');
    if (!session.user.customerId) {
      throw new HttpError(403, 'Customer account required.');
    }

    const store = await getStore();
    const cycle = currentCycle();
    const account = await loadCustomerAccount(store, session.user.customerId, cycle);
    if (!account) {
      throw new HttpError(404, 'Customer account not found.');
    }

    const { searchParams } = new URL(request.url);
    const carId = searchParams.get('carId');

    if (carId) {
      const car = account.cars.find((c) => c.id === carId);
      if (!car) {
        throw new HttpError(404, 'Car not found on your account.');
      }

      // Compute service progress breakdown
      const parsedPackageServices = parsePackageServices(
        car.package?.services,
        car.package?.washesPerMonth ?? 8,
      );

      const completedCarVisitsThisCycle = account.visits.filter(
        (v) => v.carId === carId && v.cycle === cycle && v.status === 'DONE',
      );

      const serviceStats = parsedPackageServices.map((s) => {
        const timesDone = completedCarVisitsThisCycle.filter(
          (v) =>
            Array.isArray(v.servicesDone) &&
            v.servicesDone.some(
              (doneName) =>
                doneName.trim().toLowerCase() === s.name.trim().toLowerCase() ||
                doneName.trim().toLowerCase().includes(s.name.trim().toLowerCase()),
            ),
        ).length;

        const quota = s.washesPerMonth;
        const remaining = Math.max(0, quota - timesDone);
        const isCompleted = timesDone >= quota;
        const percent = Math.min(100, Math.round((timesDone / (quota || 1)) * 100));

        return {
          name: s.name,
          quota,
          timesDone,
          remaining,
          isCompleted,
          percent,
        };
      });

      const carVisits = account.visits.filter((v) => v.carId === carId);
      const history = carVisits
        .filter((v) => v.status !== 'PENDING')
        .slice(0, 30)
        .map((v) => ({
          ...v,
          beforePhotoUrl: resolvePublicPhotoUrl(v.beforePhotoUrl),
          afterPhotoUrl: resolvePublicPhotoUrl(v.afterPhotoUrl),
        }));

      const nextVisit = carVisits.find((v) => v.status === 'PENDING') || null;

      return NextResponse.json({
        ok: true,
        car,
        serviceStats,
        history,
        nextVisit,
      });
    }

    return NextResponse.json({
      ok: true,
      cars: account.cars,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching customer cars:', error);
    return NextResponse.json(
      { error: 'Could not fetch cars.' },
      { status: 500 },
    );
  }
}

const carInputSchema = z.object({
  make: z.string().trim().min(1).default('Car'),
  model: z.string().trim().min(1, 'Please enter the car model'),
  colour: z.string().trim().min(1, 'Please enter the car colour'),
  plate: z.string().trim().min(3, 'Please enter the plate number'),
  packageId: z.string().optional(),
  weeklyDays: z.array(z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])).min(1).default(['MON', 'THU']),
  dayServices: z.record(z.string(), z.string()).optional().nullable(),
  scheduleTime: z.string().regex(/^\d{2}:\d{2}$/).default('06:30'),
  specialInstructions: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('self:cars');
    if (!session.user.customerId) {
      throw new HttpError(403, 'Customer account required.');
    }

    const json = await request.json().catch(() => null);
    const parsed = carInputSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid car details.' },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const store = await getStore();
    const customer = await store.customers.get(session.user.customerId);
    if (!customer) {
      throw new HttpError(404, 'Customer account not found.');
    }

    let pkg: Awaited<ReturnType<typeof store.packages.get>> = null;
    if (data.packageId) {
      const requested = await store.packages.get(data.packageId);
      if (!requested || !requested.active) {
        throw new HttpError(400, 'That package is no longer available. Please pick another.');
      }
      pkg = requested;
    } else {
      const activePackages = await store.packages.find({ where: { active: true } });
      pkg = activePackages[0] || null;
    }
    if (!pkg) {
      throw new HttpError(400, 'No active service package available.');
    }

    const maxDays = maxWeeklyDaysForPackage(pkg);
    if (data.weeklyDays.length > maxDays) {
      throw new HttpError(
        400,
        `This package (${pkg.washesPerMonth}/month) allows at most ${maxDays} day${maxDays === 1 ? '' : 's'}/week — ${data.weeklyDays.length} were selected.`,
      );
    }

    // Inherit assigned staff from existing cars if present
    const existingCars = await store.cars.find({
      where: { customerId: customer.id, active: true },
    });
    const assignedStaffId =
      existingCars.find((c) => c.assignedStaffId)?.assignedStaffId || null;

    const newCar = await store.cars.create({
      customerId: customer.id,
      make: data.make,
      model: data.model,
      colour: data.colour,
      plate: data.plate.toUpperCase(),
      packageId: pkg.id,
      assignedStaffId,
      weeklyDays: data.weeklyDays,
      dayServices: data.dayServices || null,
      scheduleTime: data.scheduleTime,
      specialInstructions: data.specialInstructions || null,
      active: true,
      serviceStarted: false,
      serviceStartedAt: null,
      serviceStartedBeforePayment: false,
      serviceStartedByUserId: null,
      serviceStartNote: null,
    });

    return NextResponse.json({
      ok: true,
      car: newCar,
      message: `${newCar.make} ${newCar.model} added to your account! Complete package payment or contact support to start washes.`,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error adding customer car:', error);
    return NextResponse.json(
      { error: 'Could not add car. Please try again.' },
      { status: 500 },
    );
  }
}
