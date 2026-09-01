import {
  AreaDashboardClient,
  type StaffTodayItem,
} from '@/components/console/AreaDashboardClient';
import type { Session } from '@/lib/auth/server';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import { getStore } from '@/lib/data';
import { loadRedAlerts } from '@/lib/services/accounts';
import { areaPerformance } from '@/lib/services/reports';
import {
  currentCycle,
  cycleLabel,
  formatClock,
  todayISO,
} from '@/lib/util/format';

/**
 * The console dashboard screen.
 */
export async function ConsoleDashboard({
  session,
  base,
}: {
  session: Session;
  base: string;
}) {
  const store = await getStore();
  const cycle = currentCycle();
  const today = todayISO();
  const areaFilter = scopeAreaFilter(session.scope);

  const [visits, alerts, complaints, staff, performance] = await Promise.all([
    store.visits.find({ where: { scheduledDate: today, ...areaFilter } as never }),
    loadRedAlerts(store, session.scope.areaIds),
    store.complaints.find({
      where: { status: { in: ['OPEN', 'ESCALATED'] }, ...areaFilter } as never,
      orderBy: [{ field: 'createdAt' }],
    }),
    store.staff.find({ where: { role: 'EMPLOYEE', ...areaFilter } as never }),
    areaPerformance(store, cycle, session.scope.areaIds),
  ]);

  const attendance = await store.attendance.find({ where: { date: today } });
  const attendanceByStaff = new Map(attendance.map((a) => [a.staffId, a]));

  const unassigned = visits.filter((v) => !v.staffId && v.status === 'PENDING');
  const done = visits.filter((v) => v.status === 'DONE').length;
  const missed = visits.filter((v) => v.status === 'MISSED').length;
  const outstanding = alerts.reduce((sum, a) => sum + a.amount, 0);

  const totals = performance.reduce(
    (acc, area) => ({
      customers: acc.customers + area.customers,
      washesDone: acc.washesDone + area.washesDone,
      washesMissed: acc.washesMissed + area.washesMissed,
      collected: acc.collected + area.collected,
    }),
    { customers: 0, washesDone: 0, washesMissed: 0, collected: 0 },
  );

  const staffTodayFormatted: StaffTodayItem[] = staff
    .map((member) => {
      const own = visits.filter((v) => v.staffId === member.id);
      const att = attendanceByStaff.get(member.id);
      const absent = !att?.loginAt && att?.status !== 'PRESENT';
      return {
        id: member.id,
        name: member.name,
        signedIn: att?.loginAt ? formatClock(att.loginAt) : null,
        cars: own.length,
        done: own.filter((v) => v.status === 'DONE').length,
        status: (absent ? 'Absent' : 'Working') as 'Absent' | 'Working',
      };
    })
    .sort((a, b) => b.cars - a.cars);

  const areasCount = session.scope.areaIds?.length ?? performance.length;

  return (
    <AreaDashboardClient
      totals={totals}
      carsToday={visits.length}
      completedToday={done}
      notDoneToday={missed}
      unassignedToday={unassigned.length}
      outstanding={outstanding}
      alertsCount={alerts.length}
      oldestAlertDays={alerts[0]?.daysOverdue ?? 0}
      complaintsCount={complaints.length}
      escalatedComplaintsCount={
        complaints.filter((c) => c.status === 'ESCALATED').length
      }
      staffToday={staffTodayFormatted}
      performance={performance}
      cycleLabel={cycleLabel(cycle)}
      areasCount={areasCount}
      base={base}
    />
  );
}

