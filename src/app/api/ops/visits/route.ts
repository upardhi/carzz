import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import { getStore } from '@/lib/data';
import { reassignVisit } from '@/lib/services/visits';
import { formatDateFull, todayISO } from '@/lib/util/format';
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';
import { visitsForDate } from '@/lib/services/schedule';
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

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession('visit:view');
    const store = await getStore();
    const { searchParams } = new URL(request.url);

    const date = searchParams.get('date') ?? todayISO();
    const areaId = searchParams.get('areaId');
    const areaFilter = areaId ? { areaId } : scopeAreaFilter(session.scope);

    // Fetch day visits (including carried-over uncompleted washes), active staff, areas, attendance, and approved leaves
    const [visits, staff, areas, attendance, leaves] = await Promise.all([
      visitsForDate(store, date, {
        ...(areaId ? { areaId } : session.scope.areaIds ? { areaIds: session.scope.areaIds } : {}),
        includeBacklog: true,
      }),
      store.staff.find({
        where: { role: 'EMPLOYEE', active: true, ...areaFilter } as never,
      }),
      store.areas.find(),
      store.attendance.find({ where: { date } }),
      store.leaves.find({
        where: {
          status: 'APPROVED',
          startDate: { lte: date },
          endDate: { gte: date },
        } as never,
      }),
    ]);

    const onLeaveStaffIds = new Set(leaves.map((l) => l.staffId));
    const customerIds = [...new Set(visits.map((v) => v.customerId))];

    const [customers, allCars, invoices, packages, doneVisits] = await Promise.all([
      customerIds.length
        ? store.customers.find({ where: { id: { in: customerIds } } as never })
        : Promise.resolve([]),
      customerIds.length
        ? store.cars.find({ where: { customerId: { in: customerIds }, active: true } as never })
        : Promise.resolve([]),
      customerIds.length
        ? store.invoices.find({ where: { customerId: { in: customerIds } } as never })
        : Promise.resolve([]),
      store.packages.find(),
      customerIds.length
        ? store.visits.find({ where: { customerId: { in: customerIds }, status: 'DONE' } as never })
        : Promise.resolve([]),
    ]);

    const customerById = new Map(customers.map((c) => [c.id, c]));
    const carById = new Map(allCars.map((c) => [c.id, c]));
    const staffById = new Map(staff.map((s) => [s.id, s]));
    const areaById = new Map(areas.map((a) => [a.id, a]));
    const packageById = new Map(packages.map((p) => [p.id, p]));

    const carsByCustomer = new Map<string, typeof allCars>();
    for (const c of allCars) {
      const list = carsByCustomer.get(c.customerId) || [];
      list.push(c);
      carsByCustomer.set(c.customerId, list);
    }

    const invoicesByCustomer = new Map<string, typeof invoices>();
    for (const inv of invoices) {
      const list = invoicesByCustomer.get(inv.customerId) || [];
      list.push(inv);
      invoicesByCustomer.set(inv.customerId, list);
    }

    const unassigned = visits.filter((v) => !v.staffId && v.status === 'PENDING');
    const absent = staff.filter((s) => {
      const record = attendance.find((a) => a.staffId === s.id);
      const isRecordedAbsent =
        record?.status === 'OFF' ||
        record?.status === 'ABSENT' ||
        record?.status === 'OFF_UNINFORMED';
      return isRecordedAbsent || onLeaveStaffIds.has(s.id);
    });
    const absentStaffIds = new Set(absent.map((s) => s.id));

    const areaWithGaps = unassigned[0]?.areaId ?? null;
    const areaWithGapsName = areaWithGaps ? areaById.get(areaWithGaps)?.name ?? null : null;

    const enrichedVisits = visits.map((v) => {
      const customer = customerById.get(v.customerId);
      const car = carById.get(v.carId);
      const staffMember = v.staffId ? staffById.get(v.staffId) : null;
      const area = areaById.get(v.areaId);
      const custInvoices = invoicesByCustomer.get(v.customerId) || [];
      const custCars = carsByCustomer.get(v.customerId) || [];

      let customerDueAmount = 0;
      let customerDueStatus: 'PAID' | 'DUE' | 'OVERDUE' | null = null;
      let customerDueOn: string | null = null;

      if (custInvoices.length > 0) {
        const openInvoices = custInvoices.filter((i) => i.status !== 'PAID' && i.status !== 'WRITTEN_OFF');
        const totalPaid = custInvoices.reduce((sum, i) => sum + i.paidAmount, 0);
        const isOverdue = openInvoices.some((i) => i.status === 'OVERDUE' || i.dueOn < todayISO());
        customerDueOn = openInvoices[0]?.dueOn ?? null;

        if (openInvoices.length === 0) {
          customerDueStatus = 'PAID';
          customerDueAmount = 0;
        } else if (custCars.length <= 1) {
          customerDueAmount = openInvoices.reduce((sum, i) => sum + (i.amount - i.paidAmount), 0);
          customerDueStatus = customerDueAmount > 0 ? (isOverdue ? 'OVERDUE' : 'DUE') : 'PAID';
        } else {
          const sortedCars = [...custCars].sort((a, b) => {
            const doneA = doneVisits.filter((dv) => dv.carId === a.id).length;
            const doneB = doneVisits.filter((dv) => dv.carId === b.id).length;
            if ((doneA > 0) !== (doneB > 0)) {
              return doneA > 0 ? -1 : 1;
            }
            if (doneA !== doneB) {
              return doneB - doneA;
            }
            const startedA = a.serviceStartedAt
              ? new Date(a.serviceStartedAt).getTime()
              : a.serviceStarted ? 1 : 0;
            const startedB = b.serviceStartedAt
              ? new Date(b.serviceStartedAt).getTime()
              : b.serviceStarted ? 1 : 0;
            if (startedA !== startedB) {
              return startedA - startedB;
            }
            return a.id.localeCompare(b.id);
          });

          let remainingPaid = totalPaid;
          let carDue = 0;
          for (const c of sortedCars) {
            const pkg = packageById.get(c.packageId);
            const price = pkg?.price ?? 0;
            const allocated = Math.min(price, remainingPaid);
            remainingPaid -= allocated;
            const due = Math.max(0, price - allocated);
            if (c.id === v.carId) {
              carDue = due;
              break;
            }
          }
          customerDueAmount = carDue;
          customerDueStatus = carDue > 0 ? (isOverdue ? 'OVERDUE' : 'DUE') : 'PAID';
        }
      }

      return {
        id: v.id,
        scheduledDate: v.scheduledDate,
        scheduledTime: v.scheduledTime,
        isCarriedOver: v.scheduledDate < date,
        customerId: v.customerId,
        customerName: customer?.name ?? 'Unknown Customer',
        customerPhone: customer?.phone ?? null,
        carId: v.carId,
        carModel: car?.model ?? 'Car',
        carPlate: car?.plate ?? '—',
        areaId: v.areaId,
        areaName: area?.name ?? 'Area',
        staffId: v.staffId,
        staffName: staffMember?.name ?? null,
        status: v.status,
        completedAt: v.completedAt,
        startedAt: v.startedAt,
        missReason: v.missReason,
        beforePhotoUrl: resolvePublicPhotoUrl(v.beforePhotoUrl),
        afterPhotoUrl: resolvePublicPhotoUrl(v.afterPhotoUrl),
        rating: v.rating,
        ratingComment: v.ratingComment,
        managerRating: v.managerRating,
        managerRatingComment: v.managerRatingComment,
        customerDueAmount,
        customerDueStatus,
        customerDueOn,
      };
    });

    const accessibleAreas = session.scope.areaIds
      ? areas.filter((a) => session.scope.areaIds!.includes(a.id))
      : areas;

    return NextResponse.json({
      success: true,
      date,
      dateFormatted: formatDateFull(date),
      summary: {
        totalVisits: visits.length,
        doneCount: visits.filter((v) => v.status === 'DONE').length,
        pendingCount: visits.filter((v) => v.status === 'PENDING').length,
        unassignedCount: unassigned.length,
        totalStaffCount: staff.length,
        absentStaffCount: absent.length,
        areaWithGaps,
        areaWithGapsName,
      },
      staff: staff.map((s) => ({
        id: s.id,
        name: s.name,
        phone: s.phone,
        areaId: s.areaId,
        isOnLeave: absentStaffIds.has(s.id),
      })),
      areas: accessibleAreas.map((a) => ({ id: a.id, name: a.name })),
      visits: enrichedVisits,
    });
  } catch (error) {
    return opsError(error);
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
