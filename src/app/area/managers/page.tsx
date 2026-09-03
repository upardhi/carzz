import { ManagersClient } from '@/components/console/ManagersClient';
import { can } from '@/lib/auth/rbac';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { areaPerformance } from '@/lib/services/reports';
import { currentCycle, cycleLabel } from '@/lib/util/format';

export const metadata = { title: 'Managers' };

/** An Area Admin manages managers; their area's numbers are their scorecard. */
export default async function AreaAdminManagers() {
  const session = await requirePermission('staff:view');
  const store = await getStore();
  const cycle = currentCycle();

  const [managers, performance, users] = await Promise.all([
    store.staff.find({
      where: {
        role: 'MANAGER',
        ...(session.scope.areaIds
          ? { areaId: { in: session.scope.areaIds } }
          : {}),
      } as never,
      orderBy: [{ field: 'name' }],
    }),
    areaPerformance(store, cycle, session.scope.areaIds),
    store.users.find({ where: { role: 'MANAGER' } }),
  ]);

  const canAddManager =
    session.user.role === 'SUPER_ADMIN' || can(session.user.role, 'user:manage');

  return (
    <ManagersClient
      managers={managers}
      performance={performance}
      users={users}
      cycleLabel={cycleLabel(cycle)}
      canAddManager={canAddManager}
    />
  );
}
