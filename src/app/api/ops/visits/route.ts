import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { reassignVisit } from '@/lib/services/visits';
import { assertInScope, opsError } from '../_guard';

function revalidateVisitPages() {
  try {
    for (const base of ['/admin', '/manager', '/area']) {
      revalidatePath(`${base}/schedule`);
      revalidatePath(`${base}/areas/[areaId]`, 'page');
      revalidatePath(`${base}/customers/[customerId]`, 'page');
    }
  } catch {
    // ignore — running outside a request context
  }
}

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('assign'),
    visitId: z.string().min(1),
    staffId: z.string().min(1).nullable(),
  }),
  z.object({
    action: z.literal('autoAssign'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    areaId: z.string().min(1),
  }),
  z.object({
    action: z.literal('rateWash'),
    visitId: z.string().min(1),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(500).optional(),
  }),
]);

export async function POST(request: Request) {
  try {
    const raw = await request.json().catch(() => null);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const session = await requireApiSession(
      parsed.data.action === 'rateWash' ? 'visit:rate' : 'visit:assign',
    );
    const store = await getStore();

    if (parsed.data.action === 'rateWash') {
      const visit = await store.visits.get(parsed.data.visitId);
      if (!visit) throw new HttpError(404, 'That wash was not found.');
      assertInScope(session, visit.areaId);
      if (visit.status !== 'DONE') {
        throw new HttpError(400, 'Only a completed wash can be rated.');
      }

      const updated = await store.visits.update(visit.id, {
        managerRating: parsed.data.rating,
        managerRatingComment: parsed.data.comment?.trim() || null,
        managerRatedAt: new Date().toISOString(),
        managerRatedByUserId: session.user.id,
      });
      revalidateVisitPages();
      return NextResponse.json({
        ok: true,
        visit: updated,
        message: 'Rating saved.',
      });
    }

    if (parsed.data.action === 'assign') {
      const visit = await store.visits.get(parsed.data.visitId);
      if (!visit) throw new HttpError(404, 'That wash was not found.');
      assertInScope(session, visit.areaId);

      if (parsed.data.staffId) {
        const staff = await store.staff.get(parsed.data.staffId);
        if (!staff) throw new HttpError(404, 'That staff member was not found.');
        // Moving a car to a boy in another area would send him across the city.
        if (staff.areaId !== visit.areaId) {
          throw new HttpError(400, 'That staff member works in another area.');
        }
        if (!staff.active) {
          throw new HttpError(400, `${staff.name} is deactivated and cannot be assigned washes.`);
        }
      }

      const updated = await reassignVisit(store, visit.id, parsed.data.staffId);
      revalidateVisitPages();
      return NextResponse.json({ ok: true, visit: updated });
    }

    /* Auto-assign: spread unassigned cars over the area's staff, giving each
     * one to whoever has the lightest round so far that day. */
    assertInScope(session, parsed.data.areaId);

    const [visits, staff] = await Promise.all([
      store.visits.find({
        where: { areaId: parsed.data.areaId, scheduledDate: parsed.data.date },
        orderBy: [{ field: 'scheduledTime' }],
      }),
      store.staff.find({
        where: { areaId: parsed.data.areaId, role: 'EMPLOYEE', active: true },
      }),
    ]);

    if (!staff.length) {
      throw new HttpError(400, 'This area has no active staff to assign to.');
    }

    // Anyone marked absent today is not available to cover.
    const attendance = await store.attendance.find({
      where: { date: parsed.data.date },
    });
    const absent = new Set(
      attendance
        .filter((a) => a.status !== 'PRESENT')
        .map((a) => a.staffId),
    );
    const available = staff.filter((s) => !absent.has(s.id));
    const pool = available.length ? available : staff;

    const load = new Map<string, number>(pool.map((s) => [s.id, 0]));
    for (const visit of visits) {
      if (visit.staffId && load.has(visit.staffId)) {
        load.set(visit.staffId, (load.get(visit.staffId) ?? 0) + 1);
      }
    }

    const updates: { visitId: string; staffId: string }[] = [];
    for (const visit of visits) {
      if (visit.staffId || visit.status !== 'PENDING') continue;
      const lightest = [...load.entries()].sort((a, b) => a[1] - b[1])[0];
      updates.push({ visitId: visit.id, staffId: lightest[0] });
      load.set(lightest[0], lightest[1] + 1);
    }

    await Promise.all(
      updates.map((u) => store.visits.update(u.visitId, { staffId: u.staffId })),
    );
    const assigned = updates.length;

    revalidateVisitPages();
    return NextResponse.json({
      ok: true,
      assigned,
      message:
        assigned === 0
          ? 'Every car already has a wash boy.'
          : `${assigned} ${assigned === 1 ? 'car' : 'cars'} assigned. Staff and customers notified.`,
    });
  } catch (error) {
    return opsError(error);
  }
}
