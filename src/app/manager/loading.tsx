import {
  CardRowSkeleton,
  CardSkeleton,
  KpiGridSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
} from '@/components/ui/Skeleton';

/**
 * Shown inside the ConsoleShell while the manager dashboard page streams in.
 */
export default function ManagerLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <KpiGridSkeleton count={4} />

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <CardSkeleton>
          <TableSkeleton rows={5} cols={5} />
        </CardSkeleton>
        <CardRowSkeleton rows={6} />
      </div>
    </>
  );
}
