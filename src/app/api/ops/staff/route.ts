import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { hashPassword } from '@/lib/auth/password';
import { getStore } from '@/lib/data';
import { todayISO } from '@/lib/util/format';
import { assertInScope, opsError } from '../_guard';

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    name: z.string().trim().min(2),
    phone: z.string().trim().min(6),
    email: z.string().trim().email(),
    password: z.string().min(6, 'Use at least 6 characters'),
    areaId: z.string().min(1),
    referredByStaffId: z.string().optional(),
  }),
  z.object({
    action: z.literal('setActive'),
    staffId: z.string().min(1),
    active: z.boolean(),
  }),
  z.object({
    action: z.literal('markAttendance'),
    staffId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(['PRESENT', 'ABSENT', 'OFF', 'OFF_UNINFORMED']),
  }),
]);

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('staff:create');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Check the form.' },
        { status: 400 },
      );
    }
    const store = await getStore();

    if (parsed.data.action === 'create') {
      assertInScope(session, parsed.data.areaId);

      const existing = await store.users.findOne({
        where: { email: parsed.data.email.toLowerCase() },
      });
      if (existing) {
        throw new HttpError(409, 'Someone already uses that email.');
      }

      const staff = await store.staff.create({
        userId: '',
        name: parsed.data.name,
        phone: parsed.data.phone,
        areaId: parsed.data.areaId,
        role: 'EMPLOYEE',
        joinedOn: todayISO(),
        referredByStaffId: parsed.data.referredByStaffId || null,
        active: true,
      });

      const user = await store.users.create({
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        phone: parsed.data.phone,
        role: 'EMPLOYEE',
        regionId: null,
        areaId: parsed.data.areaId,
        customerId: null,
        staffId: staff.id,
        language: 'mr',
        active: true,
        createdAt: new Date().toISOString(),
      });

      await store.staff.update(staff.id, { userId: user.id });
      await store.setCredential(user.id, await hashPassword(parsed.data.password));

      return NextResponse.json({
        ok: true,
        staff,
        message: parsed.data.referredByStaffId
          ? 'Staff added. The referral bonus is queued for the referrer.'
          : 'Staff added. They can sign in with the email and password you set.',
      });
    }

    if (parsed.data.action === 'setActive') {
      const staff = await store.staff.get(parsed.data.staffId);
      if (!staff) throw new HttpError(404, 'Staff member not found.');
      assertInScope(session, staff.areaId);

      await store.staff.update(staff.id, { active: parsed.data.active });
      // Deactivating the staff record must also close the login, or a
      // dismissed wash boy keeps a working app.
      await store.users.update(staff.userId, { active: parsed.data.active });

      if (!parsed.data.active) {
        await store.visits.updateMany(
          {
            staffId: staff.id,
            status: 'PENDING',
            scheduledDate: { gte: todayISO() },
          } as never,
          { staffId: null },
        );
      }

      return NextResponse.json({
        ok: true,
        message: parsed.data.active
          ? 'Reactivated.'
          : 'Deactivated. Their upcoming cars are now unassigned.',
      });
    }

    const staff = await store.staff.get(parsed.data.staffId);
    if (!staff) throw new HttpError(404, 'Staff member not found.');
    assertInScope(session, staff.areaId);

    const existing = await store.attendance.findOne({
      where: { staffId: staff.id, date: parsed.data.date },
    });

    const attendance = existing
      ? await store.attendance.update(existing.id, { status: parsed.data.status })
      : await store.attendance.create({
          staffId: staff.id,
          date: parsed.data.date,
          loginAt: null,
          status: parsed.data.status,
          note: null,
        });

    return NextResponse.json({ ok: true, attendance, message: 'Attendance updated.' });
  } catch (error) {
    return opsError(error);
  }
}
