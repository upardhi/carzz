import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Card,
  CardHeading,
  Kpi,
  KpiGrid,
  Note,
  Row,
  Table,
  TableWrap,
  Td,
  Th,
} from '@/components/ui/primitives';
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

  // businessSummary is derived from the area rows, so compute those once.
  const areas = await areaPerformance(store, cycle, null);
  const [summary, missed, staff, consumption, customers] = await Promise.all([
    businessSummary(store, cycle, null, areas),
    missedWashReport(store, cycle, null),
    staffPerformance(store, cycle, null),
    consumptionByArea(store, cycle, null),
    store.customers.find(),
  ]);

  const areaById = new Map(areas.map((a) => [a.area.id, a.area]));

  // Churn: how long the customers who left actually stayed. Losing people in
  // the first month points at the lead source, not the service.
  const lost = customers.filter((c) => c.status === 'INACTIVE');
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

  const bestPerWash = [...consumption]
    .filter((c) => c.washes > 0)
    .sort((a, b) => a.perWash - b.perWash)[0];
  const worstPerWash = [...consumption]
    .filter((c) => c.washes > 0)
    .sort((a, b) => b.perWash - a.perWash)[0];

  return (
    <>
      <PageHeader title="Reports" description={cycleLabel(cycle)} />

      <KpiGrid>
        <Kpi label="Billed" value={money(summary.billed)} />
        <Kpi label="Collected" value={money(summary.collected)} tone="success" />
        <Kpi
          label="Collection rate"
          value={percent(summary.billed ? summary.collected / summary.billed : 0)}
        />
        <Kpi label="Washes done" value={summary.washesDone} />
        <Kpi label="Washes missed" value={missed.total} tone="gold" />
        <Kpi label="Customers lost" value={lost.length} tone="danger" />
      </KpiGrid>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <CardHeading>Collection by area</CardHeading>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Area</Th>
                  <Th>Billed</Th>
                  <Th>Collected</Th>
                  <Th>Outstanding</Th>
                  <Th>Rate</Th>
                </tr>
              </thead>
              <tbody>
                {areas.map((area) => {
                  const rate = area.billed ? area.collected / area.billed : 0;
                  return (
                    <tr key={area.area.id}>
                      <Td className="font-bold">{area.area.name}</Td>
                      <Td>{money(area.billed)}</Td>
                      <Td>{money(area.collected)}</Td>
                      <Td>{money(area.outstanding)}</Td>
                      <Td
                        className={
                          rate < 0.75
                            ? 'font-bold text-danger-500'
                            : 'font-bold text-success-600'
                        }
                      >
                        {percent(rate)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card className="p-4">
          <CardHeading>Missed washes</CardHeading>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Reason</Th>
                  <Th>Count</Th>
                  <Th>Cost to deliver again</Th>
                </tr>
              </thead>
              <tbody>
                {missed.rows.map((row) => (
                  <tr key={row.reason}>
                    <Td>{MISS_REASON_LABEL[row.reason]}</Td>
                    <Td className="font-bold">{row.count}</Td>
                    <Td>{money(row.costToDeliver)}</Td>
                  </tr>
                ))}
                {missed.rows.length ? (
                  <tr>
                    <Td className="font-extrabold">Total</Td>
                    <Td className="font-extrabold">{missed.total}</Td>
                    <Td className="font-extrabold">{money(missed.totalCost)}</Td>
                  </tr>
                ) : (
                  <tr>
                    <Td className="py-6 text-center text-ink-mute" colSpan={3}>
                      No missed washes this month.
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </TableWrap>
          {missed.total > 0 ? (
            <div className="mt-3">
              <Note>
                Every missed wash returns to the customer&rsquo;s count, so you
                deliver it later at no extra charge — {money(missed.totalCost)}{' '}
                of delivery cost you carry each month.
              </Note>
            </div>
          ) : null}
        </Card>

        <Card className="p-4">
          <CardHeading>Staff performance</CardHeading>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Wash boy</Th>
                  <Th>Area</Th>
                  <Th>Washes</Th>
                  <Th>On-time</Th>
                  <Th>Rating</Th>
                  <Th>Missed</Th>
                  <Th>Complaints</Th>
                </tr>
              </thead>
              <tbody>
                {staff.slice(0, 15).map((row) => (
                  <tr key={row.staffId}>
                    <Td className="font-bold">{row.name}</Td>
                    <Td>{areaById.get(row.areaId)?.name ?? '—'}</Td>
                    <Td>{row.washes}</Td>
                    <Td
                      className={
                        row.onTimeRate < 0.7
                          ? 'font-bold text-danger-500'
                          : row.onTimeRate > 0.9
                            ? 'font-bold text-success-600'
                            : ''
                      }
                    >
                      {percent(row.onTimeRate)}
                    </Td>
                    <Td>{row.averageRating ? row.averageRating.toFixed(1) : '—'}</Td>
                    <Td>{row.missed}</Td>
                    <Td className={row.complaints > 5 ? 'font-bold text-danger-500' : ''}>
                      {row.complaints}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card className="p-4">
          <CardHeading>Goods cost per wash</CardHeading>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Area</Th>
                  <Th>Washes</Th>
                  <Th>Goods cost</Th>
                  <Th>Per wash</Th>
                </tr>
              </thead>
              <tbody>
                {consumption.map((row) => (
                  <tr key={row.areaId}>
                    <Td className="font-bold">{row.areaName}</Td>
                    <Td>{row.washes}</Td>
                    <Td>{money(row.goodsCost)}</Td>
                    <Td className="font-bold">₹{row.perWash.toFixed(2)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>

          {bestPerWash &&
          worstPerWash &&
          worstPerWash.perWash > bestPerWash.perWash * 1.2 ? (
            <div className="mt-3">
              <Note tone="danger">
                <b>
                  {worstPerWash.areaName} uses{' '}
                  {Math.round((worstPerWash.perWash / bestPerWash.perWash - 1) * 100)}%
                  more per wash than {bestPerWash.areaName}.
                </b>{' '}
                Same packages, same cars. Either staff are over-pouring, or
                stock is going missing.
              </Note>
            </div>
          ) : null}
        </Card>

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
