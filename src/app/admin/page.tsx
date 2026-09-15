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
} from '@/lib/services/reports';
import {
  currentCycle,
  cycleLabel,
  money,
  moneyShort,
  percent,
} from '@/lib/util/format';
import { LEAD_SOURCE_LABEL } from '@/lib/util/labels';

export const metadata = { title: 'Business overview' };

/* -------------------------------------------------------------------------- */
/* Async content component — everything that touches the DB                   */
/* -------------------------------------------------------------------------- */

async function AdminDashboardContent() {
  // requirePermission is memoised by React cache() so this is free — the
  // layout already resolved the session for this request.
  await requirePermission('report:business');
  const store = await getStore();
  const cycle = currentCycle();

  // The payout run is the most expensive step. areaPerformance re-uses it so
  // we avoid computing it twice.
  const payouts = await computePayoutRun(store, cycle, null);
  const areas = await areaPerformance(store, cycle, null, payouts);

  // Everything that can run in parallel after areas are known.
  const [summary, sources, purchases, escalatedComplaints] = await Promise.all([
    businessSummary(store, cycle, null, areas),
    leadSourceReport(store, null),
    store.purchaseRequests.count({ status: 'PENDING' }),
    store.complaints.count({ status: 'ESCALATED' }),
  ]);

  const unapproved = payouts.filter((p) => p.status === 'DRAFT');
  const worstSource = [...sources]
    .filter((s) => s.cost > 0)
    .sort((a, b) => b.costPerActiveCar - a.costPerActiveCar)[0];

  const staffUtilization =
    summary.staff > 0 ? (summary.washesDone / summary.staff).toFixed(0) : '0';
  const collectionRate =
    summary.billed > 0 ? Math.round((summary.collected / summary.billed) * 100) : 100;
  const completionRate =
    summary.washesDone + summary.washesMissed > 0
      ? Math.round(
          (summary.washesDone / (summary.washesDone + summary.washesMissed)) * 100,
        )
      : 100;

  return (
    <>
      {/* 8 Comprehensive Executive KPI Cards (4 columns x 2 rows) */}
      <StatGrid columns={4}>
        <StatCard
          label="COLLECTED REVENUE"
          value={moneyShort(summary.collected)}
          icon={<IconWallet width={20} height={20} strokeWidth={2} />}
          tone="emerald"
          subtext={`${collectionRate}% of ${moneyShort(summary.billed)} billed`}
          subtextTone="success"
        />
        <StatCard
          label="NET PROFIT"
          value={moneyShort(summary.profit)}
          icon={<IconRupee width={20} height={20} strokeWidth={2.2} />}
          tone={summary.profit > 0 ? 'emerald' : 'rose'}
          subtext="Collected minus staff pay & expenses"
          subtextTone={summary.profit > 0 ? 'success' : 'danger'}
        />
        <StatCard
          label="ACTIVE SUBSCRIBERS"
          value={summary.customers}
          icon={<IconUsers width={20} height={20} strokeWidth={2} />}
          tone="purple"
          subtext={`${summary.activeCars} vehicles under subscription`}
          subtextTone="muted"
        />
        <StatCard
          label="OUTSTANDING DUES"
          value={moneyShort(summary.outstanding)}
          icon={<IconClock width={20} height={20} strokeWidth={2} />}
          tone="amber"
          subtext="Pending payment collection"
          subtextTone="warning"
        />
        <StatCard
          label="WASHES DELIVERED"
          value={summary.washesDone}
          icon={<IconDroplet width={20} height={20} strokeWidth={2} />}
          tone="blue"
          subtext={`${completionRate}% completion · ${summary.washesMissed} missed`}
          subtextTone={completionRate >= 90 ? 'success' : 'warning'}
        />
        <StatCard
          label="AVG REVENUE / CAR (ARPU)"
          value={money(summary.revenuePerCar)}
          icon={<IconCar width={20} height={20} strokeWidth={2} />}
          tone="blue"
          subtext={`${money(summary.costPerWash)} delivery cost/wash`}
          subtextTone="muted"
        />
        <StatCard
          label="STAFF PRODUCTIVITY"
          value={`${staffUtilization} washes`}
          icon={<IconCheckCircle width={20} height={20} strokeWidth={2} />}
          tone="purple"
          subtext={`Avg per staff · ${summary.staff} active staff`}
          subtextTone="muted"
        />
        <StatCard
          label="CUSTOMER SATISFACTION"
          value={summary.averageRating > 0 ? `${summary.averageRating.toFixed(1)} ★` : '—'}
          icon={<IconStar width={20} height={20} strokeWidth={2} />}
          tone={summary.averageRating >= 4 ? 'emerald' : summary.averageRating > 0 ? 'amber' : 'slate'}
          subtext={
            summary.averageRating > 0
              ? `${Math.round((summary.averageRating / 5) * 100)}% satisfaction · ${summary.openComplaints} open issues`
              : 'No customer ratings recorded yet'
          }
          subtextTone={summary.averageRating >= 4 ? 'success' : summary.averageRating > 0 ? 'warning' : 'muted'}
        />
      </StatGrid>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* Left Column: Area Performance Table */}
        <div className="flex flex-col justify-between">
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
        <Card className="p-5">
          <div className="mb-3.5 flex items-center justify-between">
            <CardHeading>Owner Action Required</CardHeading>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
              Needs your decision
            </span>
          </div>

          <div className="space-y-3">
            {unapproved.length > 0 ? (
              <Link href="/admin/payout" className="block group">
                <div className="flex items-center justify-between rounded-xl border border-line-soft border-l-4 border-l-rose-500 bg-white p-3.5 shadow-xs transition-all hover:bg-slate-50/70 hover:shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                      <IconRupee width={18} height={18} strokeWidth={2.2} />
                    </div>
                    <div>
                      <b className="text-sm font-semibold text-navy-950 group-hover:text-blue-600 transition-colors">
                        Staff payout pending approval
                      </b>
                      <p className="mt-0.5 text-xs text-ink-mute">
                        {unapproved.length} staff members · {money(unapproved.reduce((s, p) => s + p.net, 0))} total · Click to approve.
                      </p>
                    </div>
                  </div>
                  <IconChevronRight width={16} height={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>
              </Link>
            ) : null}

            {purchases > 0 ? (
              <Link href="/admin/inventory" className="block group">
                <div className="flex items-center justify-between rounded-xl border border-line-soft border-l-4 border-l-amber-500 bg-white p-3.5 shadow-xs transition-all hover:bg-slate-50/70 hover:shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <IconClock width={18} height={18} strokeWidth={2.2} />
                    </div>
                    <div>
                      <b className="text-sm font-semibold text-navy-950 group-hover:text-blue-600 transition-colors">
                        {purchases} inventory purchase {purchases === 1 ? 'request' : 'requests'} waiting
                      </b>
                      <p className="mt-0.5 text-xs text-ink-mute">
                        Stock replenishment awaiting owner sign-off.
                      </p>
                    </div>
                  </div>
                  <IconChevronRight width={16} height={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>
              </Link>
            ) : null}

            {escalatedComplaints > 0 ? (
              <Link href="/admin/complaints" className="block group">
                <div className="flex items-center justify-between rounded-xl border border-line-soft border-l-4 border-l-rose-500 bg-white p-3.5 shadow-xs transition-all hover:bg-slate-50/70 hover:shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                      <IconAlert width={18} height={18} strokeWidth={2.2} />
                    </div>
                    <div>
                      <b className="text-sm font-semibold text-rose-950 group-hover:text-rose-700 transition-colors">
                        {escalatedComplaints} escalated customer {escalatedComplaints === 1 ? 'complaint' : 'complaints'}
                      </b>
                      <p className="mt-0.5 text-xs text-ink-mute">
                        Urgent issue flagged to the business owner.
                      </p>
                    </div>
                  </div>
                  <IconChevronRight width={16} height={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>
              </Link>
            ) : null}

            {summary.outstanding > 0 ? (
              <Link href="/admin/reports" className="block group">
                <div className="flex items-center justify-between rounded-xl border border-line-soft border-l-4 border-l-amber-500 bg-white p-3.5 shadow-xs transition-all hover:bg-slate-50/70 hover:shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <IconClock width={18} height={18} strokeWidth={2.2} />
                    </div>
                    <div>
                      <b className="text-sm font-semibold text-navy-950 group-hover:text-blue-600 transition-colors">
                        {money(summary.outstanding)} outstanding receivables
                      </b>
                      <p className="mt-0.5 text-xs text-ink-mute">
                        Collecting this would add {money(summary.outstanding)} straight to profit.
                      </p>
                    </div>
                  </div>
                  <IconChevronRight width={16} height={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>
              </Link>
            ) : null}

            {worstSource && worstSource.costPerActiveCar > 1000 ? (
              <Link href="/admin/sources" className="block group">
                <div className="flex items-center justify-between rounded-xl border border-line-soft border-l-4 border-l-navy-800 bg-white p-3.5 shadow-xs transition-all hover:bg-slate-50/70 hover:shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                      <IconUsers width={18} height={18} strokeWidth={2.2} />
                    </div>
                    <div>
                      <b className="text-sm font-semibold text-navy-950 group-hover:text-blue-600 transition-colors">
                        {LEAD_SOURCE_LABEL[worstSource.source]} marketing high CAC
                      </b>
                      <p className="mt-0.5 text-xs text-ink-mute">
                        {money(worstSource.cost)} spent, {worstSource.joined} joined —{' '}
                        {money(worstSource.costPerActiveCar)} per active subscriber.
                      </p>
                    </div>
                  </div>
                  <IconChevronRight width={16} height={16} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                </div>
              </Link>
            ) : null}
          </div>
        </Card>

        {/* Operational Performance Summary Card */}
        <Card className="p-5">
          <CardHeading>Operations & Service Execution</CardHeading>
          <div className="mt-2 space-y-1">
            <Row label="Washes completed" value={summary.washesDone} />
            <Row
              label="Washes missed"
              value={`${summary.washesMissed} (${percent(
                summary.washesDone + summary.washesMissed > 0
                  ? summary.washesMissed / (summary.washesDone + summary.washesMissed)
                  : 0,
              )})`}
              tone="gold"
            />
            <Row label="Active cleaner staff" value={summary.staff} />
            <Row label="Staff productivity" value={`${staffUtilization} washes / staff`} />
            <Row label="Open complaints" value={summary.openComplaints} />
            <Row
              label="Customer CSAT rating"
              value={
                summary.averageRating > 0
                  ? `${summary.averageRating.toFixed(1)} ★ (${Math.round((summary.averageRating / 5) * 100)}%)`
                  : '—'
              }
            />
            <Row label="Revenue per car (ARPU)" value={money(summary.revenuePerCar)} />
            <Row label="Direct cost per wash" value={money(summary.costPerWash)} />
          </div>
        </Card>

        {/* Monthly P&L Financial Summary Card */}
        <Card className="p-5">
          <CardHeading>Monthly Financial P&L Breakdown</CardHeading>
          <div className="mt-2 space-y-1">
            <Row label="Total Billed" value={money(summary.billed)} />
            <Row label="Total Collected" value={money(summary.collected)} tone="success" />
            <Row
              label="Collection Rate"
              value={percent(summary.billed ? summary.collected / summary.billed : 0)}
            />
            <Row label="Staff Payout Cost" value={money(summary.payoutCost)} />
            <Row label="Consumables & Operating Expenses" value={money(summary.expenses)} />
            <Row
              label="Net Profit"
              value={money(summary.profit)}
              tone={summary.profit > 0 ? 'success' : 'danger'}
            />
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
