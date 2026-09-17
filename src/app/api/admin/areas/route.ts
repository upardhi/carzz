import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { invalidateAreaPerformanceCache } from '@/lib/services/reports';

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    name: z.string().trim().min(2, 'Name must have at least 2 characters'),
    city: z.string().trim().min(2, 'City is required'),
    address: z.string().trim().optional().nullable(),
    lat: z.number().optional().nullable(),
    lng: z.number().optional().nullable(),
    regionId: z.string().min(1, 'Region is required'),
    managerId: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal('update'),
    areaId: z.string().min(1),
    name: z.string().trim().min(2, 'Name must have at least 2 characters').optional(),
    city: z.string().trim().min(2, 'City is required').optional(),
    address: z.string().trim().optional().nullable(),
    lat: z.number().optional().nullable(),
    lng: z.number().optional().nullable(),
    regionId: z.string().min(1, 'Region is required').optional(),
    managerId: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal('setAreaActive'),
    areaId: z.string().min(1),
    active: z.boolean(),
  }),
  z.object({
    action: z.literal('deleteArea'),
    areaId: z.string().min(1),
  }),
  z.object({
    action: z.literal('createRegion'),
    name: z.string().trim().min(2, 'Region name must have at least 2 characters'),
    areaAdminId: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal('updateRegion'),
    regionId: z.string().min(1, 'Region ID is required'),
    name: z.string().trim().min(2, 'Region name must have at least 2 characters'),
    areaAdminId: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal('deleteRegion'),
    regionId: z.string().min(1, 'Region ID is required'),
  }),
  z.object({
    action: z.literal('setRegionActive'),
    regionId: z.string().min(1, 'Region ID is required'),
    active: z.boolean(),
  }),
]);

export async function GET() {
  try {
    await requireApiSession('area:manage');
    const store = await getStore();
    const [regions, areas] = await Promise.all([
      store.regions.find({ orderBy: [{ field: 'name' }] }),
      store.areas.find({ orderBy: [{ field: 'name' }] }),
    ]);

    return NextResponse.json({ ok: true, regions, areas });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Could not load regions.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireApiSession('area:manage');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid form submission.' },
        { status: 400 },
      );
    }
    const store = await getStore();
    const data = parsed.data;

    if (data.action === 'createRegion') {
      const region = await store.regions.create({
        name: data.name,
        areaAdminId: data.areaAdminId ?? null,
        active: true,
        createdAt: new Date().toISOString(),
      });

      if (data.areaAdminId) {
        await store.users.update(data.areaAdminId, { regionId: region.id });
      }

      revalidatePath('/admin/areas');
      revalidatePath('/admin/regions');
      revalidatePath('/admin/users');
      return NextResponse.json({
        ok: true,
        region,
        message: `Region "${region.name}" has been created.`,
      });
    }

    if (data.action === 'updateRegion') {
      const existing = await store.regions.get(data.regionId);
      if (!existing) throw new HttpError(404, 'Region not found.');

      const nextAreaAdminId =
        data.areaAdminId !== undefined
          ? (data.areaAdminId && data.areaAdminId.trim() ? data.areaAdminId.trim() : null)
          : existing.areaAdminId;

      const updated = await store.regions.update(data.regionId, {
        name: data.name.trim(),
        areaAdminId: nextAreaAdminId,
      });

      if (nextAreaAdminId && nextAreaAdminId !== existing.areaAdminId) {
        await store.users.update(nextAreaAdminId, { regionId: updated.id });
      }

      try {
        revalidatePath('/admin/areas');
        revalidatePath('/admin/regions');
        revalidatePath('/admin/users');
      } catch {
        // ignore
      }

      return NextResponse.json({
        ok: true,
        region: updated,
        message: `Region "${updated.name}" updated successfully.`,
      });
    }

    if (data.action === 'deleteRegion') {
      const existing = await store.regions.get(data.regionId);
      if (!existing) throw new HttpError(404, 'Region not found.');

      // Check if any area is assigned to this region
      const linkedAreasCount = await store.areas.count({
        regionId: data.regionId,
      });

      if (linkedAreasCount > 0) {
        throw new HttpError(
          409,
          `Cannot delete region "${existing.name}" because ${linkedAreasCount} ${
            linkedAreasCount === 1 ? 'area is' : 'areas are'
          } assigned to it. Please reassign or delete the areas first.`,
        );
      }

      // Clear region association from any assigned user
      const usersInRegion = await store.users.find({
        where: { regionId: data.regionId },
      });
      for (const u of usersInRegion) {
        await store.users.update(u.id, { regionId: null });
      }

      await store.regions.delete(data.regionId);

      try {
        revalidatePath('/admin/areas');
        revalidatePath('/admin/regions');
        revalidatePath('/admin/users');
      } catch {
        // ignore
      }

      return NextResponse.json({
        ok: true,
        message: `Region "${existing.name}" has been deleted.`,
      });
    }

    if (data.action === 'setRegionActive') {
      const existing = await store.regions.get(data.regionId);
      if (!existing) throw new HttpError(404, 'Region not found.');

      const updated = await store.regions.update(data.regionId, {
        active: data.active,
      });

      try {
        revalidatePath('/admin/areas');
        revalidatePath('/admin/regions');
      } catch {
        // ignore
      }

      return NextResponse.json({
        ok: true,
        region: updated,
        message: data.active
          ? `Region "${updated.name}" is active again.`
          : `Region "${updated.name}" has been disabled. Nobody assigned to it can sign in until it is re-enabled.`,
      });
    }

    if (data.action === 'create') {
      const existing = await store.areas.findOne({
        where: { name: data.name, city: data.city },
      });
      if (existing) {
        throw new HttpError(409, `An area named "${data.name}" in ${data.city} already exists.`);
      }

      const managerId = data.managerId && data.managerId.trim() ? data.managerId.trim() : null;

      const area = await store.areas.create({
        name: data.name,
        city: data.city,
        address: data.address?.trim() || null,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        regionId: data.regionId,
        managerId,
        active: true,
        createdAt: new Date().toISOString(),
      });

      if (managerId) {
        const staff = await store.staff.get(managerId);
        if (staff) {
          await store.staff.update(staff.id, { areaId: area.id });
          if (staff.userId) {
            await store.users.update(staff.userId, { areaId: area.id });
          }
        }
      }

      invalidateAreaPerformanceCache();
      try {
        revalidatePath('/admin/areas');
      revalidatePath('/admin/regions');
        revalidatePath('/admin/users');
      } catch {
        // ignore cache revalidation error if run outside valid context
      }

      return NextResponse.json({
        ok: true,
        area,
        message: `Area "${area.name}" created successfully.`,
      });
    }

    if (data.action === 'update') {
      const existing = await store.areas.get(data.areaId);
      if (!existing) throw new HttpError(404, 'Area not found.');

      const nextManagerId =
        data.managerId !== undefined
          ? (data.managerId && data.managerId.trim() ? data.managerId.trim() : null)
          : existing.managerId;

      const updated = await store.areas.update(data.areaId, {
        name: data.name ?? existing.name,
        city: data.city ?? existing.city,
        address: data.address !== undefined ? (data.address?.trim() || null) : existing.address,
        lat: data.lat !== undefined ? data.lat : (existing.lat ?? null),
        lng: data.lng !== undefined ? data.lng : (existing.lng ?? null),
        regionId: data.regionId ?? existing.regionId,
        managerId: nextManagerId,
      });

      // If manager changed, update staff and user area associations
      if (nextManagerId && nextManagerId !== existing.managerId) {
        const staff = await store.staff.get(nextManagerId);
        if (staff) {
          await store.staff.update(staff.id, { areaId: existing.id });
          if (staff.userId) {
            await store.users.update(staff.userId, { areaId: existing.id });
          }
        }
      }

      invalidateAreaPerformanceCache();
      try {
        revalidatePath('/admin/areas');
      revalidatePath('/admin/regions');
        revalidatePath('/admin/users');
      } catch {
        // ignore
      }

      return NextResponse.json({
        ok: true,
        area: updated,
        message: `Area "${updated.name}" updated successfully.`,
      });
    }

    if (data.action === 'setAreaActive') {
      const existing = await store.areas.get(data.areaId);
      if (!existing) throw new HttpError(404, 'Area not found.');

      const updated = await store.areas.update(data.areaId, {
        active: data.active,
      });

      invalidateAreaPerformanceCache();
      try {
        revalidatePath('/admin/areas');
        revalidatePath('/admin/regions');
      } catch {
        // ignore
      }

      return NextResponse.json({
        ok: true,
        area: updated,
        message: data.active
          ? `Area "${updated.name}" is active again.`
          : `Area "${updated.name}" has been disabled. Nobody assigned to it can sign in until it is re-enabled.`,
      });
    }

    if (data.action === 'deleteArea') {
      const existing = await store.areas.get(data.areaId);
      if (!existing) throw new HttpError(404, 'Area not found.');

      const [customerCount, staffCount] = await Promise.all([
        store.customers.count({ areaId: data.areaId }),
        store.staff.count({ areaId: data.areaId }),
      ]);

      if (customerCount > 0 || staffCount > 0) {
        throw new HttpError(
          409,
          `Cannot delete "${existing.name}": it still has ${customerCount} customer(s) and ` +
            `${staffCount} staff member(s). Reassign or remove them first, or disable the area instead.`,
        );
      }

      await store.areas.delete(data.areaId);

      invalidateAreaPerformanceCache();
      try {
        revalidatePath('/admin/areas');
        revalidatePath('/admin/regions');
      } catch {
        // ignore
      }

      return NextResponse.json({
        ok: true,
        message: `Area "${existing.name}" has been deleted.`,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[API /api/admin/areas Error]:', error);
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Could not process area request.';
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
