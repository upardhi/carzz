import {
  ScheduleClient,
  type ScheduleItem,
} from '@/components/console/ScheduleClient';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import type { Session } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { formatDateFull, todayISO } from '@/lib/util/format';

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

  // Fetch day visits, active staff, areas, and attendance
  const [visits, staff, areas, attendance] = await Promise.all([
    store.visits.find({
      where: { scheduledDate: date, ...areaFilter } as never,
      orderBy: [{ field: 'scheduledTime' }],
    }),
    store.staff.find({
      where: { role: 'EMPLOYEE', active: true, ...areaFilter } as never,
    }),
    store.areas.find(),
    store.attendance.find({ where: { date } }),
  ]);

  const customerIds = [...new Set(visits.map((v) => v.customerId))];
  const carIds = [...new Set(visits.map((v) => v.carId))];

  const [customers, cars] = await Promise.all([
    customerIds.length
      ? store.customers.find({ where: { id: { in: customerIds } } as never })
      : Promise.resolve([]),
    carIds.length
      ? store.cars.find({ where: { id: { in: carIds } } as never })
      : Promise.resolve([]),
  ]);

  const customerById = new Map(customers.map((c) => [c.id, c]));
  const carById = new Map(cars.map((c) => [c.id, c]));
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const areaById = new Map(areas.map((a) => [a.id, a]));

  const unassigned = visits.filter((v) => !v.staffId && v.status === 'PENDING');
  const absent = staff.filter((s) => {
    const record = attendance.find((a) => a.staffId === s.id);
    return !record?.loginAt && record?.status !== 'PRESENT';
  });

  const areaWithGaps = unassigned[0]?.areaId ?? null;
  const areaWithGapsName = areaWithGaps ? areaById.get(areaWithGaps)?.name ?? null : null;

  const enrichedVisits: ScheduleItem[] = visits.map((v) => {
    const customer = customerById.get(v.customerId);
    const car = carById.get(v.carId);
    const staffMember = v.staffId ? staffById.get(v.staffId) : null;
    const area = areaById.get(v.areaId);

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
      missReason: v.missReason,
    };
  });

  const accessibleAreas = session.scope.areaIds
    ? areas.filter((a) => session.scope.areaIds!.includes(a.id))
    : areas;

  return (
    <ScheduleClient
      visits={enrichedVisits}
      staff={staff.map((s) => ({ id: s.id, name: s.name, areaId: s.areaId }))}
      areas={accessibleAreas.map((a) => ({ id: a.id, name: a.name }))}
      absentStaffCount={absent.length}
      totalStaffCount={staff.length}
      date={date}
      dateFormatted={formatDateFull(date)}
      areaWithGaps={areaWithGaps}
      areaWithGapsName={areaWithGapsName}
      initialSearchParams={searchParams}
    />
  );
}

