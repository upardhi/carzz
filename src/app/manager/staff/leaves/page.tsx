import { requireSession } from '@/lib/auth/server';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import { getStore } from '@/lib/data';
import {
  StaffLeavesAdminClient,
  type EnrichedStaffLeave,
} from '@/components/console/StaffLeavesAdminClient';

export const metadata = { title: 'Staff Leaves & Absence' };

export default async function ManagerStaffLeavesPage() {
  const session = await requireSession();
  const store = await getStore();
  const areaFilter = scopeAreaFilter(session.scope);

  const [allLeaves, staffList, areas] = await Promise.all([
    store.leaves.find({
      orderBy: [{ field: 'appliedAt', dir: 'desc' }],
    }),

    store.staff.find({
      where: { role: 'EMPLOYEE', ...areaFilter } as never,
      orderBy: [{ field: 'name' }],
    }),
    store.areas.find(),
  ]);

  const staffMap = new Map(staffList.map((s) => [s.id, s]));
  const areaMap = new Map(areas.map((a) => [a.id, a]));

  const filteredLeaves = allLeaves.filter((l) => staffMap.has(l.staffId));

  const enrichedLeaves: EnrichedStaffLeave[] = filteredLeaves.map((l) => {
    const staffMember = staffMap.get(l.staffId);
    const area = staffMember ? areaMap.get(staffMember.areaId) : null;
    return {
      ...l,
      staffName: staffMember?.name ?? 'Unknown Staff',
      staffPhone: staffMember?.phone ?? '—',
      areaId: staffMember?.areaId ?? '',
      areaName: area?.name ?? '—',
    };
  });

  const accessibleAreas = session.scope.areaIds
    ? areas.filter((a) => session.scope.areaIds!.includes(a.id))
    : areas;

  return (
    <StaffLeavesAdminClient
      leaves={enrichedLeaves}
      staff={staffList.map((s) => ({
        id: s.id,
        name: s.name,
        areaId: s.areaId,
        phone: s.phone,
      }))}
      areas={accessibleAreas.map((a) => ({ id: a.id, name: a.name }))}
      base="/manager"
    />
  );
}
