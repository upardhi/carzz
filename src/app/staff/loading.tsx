import {
  MobileCardListSkeleton,
  MobileStatGridSkeleton,
} from '@/components/ui/Skeleton';

/**
 * Shown inside MobileShell while the staff today page streams in.
 * Mirrors the real layout: 2-stat grid → month card → visit list.
 */
export default function StaffLoading() {
  return (
    <div className="space-y-3">
      {/* Cars today + Earned today */}
      <MobileStatGridSkeleton />

      {/* This month payout */}
      <div className="rounded-card border border-line bg-white p-3.5 shadow-card">
        <div className="mb-2 h-2.5 w-20 animate-pulse rounded-lg bg-surface-raised" />
        <div className="h-7 w-32 animate-pulse rounded-lg bg-surface-raised" />
      </div>

      {/* Visit list */}
      <MobileCardListSkeleton count={4} />
    </div>
  );
}
