import clsx from 'clsx';
import type { ReactNode } from 'react';

/* -------------------------------------------------------------------------- */
/* Base                                                                        */
/* -------------------------------------------------------------------------- */

/** Base shimmer block. Size it with className (h-* w-*). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx('animate-pulse rounded-lg bg-surface-raised', className)}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Page-level                                                                  */
/* -------------------------------------------------------------------------- */

/** Matches the <PageHeader> title + description layout. */
export function PageHeaderSkeleton() {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <Skeleton className="mb-2 h-7 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* KPI Grid                                                                    */
/* -------------------------------------------------------------------------- */

/** Matches a single <StatCard> / <Kpi> tile. */
export function KpiSkeleton() {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-line-soft bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
      <Skeleton className="mt-2 h-2.5 w-24" />
    </div>
  );
}

/** Matches the full <KpiGrid> / <StatGrid> — six tiles by default. */
export function KpiGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <KpiSkeleton key={i} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Cards                                                                       */
/* -------------------------------------------------------------------------- */

/** Generic card wrapper with a title shimmer and optional body. */
export function CardSkeleton({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={clsx(
        'rounded-card border border-line bg-white p-4 shadow-card',
        className,
      )}
    >
      <Skeleton className="mb-3 h-3 w-28" />
      {children ?? <Skeleton className="h-24 w-full" />}
    </div>
  );
}

/** Matches a Card that contains a list of <Row> label/value pairs. */
export function CardRowSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-card border border-line bg-white p-4 shadow-card">
      <Skeleton className="mb-3 h-3 w-28" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-baseline justify-between border-b border-dashed border-line-soft py-1.5 last:border-0"
        >
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Table                                                                       */
/* -------------------------------------------------------------------------- */

/** Table header + N placeholder rows. Wraps itself in the standard card. */
export function TableSkeleton({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="min-w-full overflow-hidden rounded-card border border-line bg-white shadow-card">
      {/* thead shimmer */}
      <div className="flex gap-3 bg-surface-raised px-3 py-2">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 flex-1" />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex gap-3 border-t border-line-soft px-3 py-2.5"
        >
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mobile / PWA shells                                                         */
/* -------------------------------------------------------------------------- */

/** Two-column stat grid for mobile dashboards (staff, customer home). */
export function MobileStatGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="rounded-card border border-line bg-white p-3.5 shadow-card"
        >
          <Skeleton className="mb-2 h-2.5 w-16" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="mt-2 h-1.5 w-full" />
        </div>
      ))}
    </div>
  );
}

/** A single mobile list-card (customer car, staff visit, etc.). */
export function MobileCardSkeleton() {
  return (
    <div className="rounded-card border border-line bg-white p-3.5 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-14" />
      </div>
      <Skeleton className="mt-1.5 h-3 w-24" />
    </div>
  );
}

/** Stack of mobile cards. */
export function MobileCardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <MobileCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Highlighted "hero" card (Next wash, Payment due, etc.). */
export function MobileHeroCardSkeleton() {
  return (
    <div className="rounded-card border border-navy-200 bg-navy-50 p-4 shadow-card">
      <Skeleton className="mb-3 h-2.5 w-20 bg-navy-200" />
      <Skeleton className="mb-1.5 h-7 w-40 bg-navy-200" />
      <Skeleton className="h-4 w-24 bg-navy-200" />
    </div>
  );
}
