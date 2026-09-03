import { Suspense } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Card,
  CardHeading,
  Kpi,
  KpiGrid,
  Note,
  Row,
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
  const [summary, sources, purchases] = await Promise.all([
    businessSummary(store, cycle, null, areas),
    leadSourceReport(store, null),
    store.purchaseRequests.count({ status: 'PENDING' }),
  ]);

  const unapproved = payouts.filter((p) => p.status === 'DRAFT');
  const ranked = [...areas].sort((a, b) => b.margin - a.margin);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const worstSource = [...sources]
    .filter((s) => s.cost > 0)
    .sort((a, b) => b.costPerActiveCar - a.costPerActiveCar)[0];

  return (
    <>
      <KpiGrid columns={6}>
        <Kpi
          label="ACTIVE CUSTOMERS"
          value={summary.customers}
          tone="purple"
          subtext="Registered accounts"
        />
        <Kpi
          label="ACTIVE CARS"
          value={summary.activeCars}
          tone="blue"
          subtext="Under subscription"
        />
        <Kpi
          label="COLLECTED"
          value={moneyShort(summary.collected)}
          tone="emerald"
          subtext="Received this cycle"
        />
        <Kpi
          label="TOTAL COST"
          value={moneyShort(summary.payoutCost + summary.expenses)}
          tone="slate"
          subtext="Payouts & expenses"
        />
        <Kpi
          label="NET PROFIT"
          value={moneyShort(summary.profit)}
          tone={summary.profit > 0 ? 'emerald' : 'rose'}
          subtext={`${percent(summary.margin)} net margin`}
        />
        <Kpi
          label="OUTSTANDING"
          value={moneyShort(summary.outstanding)}
          tone="amber"
          subtext="Pending collection"
        />
      </KpiGrid>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col justify-between">
          <WidgetTable<(typeof areas)[number]>
            title="Area performance"
            data={areas}
            keyExtractor={(area) => area.area.id}
            emptyMessage="No performance data recorded."
            columns={[
              {
                id: 'area',
                header: 'AREA',
                className: 'font-bold text-navy-950',
                render: (area) => area.area.name,
              },
              {
                id: 'customers',
                header: 'CUSTOMERS',
                align: 'center',
                render: (area) => area.customers,
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
                render: (area) => (
                  <span
                    className={
                      area.profit > 0
                        ? 'font-bold text-emerald-600'
                        : 'font-bold text-rose-600'
                    }
                  >
                    {moneyShort(area.profit)}
                  </span>
                ),
              },
              {
                id: 'margin',
                header: 'MARGIN',
                align: 'right',
                className: 'font-bold text-slate-900',
                render: (area) => percent(area.margin),
              },
            ]}
          />
          {best && worst && best.area.id !== worst.area.id ? (
            <div className="mt-2">
              <Note>
                <b>{worst.area.name} is your weakest</b> — {percent(worst.margin)}{' '}
                against {percent(best.margin)} in {best.area.name}, on the same
                package prices. The difference is route density and missed
                washes, not pricing.
              </Note>
            </div>
          ) : null}
        </div>

        <Card className="p-4">
          <CardHeading>Needs your decision</CardHeading>

          {unapproved.length > 0 ? (
            <Link href="/admin/payout" className="mb-2 block">
              <div className="rounded-lg border border-line border-l-4 border-l-danger-500 bg-white p-3 hover:bg-surface-muted">
                <b className="text-sm">Staff payout not approved</b>
                <p className="mt-0.5 text-xs text-ink-mute">
                  {unapproved.length} staff ·{' '}
                  {money(unapproved.reduce((s, p) => s + p.net, 0))} · nothing is
                  paid until you approve it.
                </p>
              </div>
            </Link>
          ) : null}

          {purchases > 0 ? (
            <Link href="/admin/inventory" className="mb-2 block">
              <div className="rounded-lg border border-line border-l-4 border-l-gold-500 bg-white p-3 hover:bg-surface-muted">
                <b className="text-sm">
                  {purchases} purchase {purchases === 1 ? 'request' : 'requests'}{' '}
                  waiting
                </b>
                <p className="mt-0.5 text-xs text-ink-mute">
                  Nothing is bought until you approve it.
                </p>
              </div>
            </Link>
          ) : null}

          {summary.outstanding > 0 ? (
            <Link href="/admin/reports" className="mb-2 block">
              <div className="rounded-lg border border-line border-l-4 border-l-gold-500 bg-white p-3 hover:bg-surface-muted">
                <b className="text-sm">
                  {money(summary.outstanding)} outstanding
                </b>
                <p className="mt-0.5 text-xs text-ink-mute">
                  Collecting it would take margin from{' '}
                  {percent(summary.margin)} to{' '}
                  {percent(
                    summary.collected + summary.outstanding > 0
                      ? (summary.profit + summary.outstanding) /
                          (summary.collected + summary.outstanding)
                      : 0,
                  )}
                  .
                </p>
              </div>
            </Link>
          ) : null}

          {worstSource && worstSource.costPerActiveCar > 1000 ? (
            <Link href="/admin/sources" className="block">
              <div className="rounded-lg border border-line border-l-4 border-l-navy-800 bg-white p-3 hover:bg-surface-muted">
                <b className="text-sm">
                  {LEAD_SOURCE_LABEL[worstSource.source]} is not working
                </b>
                <p className="mt-0.5 text-xs text-ink-mute">
                  {money(worstSource.cost)} spent, {worstSource.joined} joined,{' '}
                  {worstSource.stillActive} still active —{' '}
                  {money(worstSource.costPerActiveCar)} per car that stays.
                </p>
              </div>
            </Link>
          ) : null}
        </Card>

        <Card className="p-4">
          <CardHeading>This month across the business</CardHeading>
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
          <Row label="Staff" value={summary.staff} />
          <Row label="Open complaints" value={summary.openComplaints} />
          <Row
            label="Average rating"
            value={summary.averageRating ? `${summary.averageRating.toFixed(1)} ★` : '—'}
          />
          <Row label="Revenue per car" value={money(summary.revenuePerCar)} />
          <Row label="Cost per wash" value={money(summary.costPerWash)} />
        </Card>

        <Card className="p-4">
          <CardHeading>Money this month</CardHeading>
          <Row label="Billed" value={money(summary.billed)} />
          <Row label="Collected" value={money(summary.collected)} tone="success" />
          <Row
            label="Collection rate"
            value={percent(summary.billed ? summary.collected / summary.billed : 0)}
          />
          <Row label="Staff payout" value={money(summary.payoutCost)} />
          <Row label="Other expenses" value={money(summary.expenses)} />
          <Row
            label="Net profit"
            value={money(summary.profit)}
            tone={summary.profit > 0 ? 'success' : 'danger'}
          />
          <Row label="Margin" value={percent(summary.margin)} />
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
      <KpiGridSkeleton count={6} />
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
