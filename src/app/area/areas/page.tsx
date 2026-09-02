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
  const performance = await areaPerformance(store, cycle, session.scope.areaIds);

  const managerIds = [
    ...new Set(
      performance
        .map((p) => p.area.managerId)
        .filter(Boolean) as string[],
    ),
  ];
  const managers = managerIds.length
    ? await store.staff.find({ where: { id: { in: managerIds } } as never })
    : [];

  const managerNames: Record<string, string> = {};
  for (const m of managers) {
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
