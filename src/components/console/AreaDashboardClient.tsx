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
  IconUsers,
  IconWallet,
} from '@/components/shell/icons';
import {
  Card,
  CardHeading,
  Row,
  StatCard,
  StatGrid,
} from '@/components/ui/primitives';
import { WidgetTable } from '@/components/ui/WidgetTable';
import { money, moneyShort, percent } from '@/lib/util/format';
import type { AreaPerformance } from '@/lib/data/types';
import type {
  BusinessSummary,
  CustomerStaffGrowthSummary,
  DailyOperationsSummary,
} from '@/lib/services/reports';

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
  unassignedToday: number;
  staffWorkingCount: number;
  staffAbsentCount: number;
  staffAttendanceRate: number;
  outstanding: number;
  alertsCount: number;
  oldestAlertDays: number;
  complaintsCount: number;
  escalatedComplaintsCount: number;
  /** Washes that missed today */
  notDoneToday?: number;
  lowRatedCount?: number;
  uninformedLeavesCount?: number;
  staffToday: StaffTodayItem[];
  performance: AreaPerformance[];
  cycleLabel: string;
  areasCount: number;
  base: string;
  pendingLeavesCount?: number;
  staffOnLeaveNames?: string[];
  dailyOps: DailyOperationsSummary;
  growth: CustomerStaffGrowthSummary;
  summary: BusinessSummary;
  unapprovedPayoutsCount?: number;
  unapprovedPayoutsTotal?: number;
}

export function AreaDashboardClient({
  totals: _totals,
  activeCars: _activeCars,
  carsToday: _carsToday,
  completedToday: _completedToday,
  inProgressToday: _inProgressToday,
  pendingToday: _pendingToday,
  remainingToday: _remainingToday,
  assignedToday: _assignedToday,
  notDoneToday = 0,
  lowRatedCount = 0,
  uninformedLeavesCount = 0,
  unassignedToday,
  staffWorkingCount: _staffWorkingCount,
  staffAbsentCount,
  staffAttendanceRate: _staffAttendanceRate,
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
  dailyOps,
  growth,
  summary,
  unapprovedPayoutsCount = 0,
  unapprovedPayoutsTotal = 0,
}: AreaDashboardClientProps) {
  const isManager = base === '/manager';
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

  // Calculate metrics
  const staffUtilization =
    summary.staff > 0 ? (summary.washesDone / summary.staff).toFixed(0) : '0';
  const collectionRate =
    summary.billed > 0 ? Math.round((summary.collected / summary.billed) * 100) : 100;
  const totalExpenses = summary.expenses + summary.payoutCost;

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
            <span>Leaves &amp; Absence</span>
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
            Review &amp; Approve →
          </Link>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2.1 KEY STATISTICS (6 KPIs - Scoped to Area / Region)                 */}
      {/* ===================================================================== */}
      <StatGrid columns={3}>
        <Link href={`${base}/customers`} className="block">
          <StatCard
            label="TOTAL ACTIVE CUSTOMERS"
            value={dailyOps.totalActiveCustomers}
            icon={<IconUsers width={20} height={20} strokeWidth={2} />}
            tone="emerald"
            subtext={`Active subscriptions out of ${dailyOps.totalCustomers} total`}
            subtextTone="success"
          />
        </Link>
        <Link href={`${base}/schedule`} className="block">
          <StatCard
            label="TODAY'S WASHES"
            value={dailyOps.washesToday}
            icon={<IconDroplet width={20} height={20} strokeWidth={2} />}
            tone="blue"
            subtext={`${dailyOps.todayRemainingWashes} remaining washes today`}
            subtextTone={dailyOps.todayRemainingWashes === 0 ? 'success' : 'warning'}
          />
        </Link>
        <Link href={`${base}/schedule`} className="block">
          <StatCard
            label="TODAY'S WASHED CUSTOMERS"
            value={dailyOps.todayWashedCustomers}
            icon={<IconCheckCircle width={20} height={20} strokeWidth={2} />}
            tone="emerald"
            subtext="Unique subscribers serviced today"
            subtextTone="success"
          />
        </Link>
        <Link href={`${base}/schedule?status=PENDING`} className="block">
          <StatCard
            label="REMAINING WASHES"
            value={dailyOps.todayRemainingWashes}
            icon={<IconClock width={20} height={20} strokeWidth={2} />}
            tone={dailyOps.todayRemainingWashes > 0 ? 'amber' : 'slate'}
            subtext="Scheduled washes remaining today"
            subtextTone={dailyOps.todayRemainingWashes > 0 ? 'warning' : 'muted'}
          />
        </Link>
        <Link href={isManager ? `${base}/team-alerts` : `${base}/reports`} className="block">
          <StatCard
            label="MONTHLY REVENUE"
            value={moneyShort(summary.collected)}
            icon={<IconWallet width={20} height={20} strokeWidth={2} />}
            tone="emerald"
            subtext={`${collectionRate}% collected of ${moneyShort(summary.billed)} billed`}
            subtextTone="success"
          />
        </Link>
        <Link href={`${base}/customers`} className="block">
          <StatCard
            label="TOTAL CUSTOMERS"
            value={dailyOps.totalCustomers}
            icon={<IconCar width={20} height={20} strokeWidth={2} />}
            tone="purple"
            subtext={`${growth.newCustomersThisMonth} new joined this month`}
            subtextTone="muted"
          />
        </Link>
      </StatGrid>

      {/* ===================================================================== */}
      {/* 2.2 DAILY WORK & 2.3 PAYMENT & 2.4 CUSTOMER DASHBOARDS               */}
      {/* ===================================================================== */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* 2.2 Dedicated Daily Work Dashboard */}
        <Card className="p-5 min-w-0 border-l-4 border-l-blue-500 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <CardHeading>Daily Work Operations</CardHeading>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                Today &amp; Tomorrow
              </span>
            </div>
            <div className="space-y-1.5">
              <Row label="Washed Today" value={`${dailyOps.washesToday} washes`} tone="success" />
              <Row label="Today's Washed Customers" value={`${dailyOps.todayWashedCustomers} customers`} />
              <Row
                label="Remaining Washes Today"
                value={`${dailyOps.todayRemainingWashes} pending`}
                tone={dailyOps.todayRemainingWashes > 0 ? 'gold' : undefined}
              />
              <Row
                label="Next Day Remaining Washes"
                value={`${dailyOps.nextDayRemainingWashes} scheduled`}
              />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end">
            <Link
              href={`${base}/schedule`}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
            >
              <span>Open Operations Schedule</span>
              <span>→</span>
            </Link>
          </div>
        </Card>

        {/* 2.3 Payment Dashboard */}
        <Card className="p-5 min-w-0 border-l-4 border-l-emerald-500 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <CardHeading>Payment Overview</CardHeading>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                {cycleLabel}
              </span>
            </div>
            <div className="space-y-1.5">
              <Row
                label="Monthly Revenue (Billed)"
                value={money(summary.billed)}
              />
              <Row
                label="Monthly Collected Revenue"
                value={money(summary.collected)}
                tone="success"
              />
              <Row
                label="Monthly Pending Amount"
                value={money(summary.outstanding)}
                tone={summary.outstanding > 0 ? 'danger' : undefined}
              />
              <Row
                label="Collection Efficiency"
                value={percent(summary.billed ? summary.collected / summary.billed : 0)}
              />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end">
            <Link
              href={base === '/admin' ? '/admin/accounting' : `${base}/customers`}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition-colors flex items-center gap-1"
            >
              <span>{base === '/admin' ? 'Open Financial Ledger' : 'View Customer Billing'}</span>
              <span>→</span>
            </Link>
          </div>
        </Card>

        {/* 2.4 Customer & Staff Dashboard */}
        <Card className="p-5 min-w-0 border-l-4 border-l-purple-500 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <CardHeading>Customer &amp; Staff Growth</CardHeading>
              <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700">
                This Month
              </span>
            </div>
            <div className="space-y-1.5">
              <Row label="Total Customers" value={growth.totalCustomers} />
              <Row label="New Customers This Month" value={`+${growth.newCustomersThisMonth}`} tone="success" />
              <Row
                label="Inactive Customers This Month"
                value={`${growth.inactiveCustomersThisMonth}`}
                tone={growth.inactiveCustomersThisMonth > 0 ? 'danger' : undefined}
              />
              <Row label="New Wash Boys Joined" value={`+${growth.newWashBoysJoinedThisMonth}`} tone="success" />
              <Row
                label="Inactive Wash Boys"
                value={`${growth.inactiveWashBoysThisMonth}`}
                tone={growth.inactiveWashBoysThisMonth > 0 ? 'danger' : undefined}
              />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
            <Link
              href={`${base}/customers`}
              className="text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1"
            >
              <span>Customers</span>
              <span>→</span>
            </Link>
            <Link
              href={`${base}/staff`}
              className="text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1"
            >
              <span>Staff</span>
              <span>→</span>
            </Link>
          </div>
        </Card>
      </div>

      {/* ===================================================================== */}
      {/* 2.1 MONTHLY FINANCIAL P&L BREAKDOWN & QUALITY METRICS                 */}
      {/* ===================================================================== */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Monthly Financial P&L Breakdown Card */}
        <Card className="p-5 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <CardHeading>Monthly Financial P&amp;L Breakdown</CardHeading>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                Profit &amp; Loss
              </span>
            </div>
            <div className="space-y-1.5">
              <Row label="Monthly Collected Revenue" value={money(summary.collected)} tone="success" />
              <Row label="Pending Revenue (Outstanding)" value={money(summary.outstanding)} tone={summary.outstanding > 0 ? 'gold' : undefined} />
              <Row label="Remaining Payments" value={money(summary.outstanding)} />
              <Row label="Total Revenue (Gross Billed)" value={money(summary.billed)} />
              <Row label="Total Expenses (Staff &amp; Goods)" value={money(totalExpenses)} tone="danger" />
              <div className="border-t border-slate-200/80 pt-2 mt-2">
                <Row
                  label="Net Profit"
                  value={money(summary.profit)}
                  tone={summary.profit > 0 ? 'success' : 'danger'}
                />
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end">
            <Link
              href={base === '/admin' ? '/admin/accounting' : `${base}/reports`}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1"
            >
              <span>View Financial Summary</span>
              <span>→</span>
            </Link>
          </div>
        </Card>

        {/* Operational Quality Card */}
        <Card className="p-5 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <CardHeading>Service Quality &amp; Efficiency</CardHeading>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                Metrics
              </span>
            </div>
            <div className="space-y-1.5">
              <Row label="Staff Productivity" value={`${staffUtilization} washes / staff`} />
              <Row label="Open Complaints" value={summary.openComplaints} tone={summary.openComplaints > 0 ? 'gold' : undefined} />
              <Row
                label="Customer CSAT Rating"
                value={
                  summary.averageRating > 0
                    ? `${summary.averageRating.toFixed(1)} ★ (${Math.round((summary.averageRating / 5) * 100)}%)`
                    : '—'
                }
              />
              <Row label="Direct Cost Per Wash" value={money(summary.costPerWash)} />
              <Row label="Revenue Per Car (ARPU)" value={money(summary.revenuePerCar)} />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
            <Link
              href={`${base}/complaints`}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1"
            >
              <span>Complaints</span>
              <span>→</span>
            </Link>
            <Link
              href={base === '/admin' ? '/admin/reports/staff' : `${base}/staff`}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1"
            >
              <span>Staff Performance</span>
              <span>→</span>
            </Link>
          </div>
        </Card>
      </div>

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

              {/* Alert 0.7: Unapproved Payouts (if any) */}
              {unapprovedPayoutsCount > 0 ? (
                <div className="flex items-center justify-between rounded-xl border border-rose-200 border-l-4 border-l-rose-500 bg-rose-50/40 p-4 shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                      <IconRupee width={20} height={20} strokeWidth={2.2} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-rose-950">
                        {unapprovedPayoutsCount} staff payout{unapprovedPayoutsCount === 1 ? '' : 's'} pending approval
                      </h3>
                      <p className="mt-0.5 text-xs text-rose-700 font-medium">
                        {money(unapprovedPayoutsTotal)} total awaiting review by admin.
                      </p>
                    </div>
                  </div>
                </div>
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

              {isManager ? (
                <>
                  {notDoneToday > 0 ? (
                    <Link href={`${base}/schedule?status=MISSED`} className="block group">
                      <div className="flex items-center justify-between rounded-xl border border-line-soft border-l-4 border-l-rose-500 bg-white p-4 shadow-xs transition-all hover:bg-slate-50/70 hover:shadow-sm">
                        <div className="flex items-center gap-3.5">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                            <IconAlert width={20} height={20} strokeWidth={2.2} />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-navy-950 group-hover:text-rose-600 transition-colors">
                              {notDoneToday} wash{notDoneToday === 1 ? '' : 'es'} not done today
                            </h3>
                            <p className="mt-0.5 text-xs text-ink-mute">
                              See which cars and which wash boy.
                            </p>
                          </div>
                        </div>
                        <IconChevronRight
                          width={18}
                          height={18}
                          className="text-slate-400 group-hover:text-rose-600 transition-colors"
                        />
                      </div>
                    </Link>
                  ) : null}

                  {lowRatedCount > 0 ? (
                    <Link href={`${base}/team-alerts`} className="block group">
                      <div className="flex items-center justify-between rounded-xl border border-line-soft border-l-4 border-l-amber-500 bg-white p-4 shadow-xs transition-all hover:bg-slate-50/70 hover:shadow-sm">
                        <div className="flex items-center gap-3.5">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                            <IconStar width={20} height={20} strokeWidth={2.2} />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-navy-950 group-hover:text-amber-600 transition-colors">
                              {lowRatedCount} wash{lowRatedCount === 1 ? '' : 'es'} rated below 3★ this cycle
                            </h3>
                            <p className="mt-0.5 text-xs text-ink-mute">
                              Talk to the wash boy behind these.
                            </p>
                          </div>
                        </div>
                        <IconChevronRight
                          width={18}
                          height={18}
                          className="text-slate-400 group-hover:text-amber-600 transition-colors"
                        />
                      </div>
                    </Link>
                  ) : null}

                  {uninformedLeavesCount > 0 ? (
                    <Link href={`${base}/staff/leaves`} className="block group">
                      <div className="flex items-center justify-between rounded-xl border border-line-soft border-l-4 border-l-purple-500 bg-white p-4 shadow-xs transition-all hover:bg-slate-50/70 hover:shadow-sm">
                        <div className="flex items-center gap-3.5">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                            <IconUsers width={20} height={20} strokeWidth={2.2} />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-navy-950 group-hover:text-purple-600 transition-colors">
                              {uninformedLeavesCount} unwanted / uninformed leave{uninformedLeavesCount === 1 ? '' : 's'}
                            </h3>
                            <p className="mt-0.5 text-xs text-ink-mute">
                              Staff who took leave without informing anyone first.
                            </p>
                          </div>
                        </div>
                        <IconChevronRight
                          width={18}
                          height={18}
                          className="text-slate-400 group-hover:text-purple-600 transition-colors"
                        />
                      </div>
                    </Link>
                  ) : null}

                  {notDoneToday === 0 && lowRatedCount === 0 && uninformedLeavesCount === 0 ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs font-semibold text-emerald-800">
                      Every wash is on track — no quality or attendance issues right now.
                    </div>
                  ) : null}
                </>
              ) : (
                /* Alert 2: Open complaints (area admin and up) */
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
              )}
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
          rowHref={(staff) => `${base}/schedule?staff=${staff.id}`}
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

      {/* Bottom Section: Area Profitability / Performance Breakdown Table */}
      <div className="grid gap-5 lg:grid-cols-12">
        <WidgetTable<AreaPerformance>
          className="lg:col-span-12"
          title="Area Performance &amp; Profitability"
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
              render: (area) => `${area.customers} (${area.activeCars} cars)`,
            },
            {
              id: 'collected',
              header: 'COLLECTED',
              className: 'font-semibold text-emerald-600',
              render: (area) => money(area.collected),
            },
            {
              id: 'cost',
              header: 'COST',
              className: 'font-semibold text-slate-600',
              render: (area) => money(area.goodsCost + area.payoutCost),
            },
            {
              id: 'profit',
              header: 'PROFIT',
              className: 'font-bold text-slate-900',
              render: (area) => (
                <span
                  className={
                    area.profit > 0
                      ? 'font-semibold text-emerald-600'
                      : 'font-semibold text-rose-600'
                  }
                >
                  {money(area.profit)}
                </span>
              ),
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