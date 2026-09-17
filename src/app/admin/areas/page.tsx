import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { areaPerformance } from '@/lib/services/reports';
import { currentCycle, cycleLabel } from '@/lib/util/format';
import { AreaManagementClient } from './AreaManagementClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Areas' };

export default async function AdminAreas() {
  await requirePermission('area:manage');
  const store = await getStore();
  const cycle = currentCycle();

  const [performance, staff, regions, areaAdmins, boysWorking] = await Promise.all([
    areaPerformance(store, cycle, null),
    store.staff.find({ where: { role: 'MANAGER', active: true } }),
    store.regions.find({ orderBy: [{ field: 'name' }] }),
    store.users.find({ where: { role: 'AREA_ADMIN', active: true } }),
    store.staff.count({ role: 'EMPLOYEE', active: true }),
  ]);

  const regionOptions = regions.map((r) => ({
    id: r.id,
    name: r.name,
    areaAdminId: r.areaAdminId ?? null,
    active: r.active,
    createdAt: r.createdAt ?? null,
  }));
  const managerOptions = staff.map((s) => ({
    id: s.id,
    name: s.name,
    areaId: s.areaId,
  }));
  const adminOptions = areaAdmins.map((a) => ({
    id: a.id,
    name: a.name,
  }));

  return (
    <AreaManagementClient
      view="areas"
      performance={performance}
      regions={regionOptions}
      managers={managerOptions}
      areaAdmins={adminOptions}
      cycleLabel={cycleLabel(cycle)}
      boysWorking={boysWorking}
    />
  );
}
