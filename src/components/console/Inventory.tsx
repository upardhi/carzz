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
import { scopeAreaFilter } from '@/lib/auth/rbac';
import type { Session } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { stockForAreas, type StockRow } from '@/lib/services/inventory';
import { formatDateFull, money } from '@/lib/util/format';
import { ActionButton } from './ActionButton';
import { IssueStockForm, PurchaseRequestForm } from './InventoryForms';

const STATUS_TONE = {
  OUT: 'bad',
  CRITICAL: 'bad',
  LOW: 'warn',
  OK: 'ok',
} as const;

const STATUS_LABEL = {
  OUT: 'Out of stock',
  CRITICAL: 'Order now',
  LOW: 'Low',
  OK: 'OK',
} as const;

export async function ConsoleInventory({ session }: { session: Session }) {
  const store = await getStore();
  const areaFilter = scopeAreaFilter(session.scope);

  const areas = (await store.areas.find({ orderBy: [{ field: 'name' }] })).filter(
    (a) => session.scope.areaIds === null || session.scope.areaIds.includes(a.id),
  );

  const areaIds = areas.map((a) => a.id);
  const [stockMap, items, staff, requests] = await Promise.all([
    stockForAreas(store, areaIds),
    store.inventoryItems.find({ where: { active: true } }),
    store.staff.find({ where: { role: 'EMPLOYEE', active: true, ...areaFilter } as never }),
    store.purchaseRequests.find({
      where: areaFilter as never,
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
    }),
  ]);

  const stockByArea = areas.map((area) => ({
    area,
    rows: stockMap.get(area.id) ?? [],
  }));

  const itemById = new Map(items.map((i) => [i.id, i]));
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const allRows = stockByArea.flatMap((s) => s.rows);
  const urgent = allRows.filter((r) => r.status === 'OUT' || r.status === 'CRITICAL');

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock, usage and purchase requests"
      />

      <KpiGrid>
        <Kpi label="Items tracked" value={items.length} />
        <Kpi
          label="Out of stock"
          value={allRows.filter((r) => r.status === 'OUT').length}
          tone="danger"
        />
        <Kpi
          label="Order now"
          value={allRows.filter((r) => r.status === 'CRITICAL').length}
          tone="danger"
        />
        <Kpi
          label="Low"
          value={allRows.filter((r) => r.status === 'LOW').length}
          tone="gold"
        />
        <Kpi
          label="Stock value"
          value={money(allRows.reduce((sum, r) => sum + r.value, 0))}
        />
        <Kpi
          label="Open requests"
          value={requests.filter((r) => r.status === 'PENDING').length}
          tone="gold"
        />
      </KpiGrid>

      {urgent.length > 0 ? (
        <Card tone="danger" accent="danger" className="mt-4 p-4">
          <h3 className="text-sm font-extrabold">
            {urgent.length} {urgent.length === 1 ? 'item' : 'items'} will run out
            before a normal delivery arrives
          </h3>
          <p className="mt-1 text-sm text-ink-mute">
            Days of cover are worked out from this area&rsquo;s real wash volume,
            not a flat reorder level — a busy area burns stock faster.
          </p>
        </Card>
      ) : null}

      {stockByArea.map(({ area, rows }) => (
        <div key={area.id} className="mt-6 space-y-2">
          <h3 className="text-base font-extrabold text-navy-950">{area.name}</h3>
          <DataTable<StockRow>
            data={rows}
            keyExtractor={(row) => row.item.id}
            itemLabel="items"
            emptyMessage={`No inventory items recorded for ${area.name}.`}
            columns={[
              {
                id: 'item',
                header: 'ITEM',
                className: 'font-bold text-navy-950',
                render: (row) => row.item.name,
              },
              {
                id: 'inStock',
                header: 'IN STOCK',
                render: (row) => (
                  <span
                    className={
                      row.status === 'OUT' || row.status === 'CRITICAL'
                        ? 'font-bold text-rose-600'
                        : 'text-slate-700'
                    }
                  >
                    {row.quantity} {row.item.unit}
                  </span>
                ),
              },
              {
                id: 'usage',
                header: 'USED PER DAY',
                render: (row) =>
                  row.usagePerDay > 0
                    ? `${row.usagePerDay.toFixed(2)} ${row.item.unit}`
                    : '—',
              },
              {
                id: 'daysLeft',
                header: 'DAYS LEFT',
                render: (row) => (
                  <span
                    className={
                      row.daysLeft !== null && row.daysLeft < 2
                        ? 'font-extrabold text-rose-600'
                        : 'text-slate-700'
                    }
                  >
                    {row.daysLeft !== null ? row.daysLeft.toFixed(1) : '—'}
                  </span>
                ),
              },
              {
                id: 'reorder',
                header: 'REORDER AT',
                render: (row) => `${row.item.reorderLevel} ${row.item.unit}`,
              },
              {
                id: 'status',
                header: 'STATUS',
                render: (row) => (
                  <Tag tone={STATUS_TONE[row.status]}>
                    {STATUS_LABEL[row.status]}
                  </Tag>
                ),
              },
            ]}
          />
        </div>
      ))}

      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="p-4">
          <CardHeading>Purchase requests</CardHeading>
          {requests.slice(0, 6).map((request) => (
            <div
              key={request.id}
              className="mb-2 rounded-lg border border-line bg-white p-3 last:mb-0"
            >
              <div className="flex items-center justify-between gap-2">
                <b className="text-sm">
                  {request.code} — {itemById.get(request.itemId)?.name}
                </b>
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
                  {request.status === 'PENDING' ? 'Awaiting owner' : request.status}
                </Tag>
              </div>
              <p className="mt-1 text-xs text-ink-mute">
                {request.quantity} {itemById.get(request.itemId)?.unit} ·{' '}
                {money(request.estimatedCost)} · {areaById.get(request.areaId)?.name} ·
                needed by {formatDateFull(request.neededBy)}
              </p>
              {request.status === 'APPROVED' ? (
                <div className="mt-2">
                  <ActionButton
                    endpoint="/api/ops/inventory"
                    payload={{ action: 'receive', requestId: request.id }}
                  >
                    Mark received
                  </ActionButton>
                </div>
              ) : null}
            </div>
          ))}
          {requests.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-mute">
              No purchase requests yet.
            </p>
          ) : null}
        </Card>

        <Card className="p-4">
          <CardHeading>Raise a purchase request</CardHeading>
          <PurchaseRequestForm
            areas={areas.map((a) => ({ id: a.id, name: a.name }))}
            items={items.map((i) => ({ id: i.id, name: i.name, unit: i.unit }))}
          />
          <div className="mt-3">
            <Note tone="brand">
              You cannot buy directly. The owner approves every purchase, so
              stock cost stays under his control.
            </Note>
          </div>
        </Card>

        <Card className="p-4">
          <CardHeading>Issue goods to a wash boy</CardHeading>
          <IssueStockForm
            areas={areas.map((a) => ({ id: a.id, name: a.name }))}
            items={items.map((i) => ({ id: i.id, name: i.name, unit: i.unit }))}
            staff={staff.map((s) => ({ id: s.id, name: s.name, areaId: s.areaId }))}
          />
          <div className="mt-3">
            <Note>
              Recording issues is what makes consumption per wash measurable —
              the number that shows whether an area is over-pouring.
            </Note>
          </div>
        </Card>
      </div>
    </>
  );
}
