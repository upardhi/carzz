import { PageHeader } from '@/components/shell/ConsoleShell';
import { ButtonLink } from '@/components/ui/primitives';
import { StaffPerformanceTable } from '@/components/console/StaffPerformanceTable';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { staffPerformance } from '@/lib/services/reports';
import { currentCycle, cycleLabel } from '@/lib/util/format';

export const metadata = { title: 'Staff Performance' };

export default async function AdminStaffPerformancePage() {
  await requirePermission('report:business');
  const store = await getStore();
  const cycle = currentCycle();

  const [staffData, areas] = await Promise.all([
    staffPerformance(store, cycle, null),
    store.areas.find({ orderBy: [{ field: 'name' }] }),
  ]);

  return (
    <>
      <PageHeader
        title="Staff performance"
        description={`${cycleLabel(cycle)} · All wash boys across all areas`}
        actions={
          <ButtonLink href="/admin/reports" variant="secondary" size="sm">
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
