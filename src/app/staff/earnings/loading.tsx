import {
  CardRowSkeleton,
} from '@/components/ui/Skeleton';

/** Instant skeleton shown while the earnings server component fetches data */
export default function EarningsLoading() {
  return (
    <div className="space-y-3">
      {/* Earned this month + bar chart */}
      <div className="rounded-card border border-line bg-white p-4 shadow-card">
        <div className="mb-2 h-2.5 w-28 animate-pulse rounded-lg bg-surface-raised" />
        <div className="h-8 w-32 animate-pulse rounded-lg bg-surface-raised" />
        {/* Bar chart shimmer */}
        <div className="mt-4 flex items-end gap-1.5 h-14">
          {[40, 60, 45, 70, 55, 85].map((h, i) => (
            <div
              key={i}
              className="flex-1 animate-pulse rounded-sm bg-surface-raised"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>

      {/* How it adds up */}
      <CardRowSkeleton rows={5} />

      {/* Refer and earn */}
      <div className="rounded-card border border-line bg-white p-4 shadow-card">
        <div className="mb-3 h-2.5 w-24 animate-pulse rounded-lg bg-surface-raised" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex justify-between border-b border-dashed border-line-soft py-1.5">
              <div className="h-3 w-40 animate-pulse rounded-lg bg-surface-raised" />
              <div className="h-3 w-16 animate-pulse rounded-lg bg-surface-raised" />
            </div>
          ))}
        </div>
      </div>

      {/* My performance */}
      <CardRowSkeleton rows={3} />

      {/* Off status */}
      <CardRowSkeleton rows={4} />
    </div>
  );
}
