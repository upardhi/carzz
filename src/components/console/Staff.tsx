import Link from 'next/link';
import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Kpi,
  KpiGrid,
} from '@/components/ui/primitives';
import { DataTable } from '@/components/ui/DataTable';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import type { Session } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { computePayoutRun, pocketAllowance } from '@/lib/services/payroll';
import { staffPerformance } from '@/lib/services/reports';
import {
  currentCycle,
  formatClock,
  formatDateFull,
  money,
  percent,
  todayISO,
} from '@/lib/util/format';
import { ActionButton } from './ActionButton';
import { AddStaffForm } from './AddStaffForm';

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_PALETTES = [
  'bg-navy-50 text-navy-700',
  'bg-success-50 text-success-700',
  'bg-gold-50 text-gold-700',
  'bg-navy-100 text-navy-800',
  'bg-warning-50 text-warning-700',
  'bg-danger-50 text-danger-700',
];

export async function ConsoleStaff({
  session,
  base = '/area',
}: {
  session: Session;
  base?: string;
}) {
  const store = await getStore();
  const cycle = currentCycle();
  const today = todayISO();
  const areaFilter = scopeAreaFilter(session.scope);

  const [staff, areas, rules, performance, payoutList] = await Promise.all([
    store.staff.find({
      where: { role: 'EMPLOYEE', ...areaFilter } as never,
      orderBy: [{ field: 'name' }],
    }),
    store.areas.find(),
    store.getPayoutSettings(),
    staffPerformance(store, cycle, session.scope.areaIds),
    computePayoutRun(store, cycle, session.scope.areaIds),
  ]);

  const staffIds = new Set(staff.map((s) => s.id));
  const [attendanceToday, todayVisits, allPocket] = await Promise.all([
    store.attendance.find({ where: { date: today } }),
    store.visits.find({ where: { scheduledDate: today, ...areaFilter } as never }),
    store.pocketRequests.find({
      where: { status: 'PENDING' },
      orderBy: [{ field: 'requestedAt' }],
    }),
  ]);

  const payouts = new Map(payoutList.map((p) => [p.staffId, p]));
  const pending = allPocket.filter((r) => staffIds.has(r.staffId));
  const allowances = new Map(
    await Promise.all(
      pending.map(
        async (r) =>
          [
            r.id,
            await pocketAllowance(
              store,
              r.staffId,
              cycle,
              payouts.get(r.staffId),
            ),
          ] as const,
      ),
    ),
  );

  const attendanceByStaff = new Map(attendanceToday.map((a) => [a.staffId, a]));
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const performanceById = new Map(performance.rows.map((p) => [p.staffId, p]));
  const staffById = new Map(staff.map((s) => [s.id, s]));

  // Anyone over the monthly off allowance is a discipline conversation waiting
  // to happen, so surface them rather than burying it in the payout.
  const monthAttendance = await store.attendance.find({
    where: { date: { gte: `${cycle}-01`, lte: `${cycle}-31` } } as never,
  });
  const flags = staff
    .map((member) => {
      const own = monthAttendance.filter((a) => a.staffId === member.id);
      return {
        member,
        offs: own.filter((a) => a.status === 'OFF').length,
        uninformed: own.filter((a) => a.status === 'OFF_UNINFORMED').length,
      };
    })
    .filter((f) => f.offs > rules.offsAllowedPerMonth || f.uninformed > 0);

  const absentToday = staff.filter((s) => {
    const record = attendanceByStaff.get(s.id);
    return !record?.loginAt && record?.status !== 'PRESENT';
  });

  return (
    <>
      <PageHeader title="Staff" description={`${staff.length} wash boys`} />

      <KpiGrid columns={6}>
        <Kpi
          label="WASH BOYS"
          value={staff.length}
          tone="purple"
          subtext="Total workforce"
        />
        <Kpi
          label="WORKING TODAY"
          value={staff.length - absentToday.length}
          tone="emerald"
          subtext="On duty now"
        />
        <Kpi
          label="ABSENT TODAY"
          value={absentToday.length}
          tone={absentToday.length ? 'rose' : 'slate'}
          subtext={absentToday.length ? `${absentToday.length} staff missing` : 'Full attendance'}
        />
        <Kpi
          label="POCKET REQUESTS"
          value={pending.length}
          tone={pending.length ? 'amber' : 'slate'}
          subtext={pending.length ? `${pending.length} need approval` : 'No pending requests'}
        />
        <Kpi
          label="DISCIPLINE FLAGS"
          value={flags.length}
          tone={flags.length ? 'amber' : 'slate'}
          subtext="Logged this month"
        />
        <Kpi
          label="PAYOUT THIS MONTH"
          value={money(
            [...payouts.values()].reduce((sum, p) => sum + p.net, 0),
          )}
          tone="blue"
          subtext="Estimated net payable"
        />
      </KpiGrid>

      <div className="mt-4">
        <DataTable<(typeof staff)[number]>
          data={staff}
          keyExtractor={(member) => member.id}
          itemLabel="wash boys"
          emptyMessage="No wash boys added yet."
          columns={[
            {
              id: 'name',
              header: 'NAME',
              className: 'font-bold text-navy-950',
              render: (member) => member.name,
            },
            {
              id: 'area',
              header: 'AREA',
              render: (member) => areaById.get(member.areaId)?.name ?? '—',
            },
            {
              id: 'signedIn',
              header: 'SIGNED IN',
              render: (member) => {
                const record = attendanceByStaff.get(member.id);
                const absent = !record?.loginAt && record?.status !== 'PRESENT';
                return (
                  <span className={absent ? 'font-bold text-rose-600' : 'text-slate-700'}>
                    {record?.loginAt ? formatClock(record.loginAt) : 'Absent'}
                  </span>
                );
              },
            },
            {
              id: 'carsToday',
              header: 'CARS TODAY',
              render: (member) => {
                const own = todayVisits.filter((v) => v.staffId === member.id);
                return `${own.filter((v) => v.status === 'DONE').length}/${own.length}`;
              },
            },
            {
              id: 'washes',
              header: 'WASHES',
              render: (member) => performanceById.get(member.id)?.washes ?? 0,
            },
            {
              id: 'onTime',
              header: 'ON-TIME',
              render: (member) => {
                const stats = performanceById.get(member.id);
                return (
                  <span
                    className={
                      stats && stats.onTimeRate < 0.7
                        ? 'font-bold text-rose-600'
                        : 'text-slate-700'
                    }
                  >
                    {percent(stats?.onTimeRate ?? 0)}
                  </span>
                );
              },
            },
            {
              id: 'rating',
              header: 'RATING',
              render: (member) => {
                const stats = performanceById.get(member.id);
                return stats?.averageRating
                  ? `${stats.averageRating.toFixed(1)} ★`
                  : '—';
              },
            },
            {
              id: 'earned',
              header: 'EARNED',
              className: 'font-bold text-slate-900',
              render: (member) => money(payouts.get(member.id)?.net ?? 0),
            },
            {
              id: 'action',
              header: 'ACTION',
              render: (member) => (
                <ActionButton
                  endpoint="/api/ops/staff"
                  variant={member.active ? 'secondary' : 'primary'}
                  payload={{
                    action: 'setActive',
                    staffId: member.id,
                    active: !member.active,
                  }}
                  confirm={
                    member.active
                      ? `Deactivate ${member.name}? Their upcoming cars become unassigned and their login stops working.`
                      : undefined
                  }
                >
                  {member.active ? 'Deactivate' : 'Reactivate'}
                </ActionButton>
              ),
            },
          ]}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3 items-start">
        {/* Card 1: Pocket money requests */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs flex flex-col justify-between min-h-[460px]">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-navy-600"
              >
                <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22" />
                <path d="m18 2 4 4-4 4" />
                <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
                <path d="M22 18h-5.9c-1.3 0-2.5-.7-3.3-1.8l-.5-.8" />
                <path d="m18 14 4 4-4 4" />
              </svg>
              <h3 className="font-bold text-ink text-sm">Pocket money requests</h3>
              <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-navy-100 text-[11px] font-black text-navy-800">
                {pending.length}
              </span>
            </div>

            {pending.length === 0 ? (
              <p className="py-12 text-center text-sm text-ink-faint font-medium">
                Nothing waiting for you.
              </p>
            ) : (
              <div className="divide-y divide-line-soft">
                {pending.map((request, idx) => {
                  const member = staffById.get(request.staffId);
                  const allowance = allowances.get(request.id);
                  const overCap = allowance ? request.amount > allowance.available : false;
                  const avatarColor = AVATAR_PALETTES[idx % AVATAR_PALETTES.length];

                  return (
                    <div key={request.id} className="py-3.5 first:pt-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black ${avatarColor}`}
                        >
                          {getInitials(member?.name ?? 'Staff')}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-ink truncate">
                              {member?.name} — {money(request.amount)}
                            </span>
                            {overCap ? (
                              <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-danger-600 bg-danger-50 border border-danger-100">
                                Over limit
                              </span>
                            ) : (
                              <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-success-600 bg-success-50 border border-success-100">
                                Within limit
                              </span>
                            )}
                          </div>

                          <div className="mt-0.5 text-xs text-ink-mute font-medium">
                            Limit: {money(allowance?.available ?? 0)} · {money(allowance?.inAccount ?? 0)} in account · asked {formatDateFull(request.requestedAt)}
                          </div>

                          {overCap ? (
                            <div className="mt-0.5 text-xs font-semibold text-danger-600">
                              Exceeds the {rules.pocketWeeklyCapPercent}% weekly cap by {money(request.amount - (allowance?.available ?? 0))}
                            </div>
                          ) : null}

                          <div className="mt-2.5 flex items-center gap-2">
                            <ActionButton
                              endpoint="/api/ops/pocket"
                              variant="success"
                              payload={{ requestId: request.id, decision: 'APPROVED' }}
                              className="rounded-lg bg-success-600 hover:bg-success-700 text-white px-3 py-1 text-xs font-bold shadow-2xs transition-colors"
                              confirm={overCap ? 'This is above the weekly cap. Approve it anyway?' : undefined}
                            >
                              {overCap ? 'Approve anyway' : 'Approve'}
                            </ActionButton>
                            <ActionButton
                              endpoint="/api/ops/pocket"
                              variant="danger"
                              payload={{ requestId: request.id, decision: 'REJECTED' }}
                              className="rounded-lg bg-danger-600 hover:bg-danger-700 text-white px-3 py-1 text-xs font-bold shadow-2xs transition-colors"
                            >
                              Reject
                            </ActionButton>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-line-soft">
            <Link
              href={`${base}/staff/requests`}
              className="inline-flex items-center gap-1 text-xs font-bold text-navy-600 hover:text-navy-800 transition-colors"
            >
              View all requests →
            </Link>
          </div>
        </div>

        {/* Card 2: Discipline flags this month */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs flex flex-col justify-between min-h-[460px]">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-navy-600"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <h3 className="font-bold text-ink text-sm">Discipline flags this month</h3>
              <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-navy-100 text-[11px] font-black text-navy-800">
                {flags.length}
              </span>
            </div>

            {flags.length === 0 ? (
              <p className="py-12 text-center text-sm text-ink-faint font-medium">
                Nobody is over their off allowance.
              </p>
            ) : (
              <div className="space-y-3">
                {flags.map((flag) => {
                  const initials = getInitials(flag.member.name);
                  return (
                    <div key={flag.member.id} className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-50 text-xs font-black text-danger-700">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                        <div className="text-sm font-bold text-ink truncate">
                          {flag.member.name} — {flag.uninformed > 0 ? `absent without informing × ${flag.uninformed}` : `${flag.offs} offs taken`}
                        </div>
                        <div className="text-sm font-black text-danger-600 shrink-0">
                          {flag.uninformed > 0
                            ? `−${money(flag.uninformed * rules.uninformedLeavePenalty)}`
                            : flag.offs === rules.offsAllowedPerMonth + 1
                              ? 'Warning'
                              : `−${money((flag.offs - rules.offsAllowedPerMonth - 1) * rules.extraOffPenalty)}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-warning-200/80 bg-warning-50 p-3.5">
              <div className="text-warning-600 shrink-0 mt-0.5">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p className="text-xs font-medium text-warning-900 leading-relaxed">
                Deductions are calculated automatically from attendance, but nothing is taken until the owner approves the month&rsquo;s payout.
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-line-soft">
            <Link
              href={`${base}/staff/flags`}
              className="inline-flex items-center gap-1 text-xs font-bold text-navy-600 hover:text-navy-800 transition-colors"
            >
              View all flags →
            </Link>
          </div>
        </div>

        {/* Card 3: Add a wash boy */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-navy-600"
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <h3 className="font-bold text-ink text-sm">Add a wash boy</h3>
          </div>

          <AddStaffForm
            areas={areas
              .filter(
                (a) =>
                  session.scope.areaIds === null ||
                  session.scope.areaIds.includes(a.id),
              )
              .map((a) => ({ id: a.id, name: a.name }))}
            staff={staff.map((s) => ({ id: s.id, name: s.name }))}
            referralBonus={rules.staffReferralBonus}
          />
        </div>
      </div>
    </>
  );
}
