import { Suspense } from 'react';
import { ConsoleDashboard } from '@/components/console/Dashboard';
import {
  CardRowSkeleton,
  CardSkeleton,
  KpiGridSkeleton,
  TableSkeleton,
} from '@/components/ui/Skeleton';
import { requirePermission } from '@/lib/auth/server';

export const metadata = { title: 'Dashboard' };

function DashboardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <KpiGridSkeleton count={4} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 24,
        }}
      >
        <CardSkeleton>
          <CardRowSkeleton rows={3} />
        </CardSkeleton>
        <CardSkeleton>
          <CardRowSkeleton rows={3} />
        </CardSkeleton>
      </div>
      <CardSkeleton>
        <TableSkeleton rows={4} cols={6} />
      </CardSkeleton>
    </div>
  );
}

export default async function ManagerDashboard() {
  const session = await requirePermission('report:area');
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <ConsoleDashboard session={session} base="/manager" />
    </Suspense>
  );
}
