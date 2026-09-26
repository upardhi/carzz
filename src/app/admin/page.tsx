import { Suspense } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  IconAlert,
  IconCar,
  IconCheckCircle,
  IconChevronRight,
  IconClock,
  IconDroplet,
  IconRupee,
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
import {
  CardRowSkeleton,
  CardSkeleton,
  KpiGridSkeleton,
  TableSkeleton,
} from '@/components/ui/Skeleton';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { computePayoutRun } from '@/lib/services/payroll';
import {
  areaPerformance,
  businessSummary,
  leadSourceReport,
  dailyOperationsReport,
  customerStaffGrowthReport,
} from '@/lib/services/reports';
import {
  currentCycle,
  cycleLabel,
  money,
  moneyShort,
  percent,
} from '@/lib/util/format';

export const metadata = { title: 'Business overview' };

/* -------------------------------------------------------------------------- */
/* Async content component — everything that touches the DB                   */
/* -------------------------------------------------------------------------- */

async function AdminDashboardContent() {
  await requirePermission('report:business');
  const store = await getStore();
  const cycle = currentCycle();

  const payouts = await computePayoutRun(store, cycle, null);
  const areas = await areaPerformance(store, cycle, null, payouts);

  // Parallel data fetching for all enhanced dashboards
  const [summary, sources, purchases, escalatedComplaints, dailyOps, growth] = await Promise.all([
    businessSummary(store, cycle, null, areas),
    leadSourceReport(store, null),
    store.purchaseRequests.count({ status: 'PENDING' }),
    store.complaints.count({ status: 'ESCALATED' }),
    dailyOperationsReport(store, null),
    customerStaffGrowthReport(store, cycle, null),
  ]);

  const unapproved = payouts.filter((p) => p.status === 'DRAFT' && p.net > 0);
  const worstSource = [...sources]
    .filter((s) => s.cost > 0)
    .sort((a, b) => b.costPerActiveCar - a.costPerActiveCar)[0];

  const staffUtilization =
    summary.staff > 0 ? (summary.washesDone / summary.staff).toFixed(0) : '0';
  const collectionRate =
    summary.billed > 0 ? Math.round((summary.collected / summary.billed) * 100) : 100;
  const totalExpenses = summary.expenses + summary.payoutCost;

  return (
    <>
      {/* ===================================================================== */}
      {/* 2.1 KEY STATISTICS (6 KPIs)                                           */}
      {/* ===================================================================== */}
      <StatGrid columns={3}>
        <Link href="/admin/customers" className="block">
          <StatCard
            label="TOTAL ACTIVE CUSTOMERS"
            value={dailyOps.totalActiveCustomers}
            icon={<IconUsers width={20} height={20} strokeWidth={2} />}
            tone="emerald"
            subtext={`Active subscriptions out of ${dailyOps.totalCustomers} total`}
            subtextTone="success"
          />
        </Link>
        <Link href="/admin/schedule" className="block">
          <StatCard
            label="TODAY'S WASHES"
            value={dailyOps.washesToday}
            icon={<IconDroplet width={20} height={20} strokeWidth={2} />}
            tone="blue"
            subtext={`${dailyOps.todayRemainingWashes} remaining washes today`}
            subtextTone={dailyOps.todayRemainingWashes === 0 ? 'success' : 'warning'}
          />
        </Link>
        <Link href="/admin/schedule" className="block">
          <StatCard
            label="TODAY'S WASHED CUSTOMERS"
            value={dailyOps.todayWashedCustomers}
            icon={<IconCheckCircle width={20} height={20} strokeWidth={2} />}
            tone="emerald"
            subtext="Unique subscribers serviced today"
            subtextTone="success"
          />
        </Link>
        <Link href="/admin/schedule" className="block">
          <StatCard
            label="REMAINING WASHES"
            value={dailyOps.todayRemainingWashes}
            icon={<IconClock width={20} height={20} strokeWidth={2} />}
            tone={dailyOps.todayRemainingWashes > 0 ? 'amber' : 'slate'}
            subtext="Scheduled washes remaining today"
            subtextTone={dailyOps.todayRemainingWashes > 0 ? 'warning' : 'muted'}
          />
        </Link>
        <Link href="/admin/accounting" className="block">
          <StatCard
            label="MONTHLY REVENUE"
            value={moneyShort(summary.collected)}
            icon={<IconWallet width={20} height={20} strokeWidth={2} />}
            tone="emerald"
            subtext={`${collectionRate}% collected of ${moneyShort(summary.billed)} billed`}
            subtextTone="success"
          />
        </Link>
        <Link href="/admin/customers" className="block">
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
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
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
              href="/admin/schedule"
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
                {cycleLabel(cycle)}
              </span>
            </div>
            <div className="space-y-1.5">
              <Row label="Monthly Revenue (Billed)" value={money(summary.billed)} />
              <Row label="Monthly Collected Revenue" value={money(summary.collected)} tone="success" />
              <Row
                label="Monthly Pending Amount"
                value={money(summary.outstanding)}
                tone={summary.outstanding > 0 ? 'danger' : undefined}
              />
              <Row label="Collection Efficiency" value={percent(summary.billed ? summary.collected / summary.billed : 0)} />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end">
            <Link
              href="/admin/accounting"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition-colors flex items-center gap-1"
            >
              <span>Open Financial Ledger</span>
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
              href="/admin/customers"
              className="text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1"
            >
              <span>Customers</span>
              <span>→</span>
            </Link>
            <Link
              href="/admin/staff"
              className="text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1"
            >
              <span>Staff</span>
              <span>→</span>
            </Link>
          </div>
        </Card>
      </div>

      {/* ===================================================================== */}
      {/* 2.1 MONTHLY FINANCIAL P&L BREAKDOWN & AREA PERFORMANCE               */}
      {/* ===================================================================== */}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* Left Column: Area Performance Table */}
        <div className="flex flex-col justify-between min-w-0">
          <WidgetTable<(typeof areas)[number]>
            title="Area Profitability"
            data={areas}
            keyExtractor={(area) => area.area.id}
            emptyMessage="No performance data recorded."
            columns={[
              {
                id: 'area',
                header: 'AREA',
                className: 'font-semibold text-navy-950',
                render: (area) => area.area.name,
              },
              {
                id: 'customers',
                header: 'CUSTOMERS',
                align: 'center',
                className: 'font-semibold text-slate-700',
                render: (area) => `${area.customers} (${area.activeCars} cars)`,
              },
              {
                id: 'collected',
                header: 'COLLECTED',
                render: (area) => moneyShort(area.collected),
              },
              {
                id: 'cost',
                header: 'COST',
                render: (area) => moneyShort(area.goodsCost + area.payoutCost),
              },
              {
                id: 'profit',
                header: 'PROFIT',
                align: 'right',
                className: 'font-bold text-slate-900',
                render: (area) => (
                  <span
                    className={
                      area.profit > 0
                        ? 'font-semibold text-emerald-600'
                        : 'font-semibold text-rose-600'
                    }
                  >
                    {moneyShort(area.profit)}
                  </span>
                ),
              },
            ]}
          />
        </div>

        {/* Right Column: Owner Action Center */}
        <Card className="p-5 min-w-0">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
            <CardHeading>Owner Action Required</CardHeading>
            <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
              Needs your decision
            </span>
          </div>

          <div className="space-y-3">
            {!(unapproved.length > 0 || purchases > 0 || escalatedComplaints > 0 || summary.outstanding > 0 || (worstSource && worstSource.costPerActiveCar > 1000)) ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-8 text-center bg-slate-50/50">
                <p className="text-sm font-semibold text-slate-700">You&apos;re all caught up!</p>
                <p className="text-xs text-slate-500 mt-1">No urgent actions require your attention.</p>
              </div>
            ) : (
              <>
                {unapproved.length > 0 ? (
                  <Link href="/admin/payout" className="block group">
                    <div className="flex items-center justify-between rounded-xl border border-line-soft border-l-4 border-l-rose-500 bg-white p-3.5 shadow-xs transition-all hover:bg-slate-50/70 hover:shadow-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                          <IconRupee width={18} height={18} strokeWidth={2.2} />
                        </div>
                        <div className="min-w-0 flex-1 pr-2">
                          <b className="block truncate text-sm font-semibold text-navy-950 group-hover:text-blue-600 transition-colors">
                            Staff payout pending approval
                          </b>
                          <p className="truncate mt-0.5 text-xs text-ink-mute">
                            {unapproved.length} staff members · {money(unapproved.reduce((s, p) => s + p.net, 0))} total · Click to approve.
                          </p>
                        </div>
                      </div>
                      <IconChevronRight width={16} height={16} className="shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </Link>
                ) : null}

                {purchases > 0 ? (
                  <Link href="/admin/inventory" className="block group">
                    <div className="flex items-center justify-between rounded-xl border border-line-soft border-l-4 border-l-amber-500 bg-white p-3.5 shadow-xs transition-all hover:bg-slate-50/70 hover:shadow-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                          <IconClock width={18} height={18} strokeWidth={2.2} />
                        </div>
                        <div className="min-w-0 flex-1 pr-2">
                          <b className="block truncate text-sm font-semibold text-navy-950 group-hover:text-blue-600 transition-colors">
                            {purchases} inventory purchase {purchases === 1 ? 'request' : 'requests'} waiting
                          </b>
                          <p className="truncate mt-0.5 text-xs text-ink-mute">
                            Stock replenishment awaiting owner sign-off.
                          </p>
                        </div>
                      </div>
                      <IconChevronRight width={16} height={16} className="shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </Link>
                ) : null}

                {escalatedComplaints > 0 ? (
                  <Link href="/admin/complaints" className="block group">
                    <div className="flex items-center justify-between rounded-xl border border-line-soft border-l-4 border-l-rose-500 bg-white p-3.5 shadow-xs transition-all hover:bg-slate-50/70 hover:shadow-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                          <IconAlert width={18} height={18} strokeWidth={2.2} />
                        </div>
                        <div className="min-w-0 flex-1 pr-2">
                          <b className="block truncate text-sm font-semibold text-rose-950 group-hover:text-rose-700 transition-colors">
                            {escalatedComplaints} escalated customer {escalatedComplaints === 1 ? 'complaint' : 'complaints'}
                          </b>
                          <p className="truncate mt-0.5 text-xs text-ink-mute">
                            Urgent issue flagged to the business owner.
                          </p>
                        </div>
                      </div>
                      <IconChevronRight width={16} height={16} className="shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </Link>
                ) : null}

                {summary.outstanding > 0 ? (
                  <Link href="/admin/reports" className="block group">
                    <div className="flex items-center justify-between rounded-xl border border-line-soft border-l-4 border-l-amber-500 bg-white p-3.5 shadow-xs transition-all hover:bg-slate-50/70 hover:shadow-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                          <IconClock width={18} height={18} strokeWidth={2.2} />
                        </div>
                        <div className="min-w-0 flex-1 pr-2">
                          <b className="block truncate text-sm font-semibold text-navy-950 group-hover:text-blue-600 transition-colors">
                            {money(summary.outstanding)} outstanding receivables
                          </b>
                          <p className="truncate mt-0.5 text-xs text-ink-mute">
                            Collecting this would add {money(summary.outstanding)} straight to profit.
                          </p>
                        </div>
                      </div>
                      <IconChevronRight width={16} height={16} className="shrink-0 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </Link>
                ) : null}
              </>
            )}
          </div>
        </Card>

        {/* 2.1 Monthly Financial P&L Breakdown Card */}
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
              href="/admin/accounting"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1"
            >
              <span>View Financial Reports</span>
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
              href="/admin/complaints"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1"
            >
              <span>Complaints</span>
              <span>→</span>
            </Link>
            <Link
              href="/admin/reports/staff"
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1"
            >
              <span>Staff Reports</span>
              <span>→</span>
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeleton for the Suspense fallback                                          */
/* -------------------------------------------------------------------------- */

function AdminDashboardSkeleton() {
  return (
    <>
      <KpiGridSkeleton count={8} />
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <CardSkeleton>
          <TableSkeleton rows={4} cols={6} />
        </CardSkeleton>
        <CardSkeleton>
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg bg-surface-raised"
              />
            ))}
          </div>
        </CardSkeleton>
        <CardRowSkeleton rows={7} />
        <CardRowSkeleton rows={7} />
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Page export — synchronous shell + streamed content                         */
/* -------------------------------------------------------------------------- */

export default function AdminOverview() {
  const cycle = currentCycle(); // pure computation — no await needed

  return (
    <>
      {/* PageHeader renders immediately — no DB dependency */}
      <PageHeader
        title="Business overview"
        description={`${cycleLabel(cycle)} · every area`}
      />

      {/*
       * AdminDashboardContent streams in while the skeleton is visible.
       * The loading.tsx at this segment level shows the full skeleton
       * (header + cards) during client-side navigation; this inner Suspense
       * handles the streaming on a hard-refresh or first load so the header
       * is visible while data loads.
       */}
      <Suspense fallback={<AdminDashboardSkeleton />}>
        <AdminDashboardContent />
      </Suspense>
    </>
  );
}
