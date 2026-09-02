import {
  CardRowSkeleton,
  CardSkeleton,
  KpiGridSkeleton,
  PageHeaderSkeleton,
  TableSkeleton,
} from '@/components/ui/Skeleton';

/**
 * Shown inside the ConsoleShell while the admin overview page streams in.
 * Mirrors the exact card layout of the real page so content pops in without
 * any layout shift.
 */
export default function AdminLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <KpiGridSkeleton count={6} />

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {/* Area performance table */}
        <CardSkeleton>
          <TableSkeleton rows={4} cols={6} />
        </CardSkeleton>

        {/* Needs your decision */}
        <CardSkeleton>
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-lg bg-surface-raised"
              />
            ))}
          </div>
        </CardSkeleton>

        {/* This month across the business */}
        <CardRowSkeleton rows={7} />

        {/* Money this month */}
        <CardRowSkeleton rows={7} />
      </div>
    </>
  );
}
