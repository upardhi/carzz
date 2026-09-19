import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';

const carInputSchema = z.object({
  make: z.string().trim().min(1).default('Car'),
  model: z.string().trim().min(1, 'Please enter the car model'),
  colour: z.string().trim().min(1, 'Please enter the car colour'),
  plate: z.string().trim().min(3, 'Please enter the plate number'),
  packageId: z.string().optional(),
  schedulePattern: z.enum(['MON_THU', 'TUE_FRI', 'WED_SAT', 'THU_SUN', 'CUSTOM']).default('CUSTOM'),
  scheduleTime: z.string().regex(/^\d{2}:\d{2}$/).default('06:30'),
  specialInstructions: z.string().max(300).optional(),
  customDates: z.array(z.string()).optional(),
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

    // Resolve service package
    let pkg = data.packageId ? await store.packages.get(data.packageId) : null;
    if (!pkg) {
      const activePackages = await store.packages.find({ where: { active: true } });
      pkg = activePackages[0] || null;
    }
    if (!pkg) {
      throw new HttpError(400, 'No active service package available.');
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
      schedulePattern: data.schedulePattern,
      scheduleTime: data.scheduleTime,
      specialInstructions: data.specialInstructions || null,
      active: true,
      serviceStarted: false,
      serviceStartedAt: null,
      serviceStartedBeforePayment: false,
      serviceStartedByUserId: null,
      serviceStartNote: null,
      customDates: data.customDates || [],
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
