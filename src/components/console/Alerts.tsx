import Link from 'next/link';
import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Card,
  EmptyState,
  Note,
  Tag,
} from '@/components/ui/primitives';
import { DataTable } from '@/components/ui/DataTable';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { Filters, PageSizeSelect } from './Filters';
import { IconMapPin, IconSliders } from '@/components/shell/icons';
import type { Session } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { loadRedAlerts } from '@/lib/services/accounts';
import { formatDateFull, money } from '@/lib/util/format';
import { ActionButton } from './ActionButton';

/** The chase list — who owes what, worst first. */
export async function ConsoleAlerts({
  session,
  base,
  searchParams = {},
}: {
  session: Session;
  base: string;
  searchParams?: Record<string, string | undefined>;
}) {
  const store = await getStore();
  const [alerts, areas] = await Promise.all([
    loadRedAlerts(store, session.scope.areaIds),
    store.areas.find(),
  ]);
  const areaById = new Map(areas.map((a) => [a.id, a]));

  const total = alerts.reduce((sum, a) => sum + a.amount, 0);
  const severe = alerts.filter((a) => a.daysOverdue > 14);

  // Dynamic filter options
  const areasInUse = new Set(alerts.map((a) => a.customer.areaId).filter(Boolean));
  const areaOptions = areas
    .filter((a) => areasInUse.has(a.id))
    .map((a) => ({ value: a.id, label: a.name }));

  const severityOptions = [
    { value: 'OVER14', label: 'Over 14 days (Critical)' },
    { value: 'UNDER14', label: 'Under 14 days' },
    { value: 'HOLD', label: 'On hold' },
  ];

  // Filtering
  const rawQuery = (searchParams.q ?? '').trim().toLowerCase();
  let query = rawQuery;
  try {
    query = decodeURIComponent(rawQuery);
  } catch {
    // fallback
  }

  const filtered = alerts.filter((item) => {
    if (searchParams.area && item.customer.areaId !== searchParams.area) return false;

    if (searchParams.severity) {
      if (searchParams.severity === 'OVER14' && item.daysOverdue <= 14) return false;
      if (searchParams.severity === 'UNDER14' && item.daysOverdue > 14) return false;
      if (searchParams.severity === 'HOLD' && item.customer.status !== 'HOLD') return false;
    }

    if (query || rawQuery) {
      const areaName = areaById.get(item.customer.areaId)?.name ?? '';
      const haystack = [
        item.customer.name,
        item.customer.phone,
        item.customer.altPhone ?? '',
        item.customer.address,
        areaName,
        item.reason,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query) && !haystack.includes(rawQuery)) return false;
    }

    return true;
  });

  // Pagination
  const pageSize = Math.min(100, Math.max(5, Number(searchParams.limit ?? 20) || 20));
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const buildPageUrl = (targetPage: number) => {
    const params = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(searchParams).filter(([, v]) => v !== undefined && v !== ''),
      ),
      page: String(targetPage),
    } as Record<string, string>);
    return `?${params.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Red alerts"
        description="Customers the system has flagged for payment"
      />

      <div className="my-4">
        <StatGrid columns={4}>
          <StatCard
            label="ACCOUNTS FLAGGED"
            value={alerts.length}
            tone={alerts.length ? 'rose' : 'emerald'}
            subtext={alerts.length ? 'Need payment follow-up' : 'All accounts clean'}
          />
          <StatCard
            label="OUTSTANDING"
            value={money(total)}
            tone={total ? 'amber' : 'emerald'}
            subtext="Total overdue balance"
          />
          <StatCard
            label="OVER 14 DAYS"
            value={severe.length}
            tone={severe.length ? 'rose' : 'slate'}
            subtext="Critical payment delay"
          />
          <StatCard
            label="LONGEST OVERDUE"
            value={alerts.length ? `${alerts[0].daysOverdue} days` : '—'}
            tone={alerts.length ? 'rose' : 'slate'}
            subtext="Oldest unpaid account"
          />
        </StatGrid>
      </div>

      {alerts.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Nobody to chase"
            hint="Every customer in your area is paid up to date."
          />
        </div>
      ) : (
        <>
          <Card tone="danger" accent="danger" className="mb-4 mt-2 p-4">
            <h3 className="text-sm font-semibold text-rose-950">
              {alerts.length} customers owe {money(total)}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-rose-900/80 leading-relaxed">
              These are flagged automatically when an invoice passes its due
              date or an advance runs out with no payment received.
            </p>
          </Card>

          {/* Filter Bar with Debounced Search */}
          <div className="mb-4">
            <Filters
              search={{ name: 'q', placeholder: 'Search by customer name, phone, or area...' }}
              filters={[
                {
                  name: 'severity',
                  label: 'Urgency — all',
                  icon: <IconSliders width={13} height={13} />,
                  options: severityOptions,
                },
                ...(areaOptions.length > 1
                  ? [
                      {
                        name: 'area',
                        label: 'Area — all',
                        icon: <IconMapPin width={13} height={13} />,
                        options: areaOptions,
                      },
                    ]
                  : []),
              ]}
            />
          </div>

          <DataTable<Awaited<ReturnType<typeof loadRedAlerts>>[number]>
            data={pageRows}
            keyExtractor={(a) => a.customer.id}
            itemLabel="alerts"
            page={page}
            pageSize={pageSize}
            totalItems={filtered.length}
            buildPageUrl={buildPageUrl}
            pageSizeElement={<PageSizeSelect value={pageSize} />}
            emptyMessage="No flagged accounts match these filters."
            columns={[
              {
                id: 'customer',
                header: 'CUSTOMER',
                render: (alert) => (
                  <div>
                    <Link
                      href={`${base}/customers/${alert.customer.id}`}
                      className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
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
                className: 'font-semibold text-slate-900',
                render: (alert) => money(alert.amount),
              },
              {
                id: 'days',
                header: 'DAYS',
                render: (alert) => (
                  <span className={alert.daysOverdue > 14 ? 'font-bold text-rose-600' : 'font-medium text-slate-700'}>
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
                      className="inline-flex items-center rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 transition-colors shadow-2xs"
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
