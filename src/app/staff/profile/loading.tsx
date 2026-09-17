import { CardRowSkeleton } from '@/components/ui/Skeleton';

/** Instant skeleton shown while the profile server component fetches data */
export default function ProfileLoading() {
  return (
    <div className="space-y-3">
      {/* My Details */}
      <CardRowSkeleton rows={6} />

      {/* My Performance This Month */}
      <CardRowSkeleton rows={4} />

      {/* Sign out button shimmer */}
      <div className="h-11 w-full animate-pulse rounded-card bg-surface-raised" />
    </div>
  );
}
