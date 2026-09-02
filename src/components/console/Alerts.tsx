import Link from 'next/link';
import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Card,
  EmptyState,
  Kpi,
  KpiGrid,
  Note,
  Tag,
} from '@/components/ui/primitives';
import { DataTable } from '@/components/ui/DataTable';
import type { Session } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { loadRedAlerts } from '@/lib/services/accounts';
import { formatDateFull, money } from '@/lib/util/format';
import { ActionButton } from './ActionButton';

/** The chase list — who owes what, worst first. */
export async function ConsoleAlerts({
  session,
  base,
}: {
  session: Session;
  base: string;
}) {
  const store = await getStore();
  const [alerts, areas] = await Promise.all([
    loadRedAlerts(store, session.scope.areaIds),
    store.areas.find(),
  ]);
  const areaById = new Map(areas.map((a) => [a.id, a]));

  const total = alerts.reduce((sum, a) => sum + a.amount, 0);
  const severe = alerts.filter((a) => a.daysOverdue > 14);

  return (
    <>
      <PageHeader
        title="Red alerts"
        description="Customers the system has flagged for payment"
      />

      <KpiGrid>
        <Kpi label="Customers" value={alerts.length} tone={alerts.length ? 'danger' : 'success'} />
        <Kpi label="Outstanding" value={money(total)} tone={total ? 'gold' : 'success'} />
        <Kpi label="Over 14 days" value={severe.length} tone={severe.length ? 'danger' : 'default'} />
        <Kpi
          label="Worst"
          value={alerts.length ? `${alerts[0].daysOverdue}d` : '—'}
          tone={alerts.length ? 'danger' : 'default'}
        />
      </KpiGrid>

      {alerts.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Nobody to chase"
            hint="Every customer in your area is paid up to date."
          />
        </div>
      ) : (
        <>
          <Card tone="danger" accent="danger" className="mb-3 mt-4 p-4">
            <h3 className="text-sm font-extrabold">
              {alerts.length} customers owe {money(total)}
            </h3>
            <p className="mt-1 text-sm text-ink-mute">
              These are flagged automatically when an invoice passes its due
              date or an advance runs out with no payment received.
            </p>
          </Card>

          <DataTable<Awaited<ReturnType<typeof loadRedAlerts>>[number]>
            data={alerts}
            keyExtractor={(a) => a.customer.id}
            itemLabel="alerts"
            emptyMessage="Nobody to chase. Every customer is paid up to date."
            columns={[
              {
                id: 'customer',
                header: 'CUSTOMER',
                render: (alert) => (
                  <div>
                    <Link
                      href={`${base}/customers/${alert.customer.id}`}
                      className="font-bold text-navy-950 hover:text-blue-600 transition-colors"
                    >
                      {alert.customer.name}
                    </Link>
                    <div className="text-[11px] text-slate-400">
                      {alert.customer.phone}
                    </div>
                  </div>
                ),
              },
              {
                id: 'area',
                header: 'AREA',
                render: (alert) => areaById.get(alert.customer.areaId)?.name ?? '—',
              },
              {
                id: 'reason',
                header: 'REASON',
                render: (alert) => alert.reason,
              },
              {
                id: 'amount',
                header: 'AMOUNT',
                className: 'font-bold text-slate-900',
                render: (alert) => money(alert.amount),
              },
              {
                id: 'days',
                header: 'DAYS',
                render: (alert) => (
                  <span className={alert.daysOverdue > 14 ? 'font-extrabold text-rose-600' : 'font-semibold text-slate-700'}>
                    {alert.daysOverdue}
                  </span>
                ),
              },
              {
                id: 'lastPayment',
                header: 'LAST PAYMENT',
                className: 'whitespace-nowrap text-slate-600',
                render: (alert) =>
                  alert.lastPaymentOn
                    ? formatDateFull(alert.lastPaymentOn)
                    : 'Never',
              },
              {
                id: 'action',
                header: 'ACTION',
                render: (alert) => (
                  <div className="flex gap-1.5">
                    <a
                      href={`https://wa.me/91${alert.customer.phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(
                        `Hello ${alert.customer.name}, this is a reminder that ${money(alert.amount)} is pending on your Carz car wash account. Please pay at your convenience. Thank you.`,
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-navy-700 transition-colors shadow-2xs"
                    >
                      Remind
                    </a>
                    {alert.customer.status === 'ACTIVE' ? (
                      <ActionButton
                        endpoint="/api/ops/customers"
                        variant="secondary"
                        payload={{
                          action: 'setStatus',
                          customerId: alert.customer.id,
                          status: 'HOLD',
                        }}
                        confirm={`Put ${alert.customer.name} on hold until they pay?`}
                      >
                        Hold
                      </ActionButton>
                    ) : (
                      <Tag tone="warn">{alert.customer.status}</Tag>
                    )}
                  </div>
                ),
              },
            ]}
          />

          <div className="mt-3">
            <Note>
              Remind opens WhatsApp with the message ready — the channel these
              customers actually read. Hold pauses their washes without closing
              the account.
            </Note>
          </div>
        </>
      )}
    </>
  );
}
