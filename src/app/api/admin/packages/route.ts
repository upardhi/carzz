import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { formatPackageServices, parsePackageServices, type PackageServiceItem } from '@/lib/data/types';

const serviceItemSchema = z.union([
  z.string(),
  z.object({
    name: z.string().trim().min(1),
    washesPerMonth: z.number().int().positive().max(31),
  }),
]);

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    name: z.string().trim().min(2),
    washesPerMonth: z.number().int().positive().max(31),
    price: z.number().int().positive(),
    costToDeliver: z.number().int().min(0),
    services: z.array(serviceItemSchema).min(1),
  }),
  z.object({
    action: z.literal('update'),
    packageId: z.string().min(1),
    name: z.string().trim().min(2).optional(),
    price: z.number().int().positive().optional(),
    washesPerMonth: z.number().int().positive().max(31).optional(),
    costToDeliver: z.number().int().min(0).optional(),
    services: z.array(serviceItemSchema).min(1).optional(),
    active: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('impact'),
    packageId: z.string().min(1),
  }),
  z.object({
    action: z.literal('delete'),
    packageId: z.string().min(1),
  }),
]);

function normalizeServices(
  rawServices: Array<string | PackageServiceItem>,
  packageWashes: number,
): string[] {
  const items: PackageServiceItem[] = rawServices.map((s) => {
    if (typeof s === 'string') {
      const parsed = parsePackageServices([s], packageWashes)[0];
      return {
        name: parsed.name,
        washesPerMonth: Math.min(parsed.washesPerMonth, packageWashes),
      };
    }
    return {
      name: s.name.trim(),
      washesPerMonth: Math.min(s.washesPerMonth, packageWashes),
    };
  });
  return formatPackageServices(items);
}

/** Rates and packages management API. */
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

    if (parsed.data.action === 'impact') {
      const { packageId } = parsed.data;
      const pkg = await store.packages.get(packageId);
      if (!pkg) throw new HttpError(404, 'Package not found.');

      const activeCars = await store.cars.find({ where: { packageId, active: true } as never });
      const customerIds = Array.from(new Set(activeCars.map((c) => c.customerId))).filter(Boolean);
      const customers = customerIds.length
        ? await store.customers.find({ where: { id: { in: customerIds } } as never })
        : [];
      const custMap = new Map(customers.map((c) => [c.id, c.name]));

      const impacted = activeCars.map((c) => ({
        carId: c.id,
        make: c.make,
        model: c.model,
        plate: c.plate,
        customerId: c.customerId,
        customerName: custMap.get(c.customerId) ?? 'Unknown Customer',
      }));

      return NextResponse.json({
        ok: true,
        package: pkg,
        impactedCarsCount: activeCars.length,
        impactedCustomersCount: customerIds.length,
        impacted,
      });
    }

    if (parsed.data.action === 'delete') {
      const { packageId } = parsed.data;
      const existing = await store.packages.get(packageId);
      if (!existing) throw new HttpError(404, 'Package not found.');

      const inUse = await store.cars.count({ packageId, active: true } as never);
      if (inUse > 0) {
        // Fetch impacted details to show in error/warning modal
        const activeCars = await store.cars.find({ where: { packageId, active: true } as never });
        const customerIds = Array.from(new Set(activeCars.map((c) => c.customerId))).filter(Boolean);
        const customers = customerIds.length
          ? await store.customers.find({ where: { id: { in: customerIds } } as never })
          : [];
        const custMap = new Map(customers.map((c) => [c.id, c.name]));

        const impacted = activeCars.map((c) => ({
          carId: c.id,
          make: c.make,
          model: c.model,
          plate: c.plate,
          customerId: c.customerId,
          customerName: custMap.get(c.customerId) ?? 'Unknown Customer',
        }));

        return NextResponse.json(
          {
            error: `Cannot delete: ${inUse} active car${inUse === 1 ? ' is' : 's are'} currently subscribed to this package. You can disable it instead so existing cars finish their cycle while preventing new signups.`,
            inUse,
            impacted,
          },
          { status: 409 },
        );
      }

      await store.packages.delete(packageId);
      revalidatePath('/', 'layout');

      return NextResponse.json({
        ok: true,
        message: `Package "${existing.name}" deleted successfully.`,
      });
    }

    if (parsed.data.action === 'create') {
      const washesPerMonth = parsed.data.washesPerMonth;
      const normalizedServices = normalizeServices(parsed.data.services, washesPerMonth);

      const created = await store.packages.create({
        name: parsed.data.name,
        washesPerMonth,
        price: parsed.data.price,
        costToDeliver: parsed.data.costToDeliver,
        services: normalizedServices,
        active: true,
      });

      // The website advertises these prices, so it has to be refreshed.
      revalidatePath('/', 'layout');
      return NextResponse.json({
        ok: true,
        package: created,
        message: `${created.name} created and available in every area.`,
      });
    }

    const { packageId, ...patch } = parsed.data;
    const existing = await store.packages.get(packageId);
    if (!existing) throw new HttpError(404, 'Package not found.');

    const targetWashes = patch.washesPerMonth ?? existing.washesPerMonth;
    let finalServices = existing.services;

    if (patch.services) {
      finalServices = normalizeServices(patch.services, targetWashes);
    } else if (patch.washesPerMonth && patch.washesPerMonth !== existing.washesPerMonth) {
      // Re-normalize existing services to not exceed new wash limit
      finalServices = normalizeServices(existing.services, patch.washesPerMonth);
    }

    const updated = await store.packages.update(packageId, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.price !== undefined ? { price: patch.price } : {}),
      ...(patch.washesPerMonth !== undefined ? { washesPerMonth: patch.washesPerMonth } : {}),
      ...(patch.costToDeliver !== undefined ? { costToDeliver: patch.costToDeliver } : {}),
      services: finalServices,
      ...(patch.active !== undefined ? { active: patch.active } : {}),
    });

    revalidatePath('/', 'layout');
    return NextResponse.json({
      ok: true,
      package: updated,
      message: patch.active !== undefined
        ? `Package "${updated.name}" is now ${updated.active ? 'active' : 'disabled (hidden from new customers)'}.`
        : `${updated.name} updated. New customers get the new rate; existing invoices are untouched.`,
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
