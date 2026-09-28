import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { areaPerformance } from '@/lib/services/reports';
import { currentCycle, cycleLabel } from '@/lib/util/format';
import { AreaManagementClient } from '@/app/admin/areas/AreaManagementClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Areas' };

export default async function AreaAdminAreas() {
  const session = await requirePermission('report:area');
  const store = await getStore();
  const cycle = currentCycle();

  const [performance, staff, allRegions, boysWorking] = await Promise.all([
    areaPerformance(store, cycle, session.scope.areaIds),
    store.staff.find({ where: { role: 'MANAGER', active: true } }),
    store.regions.find({ orderBy: [{ field: 'name' }] }),
    store.staff.count({
      role: 'EMPLOYEE',
      active: true,
      ...(session.scope.areaIds ? { areaId: { in: session.scope.areaIds } } : {}),
    } as never),
  ]);

  // Scoped to Region Admin's region
  const adminRegionId = session.user.regionId;
  const regions = adminRegionId
    ? allRegions.filter((r) => r.id === adminRegionId)
    : allRegions;

  const regionOptions = regions.map((r) => ({
    id: r.id,
    name: r.name,
    areaAdminId: r.areaAdminId ?? null,
    active: r.active,
    createdAt: r.createdAt ?? null,
  }));

  const managerOptions = staff
    .filter((s) => !session.scope.areaIds || session.scope.areaIds.includes(s.areaId))
    .map((s) => ({
      id: s.id,
      name: s.name,
      areaId: s.areaId,
    }));

  return (
    <AreaManagementClient
      view="areas"
      performance={performance}
      regions={regionOptions}
      managers={managerOptions}
      areaAdmins={[{ id: session.user.id, name: session.user.name }]}
      cycleLabel={cycleLabel(cycle)}
      boysWorking={boysWorking}
    />
  );
}
