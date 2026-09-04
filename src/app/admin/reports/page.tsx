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
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { consumptionByArea } from '@/lib/services/inventory';
import {
  areaPerformance,
  businessSummary,
  missedWashReport,
  staffPerformance,
} from '@/lib/services/reports';
import { currentCycle, cycleLabel, money, percent } from '@/lib/util/format';
import { MISS_REASON_LABEL } from '@/lib/util/labels';

export const metadata = { title: 'Reports' };

export default async function AdminReports() {
  await requirePermission('report:business');
  const store = await getStore();
  const cycle = currentCycle();

  // Fetch independent reports and inactive churn customers in parallel
  const [areas, missed, staff, consumption, lost] = await Promise.all([
    areaPerformance(store, cycle, null),
    missedWashReport(store, cycle, null),
    staffPerformance(store, cycle, null, { limit: 5 }),
    consumptionByArea(store, cycle, null),
    store.customers.find({ where: { status: 'INACTIVE' } as never }),
  ]);
  const summary = await businessSummary(store, cycle, null, areas);

  const areaById = new Map(areas.map((a) => [a.area.id, a.area]));

  // Churn: how long the customers who left actually stayed. Losing people in
  // the first month points at the lead source, not the service.
  const monthsOf = (joinedOn: string) =>
    Math.floor(
      (Date.now() - new Date(`${joinedOn}T00:00:00Z`).getTime()) /
        (30 * 86400000),
    );
  const churnBuckets = {
    early: lost.filter((c) => monthsOf(c.joinedOn) <= 1).length,
    mid: lost.filter((c) => monthsOf(c.joinedOn) > 1 && monthsOf(c.joinedOn) <= 3).length,
    late: lost.filter((c) => monthsOf(c.joinedOn) > 3).length,
  };

  const activeConsumption = consumption.filter(
    (c) => c.washes > 0 && c.perWash > 0,
  );
  const bestPerWash = [...activeConsumption].sort(
    (a, b) => a.perWash - b.perWash,
  )[0];
  const worstPerWash = [...activeConsumption].sort(
    (a, b) => b.perWash - a.perWash,
  )[0];

  return (
    <>
      <PageHeader title="Reports" description={cycleLabel(cycle)} />

      <KpiGrid columns={6}>
        <Kpi
          label="TOTAL BILLED"
          value={money(summary.billed)}
          tone="blue"
          subtext="Invoiced this month"
        />
        <Kpi
          label="COLLECTED"
          value={money(summary.collected)}
          tone="emerald"
          subtext="Total cash received"
        />
        <Kpi
          label="COLLECTION RATE"
          value={percent(summary.billed ? summary.collected / summary.billed : 0)}
          tone={summary.billed && summary.collected / summary.billed < 0.8 ? 'amber' : 'emerald'}
          subtext={summary.billed && summary.collected / summary.billed >= 0.8 ? 'Healthy collection' : 'Action needed'}
        />
        <Kpi
          label="WASHES DONE"
          value={summary.washesDone}
          tone="purple"
          subtext="Across all areas"
        />
        <Kpi
          label="WASHES MISSED"
          value={missed.total}
          tone="amber"
          subtext="Carried over"
        />
        <Kpi
          label="CUSTOMERS LOST"
          value={lost.length}
          tone="rose"
          subtext={lost.length > 0 ? `${lost.length} churned accounts` : 'Zero churn'}
        />
      </KpiGrid>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <WidgetTable<(typeof areas)[number]>
          title="Collection by area"
          data={areas}
          keyExtractor={(area) => area.area.id}
          emptyMessage="No performance data available."
          columns={[
            {
              id: 'area',
              header: 'AREA',
              className: 'font-bold text-navy-950',
              render: (area) => area.area.name,
            },
            {
              id: 'billed',
              header: 'BILLED',
              render: (area) => money(area.billed),
            },
            {
              id: 'collected',
              header: 'COLLECTED',
              render: (area) => money(area.collected),
            },
            {
              id: 'outstanding',
              header: 'OUTSTANDING',
              render: (area) => money(area.outstanding),
            },
            {
              id: 'rate',
              header: 'RATE',
              align: 'right',
              render: (area) => {
                const rate = area.billed ? area.collected / area.billed : 0;
                return (
                  <span
                    className={
                      rate < 0.75
                        ? 'font-bold text-rose-600'
                        : 'font-semibold text-emerald-600'
                    }
                  >
                    {percent(rate)}
                  </span>
                );
              },
            },
          ]}
        />

        <div className="flex flex-col justify-between">
          <WidgetTable<(typeof missed.rows)[number]>
            title="Missed washes"
            data={missed.rows}
            keyExtractor={(row) => row.reason}
            emptyMessage="No missed washes this month."
            columns={[
              {
                id: 'reason',
                header: 'REASON',
                render: (row) => MISS_REASON_LABEL[row.reason],
              },
              {
                id: 'count',
                header: 'COUNT',
                className: 'font-bold text-navy-950',
                align: 'center',
                render: (row) => row.count,
              },
              {
                id: 'cost',
                header: 'COST TO DELIVER AGAIN',
                align: 'right',
                render: (row) => money(row.costToDeliver),
              },
            ]}
          />
          {missed.total > 0 ? (
            <div className="mt-2">
              <Note>
                Every missed wash returns to the customer&rsquo;s count, so you
                deliver it later at no extra charge — {money(missed.totalCost)}{' '}
                of delivery cost you carry each month.
              </Note>
            </div>
          ) : null}
        </div>

        <WidgetTable<(typeof staff.rows)[number]>
          title="Staff performance"
          action={
            staff.total > 5 ? (
              <Link
                href="/admin/reports/staff"
                className="text-xs font-bold text-navy-600 hover:text-navy-800 transition-colors"
              >
                View all ({staff.total}) →
              </Link>
            ) : undefined
          }
          data={staff.rows}
          keyExtractor={(row) => row.staffId}
          emptyMessage="No staff performance recorded."
          columns={[
            {
              id: 'name',
              header: 'WASH BOY',
              className: 'font-bold text-navy-950',
              render: (row) => row.name,
            },
            {
              id: 'area',
              header: 'AREA',
              render: (row) => areaById.get(row.areaId)?.name ?? '—',
            },
            {
              id: 'washes',
              header: 'WASHES',
              align: 'center',
              render: (row) => row.washes,
            },
            {
              id: 'onTime',
              header: 'ON-TIME',
              align: 'center',
              render: (row) => (
                <span
                  className={
                    row.onTimeRate < 0.7
                      ? 'font-bold text-rose-600'
                      : 'text-slate-700'
                  }
                >
                  {percent(row.onTimeRate)}
                </span>
              ),
            },
            {
              id: 'rating',
              header: 'RATING',
              align: 'center',
              render: (row) => (row.averageRating ? `${row.averageRating.toFixed(1)} ★` : '—'),
            },
            {
              id: 'missed',
              header: 'MISSED',
              align: 'center',
              render: (row) => row.missed,
            },
            {
              id: 'complaints',
              header: 'COMPLAINTS',
              align: 'right',
              render: (row) => (
                <span className={row.complaints > 5 ? 'font-bold text-rose-600' : 'text-slate-700'}>
                  {row.complaints}
                </span>
              ),
            },
          ]}
        />

        <div className="flex flex-col justify-between">
          <WidgetTable<(typeof consumption)[number]>
            title="Goods cost per wash"
            data={consumption}
            keyExtractor={(row) => row.areaId}
            emptyMessage="No consumption data recorded."
            columns={[
              {
                id: 'area',
                header: 'AREA',
                className: 'font-bold text-navy-950',
                render: (row) => row.areaName,
              },
              {
                id: 'washes',
                header: 'WASHES',
                align: 'center',
                render: (row) => row.washes,
              },
              {
                id: 'goodsCost',
                header: 'GOODS COST',
                render: (row) => money(row.goodsCost),
              },
              {
                id: 'perWash',
                header: 'PER WASH',
                align: 'right',
                className: 'font-bold text-slate-900',
                render: (row) => `₹${row.perWash.toFixed(2)}`,
              },
            ]}
          />
          {bestPerWash &&
          worstPerWash &&
          bestPerWash.areaId !== worstPerWash.areaId &&
          bestPerWash.perWash > 0 &&
          worstPerWash.perWash > bestPerWash.perWash * 1.2 ? (
            <div className="mt-2">
              <Note tone="danger">
                <b>
                  {worstPerWash.areaName} uses{' '}
                  {Math.round(
                    ((worstPerWash.perWash - bestPerWash.perWash) /
                      bestPerWash.perWash) *
                      100,
                  )}
                  % more per wash than {bestPerWash.areaName}.
                </b>{' '}
                Same packages, same cars. Either staff are over-pouring, or
                stock is going missing.
              </Note>
            </div>
          ) : null}
        </div>

        <Card className="p-4">
          <CardHeading>Customer churn</CardHeading>
          <Row label="Customers lost" value={lost.length} tone="danger" />
          <Row label="Left within the first month" value={churnBuckets.early} />
          <Row label="Left after 2–3 months" value={churnBuckets.mid} />
          <Row label="Long-term customers lost" value={churnBuckets.late} />
          {churnBuckets.early > lost.length / 2 && lost.length > 0 ? (
            <div className="mt-3">
              <Note tone="danger">
                {churnBuckets.early} of {lost.length} left inside the first
                month. That is a lead-source problem more than a service one —
                check which channels those customers came from.
              </Note>
            </div>
          ) : null}
        </Card>
      </div>
    </>
  );
}
