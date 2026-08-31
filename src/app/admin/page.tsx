import Link from 'next/link';
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

export default async function AdminOverview() {
  await requirePermission('report:business');
  const store = await getStore();
  const cycle = currentCycle();

  const [summary, areas, payouts, sources, purchases] = await Promise.all([
    businessSummary(store, cycle, null),
    areaPerformance(store, cycle, null),
    computePayoutRun(store, cycle, null),
    leadSourceReport(store, null),
    store.purchaseRequests.count({ status: 'PENDING' }),
  ]);

  const unapproved = payouts.filter((p) => p.status === 'DRAFT');
  const ranked = [...areas].sort((a, b) => b.margin - a.margin);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  // The channel burning the most money per customer who actually stays.
  const worstSource = [...sources]
    .filter((s) => s.cost > 0)
    .sort((a, b) => b.costPerActiveCar - a.costPerActiveCar)[0];

  return (
    <>
      <PageHeader
        title="Business overview"
        description={`${cycleLabel(cycle)} · every area`}
      />

      <KpiGrid>
        <Kpi label="Customers" value={summary.customers} />
        <Kpi label="Active cars" value={summary.activeCars} />
        <Kpi label="Collected" value={moneyShort(summary.collected)} tone="success" />
        <Kpi
          label="Total cost"
          value={moneyShort(summary.payoutCost + summary.expenses)}
        />
        <Kpi
          label="Net profit"
          value={moneyShort(summary.profit)}
          tone={summary.profit > 0 ? 'success' : 'danger'}
          hint={percent(summary.margin)}
        />
        <Kpi
          label="Outstanding"
          value={moneyShort(summary.outstanding)}
          tone="danger"
        />
      </KpiGrid>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <CardHeading>Area performance</CardHeading>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Area</Th>
                  <Th>Customers</Th>
                  <Th>Collected</Th>
                  <Th>Cost</Th>
                  <Th>Profit</Th>
                  <Th>Margin</Th>
                </tr>
              </thead>
              <tbody>
                {areas.map((area) => (
                  <tr key={area.area.id}>
                    <Td className="font-bold">{area.area.name}</Td>
                    <Td>{area.customers}</Td>
                    <Td>{moneyShort(area.collected)}</Td>
                    <Td>{moneyShort(area.goodsCost + area.payoutCost)}</Td>
                    <Td
                      className={
                        area.profit > 0
                          ? 'font-bold text-success-600'
                          : 'font-bold text-danger-500'
                      }
                    >
                      {moneyShort(area.profit)}
                    </Td>
                    <Td className="font-bold">{percent(area.margin)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>

          {best && worst && best.area.id !== worst.area.id ? (
            <div className="mt-3">
              <Note>
                <b>{worst.area.name} is your weakest</b> — {percent(worst.margin)}{' '}
                against {percent(best.margin)} in {best.area.name}, on the same
                package prices. The difference is route density and missed
                washes, not pricing.
              </Note>
            </div>
          ) : null}
        </Card>

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
