import 'server-only';

import type { AccessScope } from '@/lib/auth/rbac';
import { getStore } from '@/lib/data';
import { loadRedAlerts } from '@/lib/services/accounts';
import { stockForAreas } from '@/lib/services/inventory';
import { todayISO } from '@/lib/util/format';
import type { NavCounts } from './nav';

interface CacheEntry {
  data: Promise<NavCounts>;
  expires: number;
}

const memoryCache: Map<string, CacheEntry> =
  ((globalThis as unknown as { __navCountsCache?: Map<string, CacheEntry> })
    .__navCountsCache ??= new Map());

/**
 * The badge numbers on the sidebar.
 *
 * Results are cached in memory for 60 s per area scope so navigating between pages
 * does not trigger redundant queries on every route change.
 */
export function navCounts(scope: AccessScope): Promise<NavCounts> {
  const areaKey = scope.areaIds
    ? scope.areaIds.slice().sort().join(',')
    : 'all';

  const now = Date.now();
  const cached = memoryCache.get(areaKey);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  const promise = _computeNavCounts(scope.areaIds).catch((err) => {
    memoryCache.delete(areaKey);
    throw err;
  });

  memoryCache.set(areaKey, {
    data: promise,
    expires: now + 60_000,
  });

  return promise;
}

async function _computeNavCounts(areaIds: string[] | null): Promise<NavCounts> {
  const store = await getStore();
  const areaFilter = areaIds ? { areaId: { in: areaIds } } : {};

  const resolvedAreaIdsPromise = areaIds
    ? Promise.resolve(areaIds)
    : store.areas.find().then((areas) => areas.map((a) => a.id));

  const [unassigned, alerts, complaints, purchases, staff, resolvedAreaIds] =
    await Promise.all([
      store.visits.count({
        scheduledDate: todayISO(),
        staffId: null,
        status: 'PENDING',
        ...areaFilter,
      } as never),
      loadRedAlerts(store, areaIds),
      store.complaints.count({
        status: { in: ['OPEN', 'ESCALATED'] },
        ...areaFilter,
      } as never),
      store.purchaseRequests.count({
        status: 'PENDING',
        ...areaFilter,
      } as never),
      areaIds
        ? store.staff.find({ where: { role: 'EMPLOYEE', ...areaFilter } as never })
        : Promise.resolve(null),
      resolvedAreaIdsPromise,
    ]);

  const [stockMap, pocketRequests] = await Promise.all([
    stockForAreas(store, resolvedAreaIds),
    areaIds && staff
      ? staff.length
        ? store.pocketRequests.count({
            status: 'PENDING',
            staffId: { in: staff.map((s) => s.id) },
          } as never)
        : Promise.resolve(0)
      : store.pocketRequests.count({ status: 'PENDING' } as never),
  ]);
  const lowStock = [...stockMap.values()]
    .flat()
    .filter((row) => row.status !== 'OK').length;

  return {
    unassigned,
    redAlerts: alerts.length,
    openComplaints: complaints,
    pocketRequests,
    lowStock,
    pendingPurchases: purchases,
  };
}
