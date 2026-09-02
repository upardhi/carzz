import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Card,
  CardHeading,
  Kpi,
  KpiGrid,
  Note,
  Table,
  TableWrap,
  Tag,
  Td,
  Th,
} from '@/components/ui/primitives';
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
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Request</Th>
                <Th>Area</Th>
                <Th>Item</Th>
                <Th>Quantity</Th>
                <Th>Cost</Th>
                <Th>Needed by</Th>
                <Th>Status</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {requests.slice(0, 20).map((request) => {
                const item = itemById.get(request.itemId);
                const urgent =
                  new Date(`${request.neededBy}T00:00:00Z`).getTime() -
                    Date.now() <
                  3 * 86400000;

                return (
                  <tr key={request.id}>
                    <Td className="font-bold">{request.code}</Td>
                    <Td>{areaById.get(request.areaId)?.name ?? '—'}</Td>
                    <Td>{item?.name ?? '—'}</Td>
                    <Td>
                      {request.quantity} {item?.unit}
                    </Td>
                    <Td className="font-bold">{money(request.estimatedCost)}</Td>
                    <Td
                      className={
                        urgent && request.status === 'PENDING'
                          ? 'font-bold text-danger-500'
                          : ''
                      }
                    >
                      {formatDateFull(request.neededBy)}
                      <span className="ml-1 text-[11px] text-ink-faint">
                        {relativeDays(request.neededBy)}
                      </span>
                    </Td>
                    <Td>
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
                    </Td>
                    <Td>
                      {request.status === 'PENDING' ? (
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
                      )}
                    </Td>
                  </tr>
                );
              })}
              {requests.length === 0 ? (
                <tr>
                  <Td className="py-8 text-center text-ink-mute" colSpan={8}>
                    No purchase requests yet.
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </TableWrap>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <CardHeading>Stock across every area</CardHeading>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Item</Th>
                  {areas.map((area) => (
                    <Th key={area.id}>{area.name}</Th>
                  ))}
                  <Th>Total</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const perArea = stock.map(
                    (s) => s.rows.find((r) => r.item.id === item.id) ?? null,
                  );
                  const total = perArea.reduce((sum, r) => sum + (r?.quantity ?? 0), 0);
                  return (
                    <tr key={item.id}>
                      <Td className="font-bold">{item.name}</Td>
                      {perArea.map((row, index) => (
                        <Td
                          key={areas[index].id}
                          className={
                            row && row.status !== 'OK'
                              ? 'font-bold text-danger-500'
                              : ''
                          }
                        >
                          {row ? `${row.quantity} ${item.unit}` : '—'}
                        </Td>
                      ))}
                      <Td className="font-bold">
                        {total} {item.unit}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card className="p-4">
          <CardHeading>Consumption per wash by area</CardHeading>
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
        </Card>
      </div>
    </>
  );
}
