import { AreasClient } from '@/components/console/AreasClient';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { areaPerformance } from '@/lib/services/reports';
import { currentCycle, cycleLabel } from '@/lib/util/format';

export const metadata = { title: 'Areas' };

export default async function AreaAdminAreas() {
  const session = await requirePermission('report:area');
  const store = await getStore();
  const cycle = currentCycle();
  const [performance, allManagers] = await Promise.all([
    areaPerformance(store, cycle, session.scope.areaIds),
    store.staff.find({ where: { role: 'MANAGER' } }),
  ]);

  const managerNames: Record<string, string> = {};
  for (const m of allManagers) {
    managerNames[m.id] = m.name;
  }

  return (
    <AreasClient
      performance={performance}
      managerNames={managerNames}
      cycle={cycle}
      cycleLabel={cycleLabel(cycle)}
    />
  );
}
