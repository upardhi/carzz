import 'server-only';

import type { DataStore } from '../data/ports/store';
import type { Id, InventoryItem, Rupees, StockLevel } from '../data/types';

export interface StockRow {
  item: InventoryItem;
  level: StockLevel | null;
  quantity: number;
  usagePerDay: number;
  daysLeft: number | null;
  status: 'OK' | 'LOW' | 'CRITICAL' | 'OUT';
  value: Rupees;
}

/**
 * Bulk stock computation for multiple areas.
 * Avoids N+1 query loops across areas by fetching active items, stock levels,
 * and recent visits in 3 bulk queries.
 */
export async function stockForAreas(
  store: DataStore,
  areaIds: Id[],
  lookbackDays = 14,
): Promise<Map<Id, StockRow[]>> {
  if (areaIds.length === 0) return new Map();

  const since = new Date(Date.now() - lookbackDays * 86400000)
    .toISOString()
    .slice(0, 10);

  const [items, levels, ...areaVisitCounts] = await Promise.all([
    store.inventoryItems.find({ where: { active: true } }),
    store.stockLevels.find({ where: { areaId: { in: areaIds } } as never }),
    ...areaIds.map((areaId) =>
      store.visits
        .count({
          areaId,
          status: 'DONE',
          scheduledDate: { gte: since },
        } as never)
        .then((count) => [areaId, count] as const),
    ),
  ]);

  const visitsByArea = new Map<Id, number>(areaVisitCounts);

  // Group stock levels by area -> item
  const levelsByArea = new Map<Id, Map<Id, StockLevel>>();
  for (const l of levels) {
    let itemMap = levelsByArea.get(l.areaId);
    if (!itemMap) {
      itemMap = new Map<Id, StockLevel>();
      levelsByArea.set(l.areaId, itemMap);
    }
    itemMap.set(l.itemId, l);
  }

  const order = { OUT: 0, CRITICAL: 1, LOW: 2, OK: 3 };
  const out = new Map<Id, StockRow[]>();

  for (const areaId of areaIds) {
    const visitsCount = visitsByArea.get(areaId) ?? 0;
    const washesPerDay = visitsCount / lookbackDays;
    const levelByItem = levelsByArea.get(areaId) ?? new Map<Id, StockLevel>();

    const rows: StockRow[] = items
      .map((item) => {
        const level = levelByItem.get(item.id) ?? null;
        const quantity = level?.quantity ?? 0;
        const usagePerDay = item.usagePerWash * washesPerDay;
        const daysLeft = usagePerDay > 0 ? quantity / usagePerDay : null;

        let status: StockRow['status'] = 'OK';
        if (quantity <= 0) status = 'OUT';
        else if (daysLeft !== null && daysLeft < 2) status = 'CRITICAL';
        else if (quantity <= item.reorderLevel) status = 'LOW';

        return {
          item,
          level,
          quantity,
          usagePerDay,
          daysLeft,
          status,
          value: Math.round(quantity * item.unitCost),
        };
      })
      .sort((a, b) => order[a.status] - order[b.status]);

    out.set(areaId, rows);
  }

  return out;
}

/**
 * Stock for an area with days-of-cover projected from that area's real wash
 * volume — not a flat reorder point.
 */
export async function stockForArea(
  store: DataStore,
  areaId: Id,
  lookbackDays = 14,
): Promise<StockRow[]> {
  const map = await stockForAreas(store, [areaId], lookbackDays);
  return map.get(areaId) ?? [];
}

/**
 * Records goods handed to a wash boy and takes them off the area's stock, so
 * consumption per wash is measured rather than estimated — that number is what
 * exposes an area over-pouring or losing stock.
 */
export async function issueStock(
  store: DataStore,
  input: {
    areaId: Id;
    itemId: Id;
    staffId: Id;
    quantity: number;
    issuedByUserId: Id;
  },
): Promise<void> {
  if (input.quantity <= 0) throw new Error('Quantity must be more than zero');

  const level = await store.stockLevels.findOne({
    where: { areaId: input.areaId, itemId: input.itemId },
  });

  // Named field by field rather than spread: callers pass their whole request
  // body in, and an extra key reaches the database as an unknown column.
  await store.stockIssues.create({
    areaId: input.areaId,
    itemId: input.itemId,
    staffId: input.staffId,
    quantity: input.quantity,
    issuedByUserId: input.issuedByUserId,
    createdAt: new Date().toISOString(),
  });

  if (level) {
    await store.stockLevels.update(level.id, {
      // Never let a level go negative: a mis-keyed issue should read as empty,
      // not as a phantom debt that skews the next reorder calculation.
      quantity: Math.max(0, level.quantity - input.quantity),
      updatedAt: new Date().toISOString(),
    });
  }
}

/** Receiving an approved purchase request puts the goods back on the shelf. */
export async function receivePurchase(
  store: DataStore,
  requestId: Id,
): Promise<void> {
  const request = await store.purchaseRequests.get(requestId);
  if (!request) throw new Error('Purchase request not found');
  if (request.status !== 'APPROVED') {
    throw new Error('Only an approved request can be received.');
  }

  const level = await store.stockLevels.findOne({
    where: { areaId: request.areaId, itemId: request.itemId },
  });

  if (level) {
    await store.stockLevels.update(level.id, {
      quantity: level.quantity + request.quantity,
      updatedAt: new Date().toISOString(),
    });
  } else {
    await store.stockLevels.create({
      areaId: request.areaId,
      itemId: request.itemId,
      quantity: request.quantity,
      updatedAt: new Date().toISOString(),
    });
  }

  await store.purchaseRequests.update(requestId, { status: 'RECEIVED' });
}

type ConsumptionResult = { areaId: Id; areaName: string; washes: number; goodsCost: Rupees; perWash: number }[];

interface ConsumptionCacheEntry {
  data: Promise<ConsumptionResult>;
  expires: number;
}
const consumptionCache: Map<string, ConsumptionCacheEntry> =
  ((globalThis as unknown as { __consumptionCache?: Map<string, ConsumptionCacheEntry> })
    .__consumptionCache ??= new Map());

/** Consumables cost per wash, by area — the over-pouring detector. */
export function consumptionByArea(
  store: DataStore,
  cycle: string,
  areaIds: Id[] | null,
): Promise<ConsumptionResult> {
  const cacheKey = `${cycle}:${areaIds ? areaIds.slice().sort().join(',') : 'all'}`;
  const now = Date.now();
  const cached = consumptionCache.get(cacheKey);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  const promise = _computeConsumptionByArea(store, cycle, areaIds).catch((err) => {
    consumptionCache.delete(cacheKey);
    throw err;
  });

  consumptionCache.set(cacheKey, {
    data: promise,
    expires: now + 60_000,
  });

  return promise;
}

async function _computeConsumptionByArea(
  store: DataStore,
  cycle: string,
  areaIds: Id[] | null,
): Promise<ConsumptionResult> {
  const [areas, items] = await Promise.all([
    store.areas.find(),
    store.inventoryItems.find(),
  ]);
  const cost = new Map(items.map((i) => [i.id, i.unitCost]));

  const scoped = areas.filter((a) => areaIds === null || areaIds.includes(a.id));
  if (scoped.length === 0) return [];

  const scopedAreaIds = scoped.map((a) => a.id);
  const areaFilter = areaIds ? { areaId: { in: scopedAreaIds } } : {};

  // Bulk queries for all areas in this cycle
  const [areaVisitCounts, allStockIssues] = await Promise.all([
    Promise.all(
      scopedAreaIds.map((areaId) =>
        store.visits
          .count({
            cycle,
            status: 'DONE',
            areaId,
          } as never)
          .then((count) => [areaId, count] as const),
      ),
    ),
    store.stockIssues.find({ where: areaFilter as never }),
  ]);

  const visitsByArea = new Map<Id, number>(areaVisitCounts);

  const issuesByArea = new Map<Id, typeof allStockIssues>();
  for (const issue of allStockIssues) {
    const list = issuesByArea.get(issue.areaId) ?? [];
    list.push(issue);
    issuesByArea.set(issue.areaId, list);
  }

  return scoped.map((area) => {
    const washes = visitsByArea.get(area.id) ?? 0;
    const issues = issuesByArea.get(area.id) ?? [];
    const goodsCost = issues.reduce(
      (sum, i) => sum + i.quantity * (cost.get(i.itemId) ?? 0),
      0,
    );

    return {
      areaId: area.id,
      areaName: area.name,
      washes,
      goodsCost: Math.round(goodsCost),
      perWash: washes ? goodsCost / washes : 0,
    };
  });
}
