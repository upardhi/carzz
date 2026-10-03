import {
  ScheduleClient,
  type ScheduleItem,
} from '@/components/console/ScheduleClient';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import type { Session } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { formatDateFull, todayISO } from '@/lib/util/format';
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';
import { visitsForDate } from '@/lib/services/schedule';
import { isOneTimeWash } from '@/lib/util/labels';

/**
 * The live schedule page for the day's rounds.
 */
export async function ConsoleSchedule({
  session,
  searchParams,
}: {
  session: Session;
  searchParams: Record<string, string | undefined>;
}) {
  const store = await getStore();
  const date = searchParams.date ?? todayISO();
  const areaFilter = scopeAreaFilter(session.scope);

  // Fetch day visits (including carried-over backlog), active staff, areas, attendance, and approved leaves
  const [visits, staff, areas, attendance, leaves] = await Promise.all([
    visitsForDate(store, date, {
      ...(session.scope.areaIds ? { areaIds: session.scope.areaIds } : {}),
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
  // Staff is considered ON DUTY / PRESENT by default unless explicitly recorded as OFF or ABSENT or on approved leave
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

  const enrichedVisits: ScheduleItem[] = visits.map((v) => {
    const customer = customerById.get(v.customerId);
    const car = carById.get(v.carId);
    const staffMember = v.staffId ? staffById.get(v.staffId) : null;
    const area = areaById.get(v.areaId);
    const custInvoices = invoicesByCustomer.get(v.customerId) || [];
    const custCars = carsByCustomer.get(v.customerId) || [];
    
    // Calculate car-specific dues and payment status
    let customerDueAmount = 0;
    let customerDueStatus: ScheduleItem['customerDueStatus'] = null;
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
        // Multi-car account: allocate paid amounts prioritizing cars that have completed washes
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
      scheduledTime: v.scheduledTime,
      customerId: v.customerId,
      customerName: customer?.name ?? 'Unknown Customer',
      carId: v.carId,
      carModel: car?.model ?? 'Car',
      carPlate: car?.plate ?? '—',
      areaId: v.areaId,
      areaName: area?.name ?? 'Area',
      staffId: v.staffId,
      staffName: staffMember?.name ?? null,
      status: v.status as ScheduleItem['status'],
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
      isOneTime: isOneTimeWash(v),
      plannedService: v.plannedService,
    };
  });

  const accessibleAreas = session.scope.areaIds
    ? areas.filter((a) => session.scope.areaIds!.includes(a.id))
    : areas;

  const onLeaveStaffNames = staff
    .filter((s) => absentStaffIds.has(s.id))
    .map((s) => s.name);

  return (
    <ScheduleClient
      visits={enrichedVisits}
      staff={staff.map((s) => ({
        id: s.id,
        name: s.name,
        areaId: s.areaId,
        isOnLeave: absentStaffIds.has(s.id),
      }))}
      areas={accessibleAreas.map((a) => ({ id: a.id, name: a.name }))}
      absentStaffCount={absent.length}
      totalStaffCount={staff.length}
      date={date}
      dateFormatted={formatDateFull(date)}
      areaWithGaps={areaWithGaps}
      areaWithGapsName={areaWithGapsName}
      onLeaveStaffNames={onLeaveStaffNames}
      initialSearchParams={searchParams}
    />
  );
}


