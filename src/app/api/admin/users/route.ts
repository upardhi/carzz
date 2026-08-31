import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { hashPassword } from '@/lib/auth/password';
import { ROLES } from '@/lib/data/types';
import { getStore } from '@/lib/data';
import { todayISO } from '@/lib/util/format';

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    name: z.string().trim().min(2),
    email: z.string().trim().email(),
    phone: z.string().trim().min(6),
    password: z.string().min(6, 'Use at least 6 characters'),
    role: z.enum(ROLES),
    regionId: z.string().optional(),
    areaId: z.string().optional(),
  }),
  z.object({
    action: z.literal('setActive'),
    userId: z.string().min(1),
    active: z.boolean(),
  }),
]);

/** The owner owns the org chart: who exists, and what they can reach. */
export async function POST(request: Request) {
  try {
    const session = await requireApiSession('user:manage');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Check the form.' },
        { status: 400 },
      );
    }
    const store = await getStore();

    if (parsed.data.action === 'setActive') {
      if (parsed.data.userId === session.user.id && !parsed.data.active) {
        throw new HttpError(400, 'You cannot deactivate your own account.');
      }
      const user = await store.users.get(parsed.data.userId);
      if (!user) throw new HttpError(404, 'User not found.');

      await store.users.update(user.id, { active: parsed.data.active });
      // Keep the staff record in step, or a deactivated manager still shows as
      // running an area.
      if (user.staffId) {
        await store.staff.update(user.staffId, { active: parsed.data.active });
      }

      return NextResponse.json({
        ok: true,
        message: parsed.data.active ? 'Reactivated.' : 'Deactivated — their login no longer works.',
      });
    }

    const data = parsed.data;
    const existing = await store.users.findOne({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) throw new HttpError(409, 'Someone already uses that email.');

    if ((data.role === 'MANAGER' || data.role === 'EMPLOYEE') && !data.areaId) {
      throw new HttpError(400, 'A manager or wash boy must be given an area.');
    }
    if (data.role === 'AREA_ADMIN' && !data.regionId) {
      throw new HttpError(400, 'An area admin must be given a region.');
    }

    // Manager and employee logins are backed by a staff record, so they appear
    // in rosters, payouts and schedules like anyone else.
    let staffId: string | null = null;
    if (data.role === 'MANAGER' || data.role === 'EMPLOYEE') {
      const staff = await store.staff.create({
        userId: '',
        name: data.name,
        phone: data.phone,
        areaId: data.areaId!,
        role: data.role,
        joinedOn: todayISO(),
        referredByStaffId: null,
        active: true,
      });
      staffId = staff.id;
    }

    const user = await store.users.create({
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone,
      role: data.role,
      regionId: data.regionId ?? null,
      areaId: data.areaId ?? null,
      customerId: null,
      staffId,
      language: data.role === 'EMPLOYEE' ? 'mr' : 'en',
      active: true,
      createdAt: new Date().toISOString(),
    });

    if (staffId) await store.staff.update(staffId, { userId: user.id });
    if (data.role === 'MANAGER' && data.areaId) {
      await store.areas.update(data.areaId, { managerId: staffId });
    }
    if (data.role === 'AREA_ADMIN' && data.regionId) {
      await store.regions.update(data.regionId, { areaAdminId: user.id });
    }

    await store.setCredential(user.id, await hashPassword(data.password));

    return NextResponse.json({
      ok: true,
      user,
      message: `${user.name} can now sign in with ${user.email}.`,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Could not save that person.' },
      { status: 500 },
    );
  }
}
