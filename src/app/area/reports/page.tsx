import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Kpi,
  KpiGrid,
  Note,
} from '@/components/ui/primitives';
import { WidgetTable } from '@/components/ui/WidgetTable';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import {
  areaPerformance,
  missedWashReport,
  staffPerformance,
} from '@/lib/services/reports';
import { consumptionByArea } from '@/lib/services/inventory';
import { currentCycle, cycleLabel, money, percent } from '@/lib/util/format';
import { MISS_REASON_LABEL } from '@/lib/util/labels';

export const metadata = { title: 'Reports' };

export default async function AreaReports() {
  const session = await requirePermission('report:area');
  const store = await getStore();
  const cycle = currentCycle();
  const areaIds = session.scope.areaIds;

  const [performance, missed, staff, consumption, areas] = await Promise.all([
    areaPerformance(store, cycle, areaIds),
    missedWashReport(store, cycle, areaIds),
    staffPerformance(store, cycle, areaIds),
    consumptionByArea(store, cycle, areaIds),
    store.areas.find(),
  ]);

  const areaById = new Map(areas.map((a) => [a.id, a]));
  const billed = performance.reduce((s, p) => s + p.billed, 0);
  const collected = performance.reduce((s, p) => s + p.collected, 0);
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
          value={money(billed)}
          tone="blue"
          subtext="Invoiced this month"
        />
        <Kpi
          label="COLLECTED"
          value={money(collected)}
          tone="emerald"
          subtext="Received to date"
        />
        <Kpi
          label="COLLECTION RATE"
          value={percent(billed ? collected / billed : 0)}
          tone={billed && collected / billed < 0.8 ? 'amber' : 'emerald'}
          subtext={billed && collected / billed >= 0.8 ? 'On target' : 'Below target'}
        />
        <Kpi
          label="WASHES DONE"
          value={performance.reduce((s, p) => s + p.washesDone, 0)}
          tone="purple"
          subtext="Delivered successfully"
        />
        <Kpi
          label="WASHES MISSED"
          value={missed.total}
          tone="amber"
          subtext="To reschedule"
        />
        <Kpi
          label="COST OF MISSED"
          value={money(missed.totalCost)}
          tone="rose"
          subtext="Unrecovered labor cost"
        />
      </KpiGrid>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <WidgetTable<(typeof performance)[number]>
          title="Collection by area"
          data={performance}
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
                  <span className={rate < 0.75 ? 'font-bold text-rose-600' : 'font-semibold text-emerald-600'}>
                    {percent(rate)}
                  </span>
                );
              },
            },
          ]}
        />

        <div className="flex flex-col justify-between">
          <WidgetTable<(typeof missed.rows)[number]>
            title="Why washes were missed"
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
                Each of these returns to the customer&rsquo;s count, so you
                deliver it later at no extra charge — {money(missed.totalCost)}{' '}
                of delivery cost you carry this month.
              </Note>
            </div>
          ) : null}
        </div>

        <WidgetTable<(typeof staff)[number]>
          title="Staff performance"
          data={staff}
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
                <span className={row.onTimeRate < 0.7 ? 'font-bold text-rose-600' : 'text-slate-700'}>
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
                {worstPerWash.areaName} uses{' '}
                {Math.round(
                  ((worstPerWash.perWash - bestPerWash.perWash) /
                    bestPerWash.perWash) *
                    100,
                )}
                % more per wash than {bestPerWash.areaName} on the same packages.
                Either staff are over-pouring, or stock is going missing.
              </Note>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
