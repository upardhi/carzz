import 'server-only';

import { unstable_cache } from 'next/cache';
import type { AccessScope } from '@/lib/auth/rbac';
import { getStore } from '@/lib/data';
import { loadRedAlerts } from '@/lib/services/accounts';
import { stockForArea } from '@/lib/services/inventory';
import { todayISO } from '@/lib/util/format';
import type { NavCounts } from './nav';

/**
 * The badge numbers on the sidebar.
 *
 * Results are cached for 60 s per area scope so navigating between pages
 * does not trigger the N+1 query avalanche on every route change.
 */
export function navCounts(scope: AccessScope): Promise<NavCounts> {
  // Build a stable, sorted string key so area [A, B] and [B, A] share a cache
  // entry. A null scope means "all areas".
  const areaKey = scope.areaIds
    ? scope.areaIds.slice().sort().join(',')
    : 'all';

  return unstable_cache(
    () => _computeNavCounts(scope.areaIds),
    ['nav-counts', areaKey],
    { revalidate: 60 },
  )();
}

async function _computeNavCounts(areaIds: string[] | null): Promise<NavCounts> {
  const store = await getStore();
  const areaFilter = areaIds ? { areaId: { in: areaIds } } : {};

  const [todayVisits, alerts, complaints, staff, purchases] = await Promise.all(
    [
      store.visits.find({
        where: { scheduledDate: todayISO(), ...areaFilter } as never,
      }),
      loadRedAlerts(store, areaIds),
      store.complaints.count({
        status: { in: ['OPEN', 'ESCALATED'] },
        ...areaFilter,
      } as never),
      store.staff.find({ where: { role: 'EMPLOYEE', ...areaFilter } as never }),
      store.purchaseRequests.count({
        status: 'PENDING',
        ...areaFilter,
      } as never),
    ],
  );

  const staffIds = new Set(staff.map((s) => s.id));
  const pocketRequests = (
    await store.pocketRequests.find({ where: { status: 'PENDING' } })
  ).filter((r) => staffIds.has(r.staffId)).length;

  const resolvedAreaIds =
    areaIds ?? (await store.areas.find()).map((a) => a.id);
  const stock = await Promise.all(
    resolvedAreaIds.map((id) => stockForArea(store, id)),
  );
  const lowStock = stock.flat().filter((row) => row.status !== 'OK').length;

  return {
    unassigned: todayVisits.filter(
      (v) => !v.staffId && v.status === 'PENDING',
    ).length,
    redAlerts: alerts.length,
    openComplaints: complaints,
    pocketRequests,
    lowStock,
    pendingPurchases: purchases,
  };
}
