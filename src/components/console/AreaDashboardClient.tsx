'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  IconAlert,
  IconCar,
  IconCheckCircle,
  IconChevronRight,
  IconClock,
  IconDownload,
  IconDroplet,
  IconRefresh,
  IconRupee,
  IconStar,
  IconUser,
  IconUsers,
  IconWallet,
} from '@/components/shell/icons';
import {
  StatCard,
  StatGrid,
} from '@/components/ui/primitives';
import { WidgetTable } from '@/components/ui/WidgetTable';
import { money, moneyShort } from '@/lib/util/format';
import type { AreaPerformance } from '@/lib/data/types';

export interface StaffTodayItem {
  id: string;
  name: string;
  signedIn: string | null;
  cars: number;
  done: number;
  status: 'Working' | 'Absent';
}

interface AreaDashboardClientProps {
  totals: {
    customers: number;
    activeCars: number;
    washesDone: number;
    washesMissed: number;
    collected: number;
  };
  activeCars: number;
  carsToday: number;
  completedToday: number;
  inProgressToday: number;
  pendingToday: number;
  remainingToday: number;
  assignedToday: number;
  notDoneToday: number;
  unassignedToday: number;
  staffWorkingCount: number;
  staffAbsentCount: number;
  staffAttendanceRate: number;
  outstanding: number;
  alertsCount: number;
  oldestAlertDays: number;
  complaintsCount: number;
  escalatedComplaintsCount: number;
  staffToday: StaffTodayItem[];
  performance: AreaPerformance[];
  cycleLabel: string;
  areasCount: number;
  base: string;
  pendingLeavesCount?: number;
  staffOnLeaveNames?: string[];
}

export function AreaDashboardClient({
  totals,
  activeCars,
  carsToday,
  completedToday,
  inProgressToday,
  pendingToday,
  remainingToday,
  assignedToday: _assignedToday,
  notDoneToday: _notDoneToday,
  unassignedToday,
  staffWorkingCount,
  staffAbsentCount,
  staffAttendanceRate,
  outstanding,
  alertsCount,
  oldestAlertDays,
  complaintsCount,
  escalatedComplaintsCount,
  staffToday,
  performance,
  cycleLabel,
  areasCount,
  base,
  pendingLeavesCount = 0,
  staffOnLeaveNames = [],
}: AreaDashboardClientProps) {
  const [staffPage, setStaffPage] = useState(1);
  const staffPerPage = 8;

  // Initials generator
  function getInitials(name: string) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  const avatarColors = [
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-purple-100 text-purple-700',
    'bg-rose-100 text-rose-700',
    'bg-amber-100 text-amber-700',
  ];

  // Export CSV
  function handleExport() {
    const headers = [
      'Area',
      'Customers',
      'Active Cars',
      'Collected',
      'Outstanding',
      'Missed Washes',
      'Rating',
    ];

    const rows = performance.map((p) => [
      `"${p.area.name}"`,
      p.customers,
      p.activeCars,
      p.collected,
      p.outstanding,
      p.washesMissed,
      p.averageRating ? p.averageRating.toFixed(1) : 'N/A',
    ].join(','));

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `dashboard_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Calculate dynamic customer satisfaction & average rating
  const ratedAreas = performance.filter((p) => (p.averageRating ?? 0) > 0);
  const avgRatingNumber =
    ratedAreas.length > 0
      ? ratedAreas.reduce((s, p) => s + (p.averageRating ?? 0), 0) / ratedAreas.length
      : 0;

  const avgRatingDisplay = avgRatingNumber > 0 ? `${avgRatingNumber.toFixed(1)} ★` : '—';
  const satisfactionPct = avgRatingNumber > 0 ? Math.round((avgRatingNumber / 5) * 100) : 0;

  const completionPct = carsToday > 0 ? Math.round((completedToday / carsToday) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-950">
            Operations Dashboard
          </h1>
          <p className="mt-0.5 text-xs font-medium text-ink-mute">
            {cycleLabel} · {areasCount} {areasCount === 1 ? 'area' : 'areas'} under management
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`${base}/staff/leaves`}
            className="flex items-center gap-2 rounded-xl border border-line-strong bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-950 shadow-sm transition-colors hover:border-navy-400 hover:bg-surface-muted"
          >
            <span>📅</span>
            <span>Leaves & Absence</span>
            {pendingLeavesCount > 0 && (
              <span className="flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {pendingLeavesCount}
              </span>
            )}
          </Link>
          {/* Export Report Button */}
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 rounded-xl border border-line-strong bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-950 shadow-sm transition-colors hover:border-navy-400 hover:bg-surface-muted"
          >
            <IconDownload width={15} height={15} className="text-slate-500" />
            Export report
          </button>
        </div>
      </div>

      {/* Prominent Action Banners for Unassigned Services and Leaves */}
      {unassignedToday > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-rose-400 bg-rose-50 p-4 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-200 text-lg font-bold text-rose-800">
              ⚠️
            </div>
            <div>
              <h2 className="text-sm font-bold text-rose-950">
                Action Required: {unassignedToday} {unassignedToday === 1 ? 'service has' : 'services have'} NO staff assigned today!
              </h2>
              <p className="text-xs text-rose-800 font-medium mt-0.5">
                Assign wash boys now to ensure cars are cleaned on schedule.
              </p>
            </div>
          </div>
          <Link
            href={`${base}/schedule`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-700"
          >
            <span>Assign Staff to Services →</span>
          </Link>
        </div>
      )}

      {staffOnLeaveNames.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-sm font-bold text-amber-900">
              🏖️
            </span>
            <div>
              <h3 className="text-xs font-bold text-amber-950">
                {staffOnLeaveNames.length} staff member{staffOnLeaveNames.length === 1 ? ' is' : 's are'} on leave today: {staffOnLeaveNames.join(', ')}
              </h3>
              <p className="text-[11px] text-amber-800">
                Assigned cars have been freed for coverage. Check schedule to verify all rounds.
              </p>
            </div>
          </div>
          <Link
            href={`${base}/staff/leaves`}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors"
          >
            View Leaves
          </Link>
        </div>
      )}

      {pendingLeavesCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-300 bg-blue-50/90 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-200 text-sm font-bold text-blue-900">
              📋
            </span>
            <div>
              <h3 className="text-xs font-bold text-blue-950">
                {pendingLeavesCount} staff leave request{pendingLeavesCount === 1 ? '' : 's'} awaiting your decision
              </h3>
              <p className="text-[11px] text-blue-800">
                Staff boys submitted leave applications for advance or on-the-spot approval.
              </p>
            </div>
          </div>
          <Link
            href={`${base}/staff/leaves`}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors"
          >
            Review & Approve →
          </Link>
        </div>
      )}


      {/* 8 KPI Operational & Financial Summary Metric Cards (4 columns x 2 rows) */}
      <StatGrid columns={4}>
        <StatCard
          label="TODAY'S WASHES"
          value={`${completedToday} / ${carsToday}`}
          icon={<IconCheckCircle width={20} height={20} strokeWidth={2} />}
          tone="emerald"
          subtext={`${completionPct}% completed today`}
          subtextTone={completionPct >= 80 ? 'success' : 'info'}
        />
        <StatCard
          label="REMAINING WASHES"
          value={remainingToday}
          icon={<IconClock width={20} height={20} strokeWidth={2} />}
          tone="blue"
          subtext={`${inProgressToday} in progress · ${pendingToday} pending`}
          subtextTone="info"
        />
        <StatCard
          label="UNASSIGNED QUEUE"
          value={unassignedToday}
          icon={<IconUser width={20} height={20} strokeWidth={2} />}
          tone={unassignedToday > 0 ? 'rose' : 'emerald'}
          subtext={unassignedToday > 0 ? 'Requires immediate assignment' : 'All visits assigned to staff'}
          subtextTone={unassignedToday > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label="STAFF ON DUTY"
          value={`${staffWorkingCount} / ${staffToday.length}`}
          icon={<IconUsers width={20} height={20} strokeWidth={2} />}
          tone={staffAbsentCount > 0 ? 'amber' : 'emerald'}
          subtext={`${staffAttendanceRate}% attendance · ${staffAbsentCount} absent`}
          subtextTone={staffAbsentCount > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="ACTIVE CARS"
          value={activeCars}
          icon={<IconCar width={20} height={20} strokeWidth={2} />}
          tone="purple"
          subtext={`${totals.customers} subscribed accounts`}
          subtextTone="muted"
        />
        <StatCard
          label="CUSTOMER RATING"
          value={avgRatingDisplay}
          icon={<IconStar width={20} height={20} strokeWidth={2} />}
          tone={avgRatingNumber >= 4 ? 'emerald' : avgRatingNumber > 0 ? 'amber' : 'slate'}
          subtext={
            avgRatingNumber > 0
              ? `${satisfactionPct}% satisfaction rating`
              : 'No customer ratings recorded yet'
          }
          subtextTone={avgRatingNumber >= 4 ? 'success' : avgRatingNumber > 0 ? 'warning' : 'muted'}
        />
        <StatCard
          label="OUTSTANDING DUES"
          value={moneyShort(outstanding)}
          icon={<IconRupee width={20} height={20} strokeWidth={2.2} />}
          tone="amber"
          subtext={`${alertsCount} overdue customer accounts`}
          subtextTone="warning"
        />
        <StatCard
          label="OPEN COMPLAINTS"
          value={complaintsCount}
          icon={<IconAlert width={20} height={20} strokeWidth={2} />}
          tone={complaintsCount > 0 ? 'rose' : 'emerald'}
          subtext={escalatedComplaintsCount > 0 ? `${escalatedComplaintsCount} escalated to owner` : 'All resolved/normal'}
          subtextTone={escalatedComplaintsCount > 0 ? 'danger' : 'muted'}
        />
      </StatGrid>

      {/* Middle Section: Operations Action Center & Staff Today */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left Column: Operations Action Center (~5 cols) */}
        <div className="flex flex-col justify-between rounded-2xl border border-line-soft bg-white p-5 shadow-sm lg:col-span-5">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-navy-950">
                Requires Action Today
              </h2>
              <Link
                href={`${base}/alerts`}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                View all alerts
              </Link>
            </div>

            <div className="space-y-3.5">
              {/* Alert 0: Unassigned Visits (if any) */}
              {unassignedToday > 0 ? (
                <Link href={`${base}/schedule`} className="block group">
                  <div className="flex items-center justify-between rounded-xl border border-rose-200 border-l-4 border-l-rose-500 bg-rose-50/40 p-4 shadow-xs transition-all hover:bg-rose-50/80 hover:shadow-sm">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                        <IconCar width={20} height={20} strokeWidth={2.2} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-rose-950 group-hover:text-rose-700 transition-colors">
                          {unassignedToday} unassigned washes today
                        </h3>
                        <p className="mt-0.5 text-xs text-rose-700 font-medium">
                          Click to assign wash boys now.
                        </p>
                      </div>
                    </div>
                    <IconChevronRight
                      width={18}
                      height={18}
                      className="text-rose-400 group-hover:text-rose-600 transition-colors"
                    />
                  </div>
                </Link>
              ) : null}

              {/* Alert 0.5: Absent Staff (if any) */}
              {staffAbsentCount > 0 ? (
                <Link href={`${base}/staff`} className="block group">
                  <div className="flex items-center justify-between rounded-xl border border-amber-200 border-l-4 border-l-amber-500 bg-amber-50/40 p-4 shadow-xs transition-all hover:bg-amber-50/80 hover:shadow-sm">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                        <IconUsers width={20} height={20} strokeWidth={2.2} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-amber-950 group-hover:text-amber-800 transition-colors">
                          {staffAbsentCount} staff absent today
                        </h3>
                        <p className="mt-0.5 text-xs text-amber-700 font-medium">
                          Check roster and reassign cars to available team.
                        </p>
                      </div>
                    </div>
                    <IconChevronRight
                      width={18}
                      height={18}
                      className="text-amber-400 group-hover:text-amber-600 transition-colors"
                    />
                  </div>
                </Link>
              ) : null}

              {/* Alert 1: Chase customers */}
              <Link href={`${base}/alerts`} className="block group">
                <div className="flex items-center justify-between rounded-xl border border-line-soft border-l-4 border-l-amber-500 bg-white p-4 shadow-xs transition-all hover:bg-slate-50/70 hover:shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      <IconRupee width={20} height={20} strokeWidth={2.2} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-navy-950 group-hover:text-blue-600 transition-colors">
                        {alertsCount} customers to chase — {money(outstanding)}
                      </h3>
                      <p className="mt-0.5 text-xs text-ink-mute">
                        Oldest is {oldestAlertDays} days overdue.
                      </p>
                    </div>
                  </div>
                  <IconChevronRight
                    width={18}
                    height={18}
                    className="text-slate-400 group-hover:text-blue-600 transition-colors"
                  />
                </div>
              </Link>

              {/* Alert 2: Open complaints */}
              <Link href={`${base}/complaints`} className="block group">
                <div className="flex items-center justify-between rounded-xl border border-line-soft border-l-4 border-l-blue-500 bg-white p-4 shadow-xs transition-all hover:bg-slate-50/70 hover:shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <IconAlert width={20} height={20} strokeWidth={2.2} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-navy-950 group-hover:text-blue-600 transition-colors">
                        {complaintsCount} open complaints
                      </h3>
                      <p className="mt-0.5 text-xs text-ink-mute">
                        {escalatedComplaintsCount} escalated to the owner.
                      </p>
                    </div>
                  </div>
                  <IconChevronRight
                    width={18}
                    height={18}
                    className="text-slate-400 group-hover:text-blue-600 transition-colors"
                  />
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Staff today (~7 cols) */}
        <WidgetTable<StaffTodayItem>
          className="lg:col-span-7"
          title="Staff today"
          action={
            <Link
              href={`${base}/staff`}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              View all staff
            </Link>
          }
          data={staffToday}
          keyExtractor={(staff) => staff.id}
          pageSize={staffPerPage}
          page={staffPage}
          onPageChange={setStaffPage}
          emptyMessage="No staff on duty today."
          columns={[
            {
              id: 'name',
              header: 'NAME',
              render: (staff, idx) => {
                const avatarColor = avatarColors[idx % avatarColors.length];
                return (
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${avatarColor}`}
                    >
                      {getInitials(staff.name)}
                    </div>
                    <span className="font-semibold text-navy-950">{staff.name}</span>
                  </div>
                );
              },
            },
            // {
            //   id: 'signedIn',
            //   header: 'SIGNED IN',
            //   render: (staff) => staff.signedIn || '—',
            // },
            {
              id: 'cars',
              header: 'CARS',
              align: 'center',
              className: 'font-semibold text-navy-950',
              render: (staff) => staff.cars,
            },
            {
              id: 'done',
              header: 'DONE',
              align: 'center',
              className: 'font-semibold text-navy-950',
              render: (staff) => staff.done,
            },
            {
              id: 'progress',
              header: 'PROGRESS',
              className: 'min-w-[90px]',
              render: (staff) => {
                const pct = staff.cars > 0 ? Math.min(100, Math.round((staff.done / staff.cars) * 100)) : 0;
                return (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-slate-300'
                          }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700">{pct}%</span>
                  </div>
                );
              },
            },
            {
              id: 'status',
              header: 'STATUS',
              align: 'center',
              render: (staff) => (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${staff.status === 'Working'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}
                >
                  {staff.status}
                </span>
              ),
            },
          ]}
        />
      </div>

      {/* Bottom Section: This Month & Year Overview */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left Column: This Month (~5 cols) */}
        <div className="flex flex-col justify-between rounded-2xl border border-line-soft bg-white p-5 shadow-sm lg:col-span-5">
          <div>
            <h2 className="mb-4 text-base font-semibold text-navy-950">
              This month — {cycleLabel}
            </h2>

            <div className="space-y-3 text-xs">
              {/* Washes needed */}
              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-slate-500">
                  <IconDroplet width={16} height={16} className="text-sky-500" />
                  Washes needed
                </span>
                <span className="font-semibold text-navy-950">
                  {totals.washesDone}
                </span>
              </div>

              {/* Washes missed */}
              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-slate-500">
                  <IconAlert width={16} height={16} className="text-rose-500" />
                  Washes missed
                </span>
                <span className="font-semibold text-rose-600">
                  {totals.washesMissed}
                </span>
              </div>

              {/* Collected */}
              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-slate-500">
                  <IconWallet width={16} height={16} className="text-emerald-500" />
                  Collected
                </span>
                <span className="font-semibold text-emerald-600">
                  {money(totals.collected)}
                </span>
              </div>

              {/* Outstanding */}
              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-slate-500">
                  <IconClock width={16} height={16} className="text-amber-500" />
                  Outstanding
                </span>
                <span className="font-semibold text-amber-600">
                  {money(outstanding)}
                </span>
              </div>

              {/* Average rating */}
              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-slate-500">
                  <IconStar width={16} height={16} className="text-amber-400" />
                  Average rating
                </span>
                <span className="flex items-center gap-1 font-semibold text-navy-950">
                  {avgRatingDisplay}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Year overview (~7 cols) */}
        <WidgetTable<AreaPerformance>
          className="lg:col-span-7"
          title="Year overview"
          data={performance}
          keyExtractor={(area) => area.area.id}
          pageSize={10}
          emptyMessage="No area performance data available."
          columns={[
            {
              id: 'name',
              header: 'AREA',
              className: 'font-semibold text-navy-950',
              render: (area) => area.area.name,
            },
            {
              id: 'customers',
              header: 'CUSTOMERS',
              align: 'center',
              className: 'font-semibold text-navy-950',
              render: (area) => area.customers,
            },
            {
              id: 'collected',
              header: 'COLLECTED',
              className: 'font-semibold text-emerald-600',
              render: (area) => money(area.collected),
            },
            {
              id: 'outstanding',
              header: 'OUTSTANDING',
              className: 'font-semibold text-amber-600',
              render: (area) => money(area.outstanding),
            },
            {
              id: 'missed',
              header: 'MISSED',
              align: 'center',
              className: 'font-semibold text-slate-700',
              render: (area) => area.washesMissed,
            },
            {
              id: 'rating',
              header: 'RATING',
              align: 'center',
              className: 'font-semibold text-navy-950',
              render: (area) => (
                <>
                  {area.averageRating ? area.averageRating.toFixed(1) : '—'}{' '}
                  <span className="text-amber-500">★</span>
                </>
              ),
            },
          ]}
        />
      </div>

      {/* Live Status Indicator Footer */}
      <div className="flex items-center justify-center gap-2 pt-2 text-xs font-medium text-ink-mute">
        <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
        <span>Data is updated in real-time</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-slate-400 hover:text-navy-900 transition-colors"
          title="Refresh dashboard"
        >
          <IconRefresh width={13} height={13} />
        </button>
      </div>
    </div>
  );
}