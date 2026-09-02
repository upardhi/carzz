import {
  MobileCardListSkeleton,
  MobileHeroCardSkeleton,
  MobileStatGridSkeleton,
} from '@/components/ui/Skeleton';

/**
 * Shown inside MobileShell while the customer home page streams in.
 * Mirrors the real layout: hero card → 2-stat grid → car list → payment card.
 */
export default function AppLoading() {
  return (
    <div className="space-y-3">
      {/* Next wash hero */}
      <MobileHeroCardSkeleton />

      {/* Washes left + Balance */}
      <MobileStatGridSkeleton />

      {/* Car cards */}
      <MobileCardListSkeleton count={2} />

      {/* Payment / account status */}
      <div className="rounded-card border border-line bg-white p-4 shadow-card">
        <div className="h-2.5 w-20 animate-pulse rounded-lg bg-surface-raised" />
        <div className="mt-3 h-10 animate-pulse rounded-lg bg-surface-raised" />
      </div>
    </div>
  );
}
