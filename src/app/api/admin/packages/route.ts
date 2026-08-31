import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    name: z.string().trim().min(2),
    washesPerMonth: z.number().int().positive().max(31),
    price: z.number().int().positive(),
    costToDeliver: z.number().int().min(0),
    services: z.array(z.string()).min(1),
  }),
  z.object({
    action: z.literal('update'),
    packageId: z.string().min(1),
    price: z.number().int().positive().optional(),
    washesPerMonth: z.number().int().positive().max(31).optional(),
    costToDeliver: z.number().int().min(0).optional(),
    active: z.boolean().optional(),
  }),
]);

/** Rates are the owner's to change — no developer needed. */
export async function POST(request: Request) {
  try {
    await requireApiSession('package:manage');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Check the form.' },
        { status: 400 },
      );
    }
    const store = await getStore();

    if (parsed.data.action === 'create') {
      const created = await store.packages.create({
        name: parsed.data.name,
        washesPerMonth: parsed.data.washesPerMonth,
        price: parsed.data.price,
        costToDeliver: parsed.data.costToDeliver,
        services: parsed.data.services,
        active: true,
      });
      return NextResponse.json({
        ok: true,
        package: created,
        message: `${created.name} created and available in every area.`,
      });
    }

    const { packageId, ...patch } = parsed.data;
    const existing = await store.packages.get(packageId);
    if (!existing) throw new HttpError(404, 'Package not found.');

    if (patch.active === false) {
      // Retiring a package must not strand the cars already on it.
      const inUse = await store.cars.count({ packageId, active: true });
      if (inUse > 0) {
        throw new HttpError(
          409,
          `${inUse} active ${inUse === 1 ? 'car is' : 'cars are'} on this package. Move them first.`,
        );
      }
    }

    const updated = await store.packages.update(packageId, {
      ...(patch.price !== undefined ? { price: patch.price } : {}),
      ...(patch.washesPerMonth !== undefined
        ? { washesPerMonth: patch.washesPerMonth }
        : {}),
      ...(patch.costToDeliver !== undefined
        ? { costToDeliver: patch.costToDeliver }
        : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
    });

    return NextResponse.json({
      ok: true,
      package: updated,
      message: `${updated.name} updated. New customers get the new rate; existing invoices are untouched.`,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Could not save that package.' },
      { status: 500 },
    );
  }
}
