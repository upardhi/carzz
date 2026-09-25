import {
  AreaDashboardClient,
  type StaffTodayItem,
} from '@/components/console/AreaDashboardClient';
import type { Session } from '@/lib/auth/server';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import { getStore } from '@/lib/data';
import { loadRedAlerts } from '@/lib/services/accounts';
import { computePayoutRun } from '@/lib/services/payroll';
import {
  areaPerformance,
  businessSummary,
  dailyOperationsReport,
  customerStaffGrowthReport,
} from '@/lib/services/reports';
import {
  currentCycle,
  cycleLabel,
  formatClock,
  todayISO,
} from '@/lib/util/format';

/**
 * The console dashboard screen for Area Admins and Managers.
 * Scoped precisely to their assigned area or region.
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
  const areaIds = session.scope.areaIds;

  const payouts = await computePayoutRun(store, cycle, areaIds);
  const performance = await areaPerformance(store, cycle, areaIds, payouts);

  const [
    visits,
    alerts,
    complaintsCount,
    escalatedComplaintsCount,
    staff,
    lowRatedCount,
    dailyOps,
    growth,
    summary,
  ] = await Promise.all([
    store.visits.find({ where: { scheduledDate: today, ...areaFilter } as never }),
    loadRedAlerts(store, areaIds),
    store.complaints.count({
      status: { in: ['OPEN', 'ESCALATED'] },
      ...areaFilter,
    } as never),
    store.complaints.count({
      status: 'ESCALATED',
      ...areaFilter,
    } as never),
    store.staff.find({ where: { role: 'EMPLOYEE', ...areaFilter } as never }),
    store.visits.count({
      cycle,
      rating: { ne: null, lt: 3 },
      ...areaFilter,
    } as never),
    dailyOperationsReport(store, areaIds),
    customerStaffGrowthReport(store, cycle, areaIds),
    businessSummary(store, cycle, areaIds, performance),
  ]);

  const staffIds = staff.map((s) => s.id);
  const staffIdSet = new Set(staffIds);
  const staffById = new Map(staff.map((s) => [s.id, s]));

  const [attendance, allLeaves] = await Promise.all([
    staffIds.length
      ? store.attendance.find({ where: { date: today, staffId: { in: staffIds } } as never })
      : [],
    staffIds.length
      ? store.leaves.find({ where: { staffId: { in: staffIds } } as never })
      : [],
  ]);

  const attendanceByStaff = new Map(attendance.map((a) => [a.staffId, a]));

  const pendingLeavesCount = allLeaves.filter(
    (l) => staffIdSet.has(l.staffId) && l.status === 'PENDING',
  ).length;

  const staffOnLeaveToday = allLeaves.filter(
    (l) =>
      staffIdSet.has(l.staffId) &&
      l.status === 'APPROVED' &&
      l.startDate <= today &&
      l.endDate >= today,
  );
  const staffOnLeaveNames = staffOnLeaveToday.map(
    (l) => staffById.get(l.staffId)?.name ?? 'Staff',
  );

  const uninformedLeavesCount = allLeaves.filter(
    (l) => staffIdSet.has(l.staffId) && l.type === 'UNINFORMED',
  ).length;

  const unassigned = visits.filter((v) => !v.staffId && v.status === 'PENDING');
  const assigned = visits.filter((v) => Boolean(v.staffId));
  const done = visits.filter((v) => v.status === 'DONE').length;
  const inProgress = visits.filter((v) => v.status === 'IN_PROGRESS').length;
  const pending = visits.filter((v) => v.status === 'PENDING').length;
  const missed = visits.filter((v) => v.status === 'MISSED').length;
  const outstanding = alerts.reduce((sum, a) => sum + a.amount, 0);

  const unapproved = payouts.filter((p) => p.status === 'DRAFT' && p.net > 0);
  const unapprovedTotal = unapproved.reduce((sum, p) => sum + p.net, 0);

  const totals = performance.reduce(
    (acc, area) => ({
      customers: acc.customers + area.customers,
      activeCars: acc.activeCars + area.activeCars,
      washesDone: acc.washesDone + area.washesDone,
      washesMissed: acc.washesMissed + area.washesMissed,
      collected: acc.collected + area.collected,
    }),
    { customers: 0, activeCars: 0, washesDone: 0, washesMissed: 0, collected: 0 },
  );

  // Staff is considered ON DUTY / PRESENT by default unless explicitly recorded as OFF or ABSENT
  const staffTodayFormatted: StaffTodayItem[] = staff
    .map((member) => {
      const own = visits.filter((v) => v.staffId === member.id);
      const att = attendanceByStaff.get(member.id);
      const isAbsent =
        att?.status === 'OFF' ||
        att?.status === 'ABSENT' ||
        att?.status === 'OFF_UNINFORMED';
      return {
        id: member.id,
        name: member.name,
        signedIn: att?.loginAt ? formatClock(att.loginAt) : null,
        cars: own.length,
        done: own.filter((v) => v.status === 'DONE').length,
        status: (isAbsent ? 'Absent' : 'Working') as 'Absent' | 'Working',
      };
    })
    .sort((a, b) => b.cars - a.cars);

  const staffWorkingCount = staffTodayFormatted.filter((s) => s.status === 'Working').length;
  const staffAbsentCount = staffTodayFormatted.filter((s) => s.status === 'Absent').length;
  const staffAttendanceRate =
    staff.length > 0 ? Math.round((staffWorkingCount / staff.length) * 100) : 100;

  const areasCount = session.scope.areaIds?.length ?? performance.length;
  const resolvedActiveCars = totals.activeCars;

  return (
    <AreaDashboardClient
      totals={totals}
      activeCars={resolvedActiveCars}
      carsToday={visits.length}
      completedToday={done}
      inProgressToday={inProgress}
      pendingToday={pending}
      remainingToday={inProgress + pending}
      assignedToday={assigned.length}
      notDoneToday={missed}
      unassignedToday={unassigned.length}
      staffWorkingCount={staffWorkingCount}
      staffAbsentCount={staffAbsentCount}
      staffAttendanceRate={staffAttendanceRate}
      outstanding={outstanding}
      alertsCount={alerts.length}
      oldestAlertDays={alerts[0]?.daysOverdue ?? 0}
      complaintsCount={complaintsCount}
      escalatedComplaintsCount={escalatedComplaintsCount}
      lowRatedCount={lowRatedCount}
      uninformedLeavesCount={uninformedLeavesCount}
      staffToday={staffTodayFormatted}
      performance={performance}
      cycleLabel={cycleLabel(cycle)}
      areasCount={areasCount}
      base={base}
      pendingLeavesCount={pendingLeavesCount}
      staffOnLeaveNames={staffOnLeaveNames}
      dailyOps={dailyOps}
      growth={growth}
      summary={summary}
      unapprovedPayoutsCount={unapproved.length}
      unapprovedPayoutsTotal={unapprovedTotal}
    />
  );
}
