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
 * Stock for an area with days-of-cover projected from that area's real wash
 * volume — not a flat reorder point. An area running 70 cars a day burns
 * shampoo far faster than one running 30, and the reorder alert has to know it.
 */
export async function stockForArea(
  store: DataStore,
  areaId: Id,
  lookbackDays = 14,
): Promise<StockRow[]> {
  const since = new Date(Date.now() - lookbackDays * 86400000)
    .toISOString()
    .slice(0, 10);

  const [items, levels, recentVisits] = await Promise.all([
    store.inventoryItems.find({ where: { active: true } }),
    store.stockLevels.find({ where: { areaId } }),
    store.visits.find({
      where: {
        areaId,
        status: 'DONE',
        scheduledDate: { gte: since },
      } as never,
    }),
  ]);

  const washesPerDay = recentVisits.length / lookbackDays;
  const levelByItem = new Map(levels.map((l) => [l.itemId, l]));

  return items
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
    .sort((a, b) => {
      const order = { OUT: 0, CRITICAL: 1, LOW: 2, OK: 3 };
      return order[a.status] - order[b.status];
    });
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

  await store.stockIssues.create({
    ...input,
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

/** Consumables cost per wash, by area — the over-pouring detector. */
export async function consumptionByArea(
  store: DataStore,
  cycle: string,
  areaIds: Id[] | null,
): Promise<
  { areaId: Id; areaName: string; washes: number; goodsCost: Rupees; perWash: number }[]
> {
  const [areas, items] = await Promise.all([
    store.areas.find(),
    store.inventoryItems.find(),
  ]);
  const cost = new Map(items.map((i) => [i.id, i.unitCost]));

  const scoped = areas.filter((a) => areaIds === null || areaIds.includes(a.id));

  return Promise.all(
    scoped.map(async (area) => {
      const [visits, issues] = await Promise.all([
        store.visits.find({ where: { areaId: area.id, cycle, status: 'DONE' } }),
        store.stockIssues.find({ where: { areaId: area.id } }),
      ]);

      const goodsCost = issues.reduce(
        (sum, i) => sum + i.quantity * (cost.get(i.itemId) ?? 0),
        0,
      );

      return {
        areaId: area.id,
        areaName: area.name,
        washes: visits.length,
        goodsCost: Math.round(goodsCost),
        perWash: visits.length ? goodsCost / visits.length : 0,
      };
    }),
  );
}
