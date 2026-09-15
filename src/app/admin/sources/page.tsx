import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Card,
  CardHeading,
  Note,
  Tag,
} from '@/components/ui/primitives';
import { DataTable } from '@/components/ui/DataTable';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { leadSourceReport } from '@/lib/services/reports';
import { money, percent } from '@/lib/util/format';
import { LEAD_SOURCE_LABEL } from '@/lib/util/labels';

export const metadata = { title: 'Lead sources' };

export default async function AdminSources() {
  await requirePermission('report:business');
  const store = await getStore();
  const rows = await leadSourceReport(store, null);

  const paid = rows.filter((r) => r.cost > 0);
  const cheapest = paid.sort((a, b) => a.costPerActiveCar - b.costPerActiveCar)[0];
  const dearest = paid[paid.length - 1];

  return (
    <>
      <PageHeader
        title="Lead sources"
        description="Which reference actually brings customers who stay"
      />

      <Card className="mb-3 p-4">
        <p className="text-sm text-ink-mute">
          Every new customer must have a source recorded — the intake form
          cannot be completed without it. This is that data.
        </p>
      </Card>

      <DataTable<(typeof rows)[number]>
        data={rows}
        keyExtractor={(row) => row.source}
        itemLabel="lead sources"
        emptyMessage="No lead source data available."
        columns={[
          {
            id: 'source',
            header: 'SOURCE',
            className: 'font-bold text-navy-950',
            render: (row) => LEAD_SOURCE_LABEL[row.source],
          },
          {
            id: 'joined',
            header: 'CUSTOMERS JOINED',
            align: 'center',
            render: (row) => row.joined,
          },
          {
            id: 'stillActive',
            header: 'STILL ACTIVE',
            align: 'center',
            render: (row) => row.stillActive,
          },
          {
            id: 'retention',
            header: 'RETENTION',
            align: 'center',
            render: (row) => (
              <span
                className={
                  row.retention >= 0.85
                    ? 'font-bold text-emerald-600'
                    : row.retention < 0.5
                      ? 'font-bold text-rose-600'
                      : 'text-gold-600'
                }
              >
                {percent(row.retention)}
              </span>
            ),
          },
          {
            id: 'cost',
            header: 'COST',
            render: (row) => money(row.cost),
          },
          {
            id: 'costPerActiveCar',
            header: 'COST PER ACTIVE CUSTOMER',
            className: 'font-bold text-slate-900',
            render: (row) => money(row.costPerActiveCar),
          },
          {
            id: 'verdict',
            header: 'VERDICT',
            render: (row) => {
              const verdict =
                row.cost === 0 && row.stillActive > 0
                  ? { tone: 'ok' as const, label: 'Free' }
                  : row.retention >= 0.85 && row.costPerActiveCar < 500
                    ? { tone: 'ok' as const, label: 'Best' }
                    : row.joined < 3
                      ? { tone: 'neutral' as const, label: 'Low volume' }
                      : row.costPerActiveCar > 1500 || row.retention < 0.5
                        ? { tone: 'bad' as const, label: 'Stop' }
                        : { tone: 'warn' as const, label: 'Expensive' };
              return <Tag tone={verdict.tone}>{verdict.label}</Tag>;
            },
          },
        ]}
      />

      {cheapest && dearest && cheapest.source !== dearest.source ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <Card accent="brand" className="p-4">
            <CardHeading>What this says</CardHeading>
            <p className="text-sm leading-relaxed text-ink-mute">
              {LEAD_SOURCE_LABEL[cheapest.source]} brings your cheapest and
              stickiest customers at {money(cheapest.costPerActiveCar)} each.{' '}
              {LEAD_SOURCE_LABEL[dearest.source]} costs{' '}
              {money(dearest.costPerActiveCar)} per customer who stays —{' '}
              {dearest.costPerActiveCar && cheapest.costPerActiveCar
                ? `${Math.round(dearest.costPerActiveCar / Math.max(1, cheapest.costPerActiveCar))}×`
                : 'far'}{' '}
              more.
            </p>
            <div className="mt-3">
              <Note>
                Moving the {money(dearest.cost)} spent on{' '}
                {LEAD_SOURCE_LABEL[dearest.source]} into{' '}
                {LEAD_SOURCE_LABEL[cheapest.source]} would, at current rates,
                bring roughly{' '}
                {Math.floor(dearest.cost / Math.max(1, cheapest.costPerActiveCar))}{' '}
                more customers instead of {dearest.stillActive}.
              </Note>
            </div>
          </Card>

          <Card className="p-4">
            <CardHeading>Referral spend this month</CardHeading>
            {rows
              .filter((r) => r.cost > 0)
              .map((row) => (
                <div
                  key={row.source}
                  className="flex items-baseline justify-between border-b border-dashed border-line-soft py-1.5 text-sm last:border-0"
                >
                  <span className="text-ink-mute">
                    {LEAD_SOURCE_LABEL[row.source]}
                  </span>
                  <span className="font-bold">{money(row.cost)}</span>
                </div>
              ))}
            <div className="mt-3">
              <Note>
                Customer references retain best and cost nothing. Even a small
                credit would still make it your cheapest channel.
              </Note>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}
