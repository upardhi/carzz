import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Card,
  CardHeading,
  Kpi,
  KpiGrid,
  Note,
  Tag,
} from '@/components/ui/primitives';
import { DataTable } from '@/components/ui/DataTable';
import { WidgetTable } from '@/components/ui/WidgetTable';
import { ActionButton } from '@/components/console/ActionButton';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { consumptionByArea, stockForAreas } from '@/lib/services/inventory';
import { currentCycle, formatDateFull, money, relativeDays } from '@/lib/util/format';

export const metadata = { title: 'Inventory' };

export default async function AdminInventory() {
  await requirePermission('purchase:approve');
  const store = await getStore();
  const cycle = currentCycle();

  const [areas, items, requests, consumption] = await Promise.all([
    store.areas.find({ orderBy: [{ field: 'name' }] }),
    store.inventoryItems.find(),
    store.purchaseRequests.find({
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
    }),
    consumptionByArea(store, cycle, null),
  ]);

  const areaIds = areas.map((a) => a.id);
  const stockMap = await stockForAreas(store, areaIds);
  const stock = areas.map((area) => ({ area, rows: stockMap.get(area.id) ?? [] }));

  const itemById = new Map(items.map((i) => [i.id, i]));
  const areaById = new Map(areas.map((a) => [a.id, a]));

  const pending = requests.filter((r) => r.status === 'PENDING');
  const allRows = stock.flatMap((s) => s.rows.map((r) => ({ ...r, area: s.area })));
  const stockValue = allRows.reduce((sum, r) => sum + r.value, 0);
  const areasLow = stock.filter((s) =>
    s.rows.some((r) => r.status !== 'OK'),
  ).length;

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
      <PageHeader
        title="Inventory"
        description="Nothing is bought until you approve it"
      />

      <KpiGrid>
        <Kpi label="Stock value" value={money(stockValue)} />
        <Kpi
          label="Awaiting you"
          value={pending.length}
          tone={pending.length ? 'danger' : 'success'}
        />
        <Kpi
          label="On order"
          value={money(
            requests
              .filter((r) => r.status === 'APPROVED')
              .reduce((s, r) => s + r.estimatedCost, 0),
          )}
        />
        <Kpi label="Areas low" value={areasLow} tone={areasLow ? 'gold' : 'default'} />
        <Kpi
          label="Out of stock"
          value={allRows.filter((r) => r.status === 'OUT').length}
          tone="danger"
        />
        <Kpi
          label="Cost per wash"
          value={
            consumption.length
              ? `₹${(
                  consumption.reduce((s, c) => s + c.goodsCost, 0) /
                  Math.max(1, consumption.reduce((s, c) => s + c.washes, 0))
                ).toFixed(2)}`
              : '—'
          }
        />
      </KpiGrid>

      {pending.length > 0 ? (
        <Card accent="danger" className="mt-4 p-4">
          <h3 className="text-sm font-extrabold">
            {pending.length} purchase{' '}
            {pending.length === 1 ? 'request' : 'requests'} waiting —{' '}
            {money(pending.reduce((s, r) => s + r.estimatedCost, 0))}
          </h3>
          <p className="mt-1 text-sm text-ink-mute">
            Your managers cannot buy directly. Approving here notifies the
            vendor and puts the goods on order.
          </p>
        </Card>
      ) : null}

      <div className="mt-4">
        <DataTable<(typeof requests)[number]>
          data={requests.slice(0, 20)}
          keyExtractor={(request) => request.id}
          itemLabel="purchase requests"
          emptyMessage="No purchase requests yet."
          columns={[
            {
              id: 'request',
              header: 'REQUEST',
              className: 'font-bold text-navy-950',
              render: (request) => request.code,
            },
            {
              id: 'area',
              header: 'AREA',
              render: (request) => areaById.get(request.areaId)?.name ?? '—',
            },
            {
              id: 'item',
              header: 'ITEM',
              render: (request) => itemById.get(request.itemId)?.name ?? '—',
            },
            {
              id: 'quantity',
              header: 'QUANTITY',
              render: (request) => {
                const item = itemById.get(request.itemId);
                return `${request.quantity} ${item?.unit ?? ''}`;
              },
            },
            {
              id: 'cost',
              header: 'COST',
              className: 'font-bold text-slate-900',
              render: (request) => money(request.estimatedCost),
            },
            {
              id: 'neededBy',
              header: 'NEEDED BY',
              render: (request) => {
                const urgent =
                  new Date(`${request.neededBy}T00:00:00Z`).getTime() - Date.now() <
                  3 * 86400000;
                return (
                  <span
                    className={
                      urgent && request.status === 'PENDING'
                        ? 'font-bold text-rose-600'
                        : 'text-slate-700'
                    }
                  >
                    {formatDateFull(request.neededBy)}
                    <span className="ml-1 text-[11px] text-slate-400">
                      {relativeDays(request.neededBy)}
                    </span>
                  </span>
                );
              },
            },
            {
              id: 'status',
              header: 'STATUS',
              render: (request) => (
                <Tag
                  tone={
                    request.status === 'PENDING'
                      ? 'warn'
                      : request.status === 'APPROVED'
                        ? 'ok'
                        : request.status === 'RECEIVED'
                          ? 'neutral'
                          : 'bad'
                  }
                >
                  {request.status === 'PENDING' ? 'Awaiting you' : request.status}
                </Tag>
              ),
            },
            {
              id: 'action',
              header: 'ACTION',
              render: (request) =>
                request.status === 'PENDING' ? (
                  <div className="flex gap-1.5">
                    <ActionButton
                      endpoint="/api/ops/inventory"
                      payload={{
                        action: 'decide',
                        requestId: request.id,
                        decision: 'APPROVED',
                      }}
                    >
                      Approve
                    </ActionButton>
                    <ActionButton
                      endpoint="/api/ops/inventory"
                      variant="secondary"
                      payload={{
                        action: 'decide',
                        requestId: request.id,
                        decision: 'REJECTED',
                      }}
                    >
                      Reject
                    </ActionButton>
                  </div>
                ) : (
                  <span className="text-ink-faint">—</span>
                ),
            },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <WidgetTable<(typeof items)[number]>
          title="Stock across every area"
          data={items}
          keyExtractor={(item) => item.id}
          emptyMessage="No items found."
          columns={[
            {
              id: 'item',
              header: 'ITEM',
              className: 'font-bold text-navy-950',
              render: (item) => item.name,
            },
            ...areas.map((area) => ({
              id: area.id,
              header: area.name.toUpperCase(),
              render: (item: (typeof items)[number]) => {
                const s = stock.find((st) => st.area.id === area.id);
                const row = s?.rows.find((r) => r.item.id === item.id) ?? null;
                return (
                  <span
                    className={
                      row && row.status !== 'OK'
                        ? 'font-bold text-rose-600'
                        : 'text-slate-700'
                    }
                  >
                    {row ? `${row.quantity} ${item.unit}` : '—'}
                  </span>
                );
              },
            })),
            {
              id: 'total',
              header: 'TOTAL',
              align: 'right',
              className: 'font-bold text-slate-900',
              render: (item) => {
                const total = stock.reduce((sum, s) => {
                  const r = s.rows.find((row) => row.item.id === item.id);
                  return sum + (r?.quantity ?? 0);
                }, 0);
                return `${total} ${item.unit}`;
              },
            },
          ]}
        />

        <div className="flex flex-col justify-between">
          <WidgetTable<(typeof consumption)[number]>
            title="Consumption per wash by area"
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
            <div className="mt-3">
              <Note tone="danger">
                <b>
                  {worstPerWash.areaName} uses{' '}
                  {Math.round(
                    ((worstPerWash.perWash - bestPerWash.perWash) /
                      bestPerWash.perWash) *
                      100,
                  )}
                  % more per wash than {bestPerWash.areaName}
                </b>{' '}
                on the same packages. Worth asking that manager why before the
                next order.
              </Note>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
