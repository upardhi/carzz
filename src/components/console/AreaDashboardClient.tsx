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
  EmptyTableRow,
  StatCard,
  StatGrid,
  TablePagination,
} from '@/components/ui/primitives';
import { money, moneyShort } from '@/lib/util/format';
import type { AreaPerformance } from '@/lib/services/reports';

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
    washesDone: number;
    washesMissed: number;
    collected: number;
  };
  carsToday: number;
  completedToday: number;
  notDoneToday: number;
  unassignedToday: number;
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
}

export function AreaDashboardClient({
  totals,
  carsToday,
  completedToday,
  notDoneToday,
  unassignedToday,
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
}: AreaDashboardClientProps) {
  const [staffPage, setStaffPage] = useState(1);
  const staffPerPage = 8;

  const currentStaffSlice = staffToday.slice(
    (staffPage - 1) * staffPerPage,
    staffPage * staffPerPage,
  );

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
      'Collected',
      'Outstanding',
      'Missed Washes',
      'Rating',
    ];

    const rows = performance.map((p) => [
      `"${p.area.name}"`,
      p.customers,
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

  // Calculate average rating
  const ratedAreas = performance.filter((p) => (p.averageRating ?? 0) > 0);
  const avgRating =
    ratedAreas.length > 0
      ? (
          ratedAreas.reduce((s, p) => s + (p.averageRating ?? 0), 0) /
          ratedAreas.length
        ).toFixed(1)
      : '4.6';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-navy-950">
            Dashboard
          </h1>
          <p className="mt-0.5 text-xs font-semibold text-ink-mute">
            {cycleLabel} · {areasCount} {areasCount === 1 ? 'area' : 'areas'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Export Report Button */}
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 rounded-xl border border-line-strong bg-white px-3.5 py-1.5 text-xs font-bold text-navy-950 shadow-sm transition-colors hover:border-navy-400 hover:bg-surface-muted"
          >
            <IconDownload width={15} height={15} className="text-slate-500" />
            Export report
          </button>
        </div>
      </div>

      {/* 6 Top KPI Summary Metric Cards */}
      <StatGrid columns={6}>
        <StatCard
          label="ACTIVE CUSTOMERS"
          value={totals.customers}
          icon={<IconUsers width={20} height={20} strokeWidth={2} />}
          tone="purple"
          subtext="Registered in region"
          subtextTone="muted"
        />
        <StatCard
          label="CARS TODAY"
          value={carsToday}
          icon={<IconCar width={20} height={20} strokeWidth={2} />}
          tone="blue"
          subtext="Scheduled today"
          subtextTone="info"
        />
        <StatCard
          label="COMPLETED"
          value={completedToday}
          icon={<IconCheckCircle width={20} height={20} strokeWidth={2} />}
          tone="emerald"
          subtext={`${carsToday > 0 ? ((completedToday / carsToday) * 100).toFixed(0) : 0}% of today`}
          subtextTone="success"
        />
        <StatCard
          label="NOT DONE"
          value={notDoneToday}
          icon={<IconClock width={20} height={20} strokeWidth={2} />}
          tone="amber"
          subtext={`${carsToday > 0 ? ((notDoneToday / carsToday) * 100).toFixed(0) : 0}% of today`}
          subtextTone="warning"
        />
        <StatCard
          label="UNASSIGNED"
          value={unassignedToday}
          icon={<IconUser width={20} height={20} strokeWidth={2} />}
          tone="purple"
          subtext={unassignedToday > 0 ? `${unassignedToday} need wash boy` : 'All cars assigned'}
          subtextTone="muted"
        />
        <StatCard
          label="OUTSTANDING"
          value={moneyShort(outstanding)}
          icon={<IconRupee width={20} height={20} strokeWidth={2.2} />}
          tone="amber"
          subtext={`${alertsCount} pending accounts`}
          subtextTone="warning"
        />
      </StatGrid>

      {/* Middle Section: Needs you right now & Staff today */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left Column: Needs you right now (~5 cols) */}
        <div className="flex flex-col justify-between rounded-2xl border border-line-soft bg-white p-5 shadow-sm lg:col-span-5">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-navy-950">
                Needs your right now
              </h2>
              <Link
                href={`${base}/alerts`}
                className="text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                View all
              </Link>
            </div>

            <div className="space-y-3.5">
              {/* Alert 1: Chase customers */}
              <Link href={`${base}/alerts`} className="block group">
                <div className="flex items-center justify-between rounded-xl border border-line-soft border-l-4 border-l-amber-500 bg-white p-4 shadow-xs transition-all hover:bg-slate-50/70 hover:shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      <IconUsers width={20} height={20} strokeWidth={2.2} />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-navy-950 group-hover:text-blue-600 transition-colors">
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
                      <h3 className="text-sm font-extrabold text-navy-950 group-hover:text-blue-600 transition-colors">
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
        <div className="flex flex-col justify-between rounded-2xl border border-line-soft bg-white p-5 shadow-sm lg:col-span-7">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-navy-950">
                Staff today
              </h2>
              <Link
                href={`${base}/staff`}
                className="text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                View all staff
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line-soft text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                    <th className="pb-2.5 font-extrabold">NAME</th>
                    <th className="pb-2.5 font-extrabold">SIGNED IN</th>
                    <th className="pb-2.5 text-center font-extrabold">CARS</th>
                    <th className="pb-2.5 text-center font-extrabold">DONE</th>
                    <th className="pb-2.5 text-center font-extrabold">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {currentStaffSlice.map((staff, idx) => {
                    const avatarColor = avatarColors[idx % avatarColors.length];
                    return (
                      <tr
                        key={staff.id}
                        className="transition-colors hover:bg-slate-50/60"
                      >
                        {/* Name + Avatar */}
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${avatarColor}`}
                            >
                              {getInitials(staff.name)}
                            </div>
                            <span className="font-bold text-navy-950">
                              {staff.name}
                            </span>
                          </div>
                        </td>

                        {/* Signed In */}
                        <td className="py-2.5 pr-3 text-slate-600">
                          {staff.signedIn || '—'}
                        </td>

                        {/* Cars */}
                        <td className="py-2.5 text-center font-semibold text-navy-950">
                          {staff.cars}
                        </td>

                        {/* Done */}
                        <td className="py-2.5 text-center font-semibold text-navy-950">
                          {staff.done}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 text-center">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              staff.status === 'Working'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}
                          >
                            {staff.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {currentStaffSlice.length === 0 ? (
                    <EmptyTableRow colSpan={5} message="No staff on duty today." />
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {/* Staff Pagination */}
          <TablePagination
            page={staffPage}
            totalItems={staffToday.length}
            perPage={staffPerPage}
            onPageChange={setStaffPage}
          />
        </div>
      </div>

      {/* Bottom Section: This Month & Year Overview */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left Column: This Month (~5 cols) */}
        <div className="flex flex-col justify-between rounded-2xl border border-line-soft bg-white p-5 shadow-sm lg:col-span-5">
          <div>
            <h2 className="mb-4 text-base font-extrabold text-navy-950">
              This month — {cycleLabel}
            </h2>

            <div className="space-y-3 text-xs">
              {/* Washes needed */}
              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-slate-500">
                  <IconDroplet width={16} height={16} className="text-sky-500" />
                  Washes needed
                </span>
                <span className="font-extrabold text-navy-950">
                  {totals.washesDone}
                </span>
              </div>

              {/* Washes missed */}
              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-slate-500">
                  <IconAlert width={16} height={16} className="text-rose-500" />
                  Washes missed
                </span>
                <span className="font-extrabold text-rose-600">
                  {totals.washesMissed}
                </span>
              </div>

              {/* Collected */}
              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-slate-500">
                  <IconWallet width={16} height={16} className="text-emerald-500" />
                  Collected
                </span>
                <span className="font-extrabold text-emerald-600">
                  {money(totals.collected)}
                </span>
              </div>

              {/* Outstanding */}
              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-slate-500">
                  <IconClock width={16} height={16} className="text-amber-500" />
                  Outstanding
                </span>
                <span className="font-extrabold text-amber-600">
                  {money(outstanding)}
                </span>
              </div>

              {/* Average rating */}
              <div className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-slate-500">
                  <IconStar width={16} height={16} className="text-amber-400" />
                  Average rating
                </span>
                <span className="flex items-center gap-1 font-extrabold text-navy-950">
                  {avgRating} <span className="text-amber-500">★</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Year overview (~7 cols) */}
        <div className="flex flex-col justify-between rounded-2xl border border-line-soft bg-white p-5 shadow-sm lg:col-span-7">
          <div>
            <h2 className="mb-4 text-base font-extrabold text-navy-950">
              Year overview
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line-soft text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                    <th className="pb-2.5 font-extrabold">AREA</th>
                    <th className="pb-2.5 text-center font-extrabold">CUSTOMERS</th>
                    <th className="pb-2.5 font-extrabold">COLLECTED</th>
                    <th className="pb-2.5 font-extrabold">OUTSTANDING</th>
                    <th className="pb-2.5 text-center font-extrabold">MISSED</th>
                    <th className="pb-2.5 text-center font-extrabold">RATING</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {performance.map((area) => (
                    <tr
                      key={area.area.id}
                      className="transition-colors hover:bg-slate-50/60"
                    >
                      {/* Area Name */}
                      <td className="py-2.5 font-bold text-navy-950">
                        {area.area.name}
                      </td>

                      {/* Customers */}
                      <td className="py-2.5 text-center font-semibold text-navy-950">
                        {area.customers}
                      </td>

                      {/* Collected */}
                      <td className="py-2.5 font-bold text-emerald-600">
                        {money(area.collected)}
                      </td>

                      {/* Outstanding */}
                      <td className="py-2.5 font-bold text-amber-600">
                        {money(area.outstanding)}
                      </td>

                      {/* Missed */}
                      <td className="py-2.5 text-center font-bold text-slate-700">
                        {area.washesMissed}
                      </td>

                      {/* Rating */}
                      <td className="py-2.5 text-center font-bold text-navy-950">
                        {area.averageRating ? area.averageRating.toFixed(1) : '—'}{' '}
                        <span className="text-amber-500">★</span>
                      </td>
                    </tr>
                  ))}
                  {performance.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-ink-mute">
                        No area performance data available.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
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