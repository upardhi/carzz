import 'server-only';

import type { AccessScope } from '@/lib/auth/rbac';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import type { DataStore } from '@/lib/data/ports/store';
import { loadRedAlerts } from '@/lib/services/accounts';
import { stockForArea } from '@/lib/services/inventory';
import { todayISO } from '@/lib/util/format';
import type { NavCounts } from './nav';

/**
 * The badge numbers on the sidebar.
 *
 * These are the only things that should pull a manager away from what they are
 * doing, so they are computed once per request and shown everywhere rather
 * than being recounted per page.
 */
export async function navCounts(
  store: DataStore,
  scope: AccessScope,
): Promise<NavCounts> {
  const areaFilter = scopeAreaFilter(scope);

  const [todayVisits, alerts, complaints, staff, purchases] = await Promise.all([
    store.visits.find({
      where: { scheduledDate: todayISO(), ...areaFilter } as never,
    }),
    loadRedAlerts(store, scope.areaIds),
    store.complaints.count({
      status: { in: ['OPEN', 'ESCALATED'] },
      ...areaFilter,
    } as never),
    store.staff.find({ where: { role: 'EMPLOYEE', ...areaFilter } as never }),
    store.purchaseRequests.count({
      status: 'PENDING',
      ...areaFilter,
    } as never),
  ]);

  const staffIds = new Set(staff.map((s) => s.id));
  const pocketRequests = (
    await store.pocketRequests.find({ where: { status: 'PENDING' } })
  ).filter((r) => staffIds.has(r.staffId)).length;

  const areaIds =
    scope.areaIds ?? (await store.areas.find()).map((a) => a.id);
  const stock = await Promise.all(areaIds.map((id) => stockForArea(store, id)));
  const lowStock = stock
    .flat()
    .filter((row) => row.status !== 'OK').length;

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
