import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Card,
  CardHeading,
  Kpi,
  KpiGrid,
  Note,
  Tag,
} from '@/components/ui/primitives';
import { scopeAreaFilter, can } from '@/lib/auth/rbac';
import type { Session } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { stockForAreas } from '@/lib/services/inventory';
import { formatDateFull, money } from '@/lib/util/format';
import { ActionButton } from '@/components/console/ActionButton';
import { InventoryClient } from '@/components/console/InventoryClient';
import { IssueStockForm, PurchaseRequestForm } from '@/components/console/InventoryForms';

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

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Stock, usage and purchase requests"
      />

      <KpiGrid columns={6}>
        <Kpi
          label="ITEMS TRACKED"
          value={items.length}
          tone="blue"
          subtext="Active inventory catalog"
        />
        <Kpi
          label="OUT OF STOCK"
          value={allRows.filter((r) => r.status === 'OUT').length}
          tone="rose"
          subtext={
            allRows.filter((r) => r.status === 'OUT').length > 0
              ? 'Replenish immediately'
              : 'All items stocked'
          }
        />
        <Kpi
          label="ORDER NOW"
          value={allRows.filter((r) => r.status === 'CRITICAL').length}
          tone="rose"
          subtext="Below safety stock"
        />
        <Kpi
          label="LOW STOCK"
          value={allRows.filter((r) => r.status === 'LOW').length}
          tone="amber"
          subtext="Approaching reorder point"
        />
        <Kpi
          label="STOCK VALUE"
          value={money(allRows.reduce((sum, r) => sum + r.value, 0))}
          tone="purple"
          subtext="Total assets on hand"
        />
        <Kpi
          label="OPEN REQUESTS"
          value={requests.filter((r) => r.status === 'PENDING').length}
          tone="amber"
          subtext="Awaiting purchase review"
        />
      </KpiGrid>

      <div className="mt-6">
        <InventoryClient
          stockByArea={stockByArea}
          items={items}
          areas={areas}
          staff={staff}
          requests={requests}
          canApprovePurchase={can(session.user.role, 'purchase:approve')}
        />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
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
