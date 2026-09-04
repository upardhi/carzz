import { PageHeader } from '@/components/shell/ConsoleShell';
import { ButtonLink } from '@/components/ui/primitives';
import { StaffPerformanceTable } from '@/components/console/StaffPerformanceTable';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { staffPerformance } from '@/lib/services/reports';
import { currentCycle, cycleLabel } from '@/lib/util/format';

export const metadata = { title: 'Staff Performance' };

export default async function AreaStaffPerformancePage() {
  const session = await requirePermission('report:area');
  const store = await getStore();
  const cycle = currentCycle();
  const areaIds = session.scope.areaIds;

  const [staffData, areas] = await Promise.all([
    staffPerformance(store, cycle, areaIds),
    store.areas.find({
      where: (areaIds ? { id: { in: areaIds } } : undefined) as never,
      orderBy: [{ field: 'name' }],
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Staff performance"
        description={`${cycleLabel(cycle)} · Performance for your assigned areas`}
        actions={
          <ButtonLink href="/area/reports" variant="secondary" size="sm">
            ← Back to reports
          </ButtonLink>
        }
      />

      <StaffPerformanceTable
        rows={staffData.rows}
        areas={areas}
        totalStaff={staffData.total}
      />
    </>
  );
}
