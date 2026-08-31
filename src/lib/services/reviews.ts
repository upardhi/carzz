import 'server-only';

import type { DataStore } from '../data/ports/store';
import type { Rupees } from '../data/types';

export interface PublicReview {
  id: string;
  /** First name only — a public page should not carry a full customer name. */
  name: string;
  area: string;
  rating: number;
  comment: string | null;
  service: string;
  date: string;
}

export interface ReviewSummary {
  average: number;
  count: number;
  reviews: PublicReview[];
}

/**
 * Real ratings customers left on real washes, for the public website.
 *
 * This beats written testimonials on both counts: it is genuinely what
 * customers said, and it keeps itself current without anyone maintaining it.
 *
 * Only the first name and the area are published — never the full name, the
 * address, or the number plate.
 */
export async function publicReviews(
  store: DataStore,
  { minStars = 4, limit = 9 }: { minStars?: number; limit?: number } = {},
): Promise<ReviewSummary> {
  const rated = await store.visits.find({
    where: { status: 'DONE', rating: { gte: minStars } } as never,
    orderBy: [{ field: 'scheduledDate', dir: 'desc' }],
    limit: 400,
  });

  if (!rated.length) return { average: 0, count: 0, reviews: [] };

  // The average is over every rating on record, not only the ones shown, so
  // the number on the site is the honest one rather than a flattering slice.
  const allRated = await store.visits.find({
    where: { status: 'DONE', rating: { gte: 1 } } as never,
  });
  const average =
    allRated.reduce((sum, v) => sum + (v.rating ?? 0), 0) / allRated.length;

  const areas = new Map((await store.areas.find()).map((a) => [a.id, a.name]));

  // Prefer reviews that actually say something over a bare star rating.
  const ordered = [...rated].sort((a, b) => {
    const aHas = a.ratingComment ? 1 : 0;
    const bHas = b.ratingComment ? 1 : 0;
    return bHas - aHas || b.scheduledDate.localeCompare(a.scheduledDate);
  });

  const reviews: PublicReview[] = [];
  const seenCustomers = new Set<string>();
  const perArea = new Map<string, number>();
  // Spread across areas so the wall does not read as one neighbourhood.
  const areaCap = Math.max(1, Math.ceil(limit / Math.max(1, areas.size)));

  for (const pass of [0, 1]) {
    for (const visit of ordered) {
      if (reviews.length >= limit) break;
      if (seenCustomers.has(visit.customerId)) continue;
      // First pass respects the per-area cap; the second fills any shortfall.
      if (pass === 0 && (perArea.get(visit.areaId) ?? 0) >= areaCap) continue;

      const customer = await store.customers.get(visit.customerId);
      if (!customer) continue;
      seenCustomers.add(customer.id);
      perArea.set(visit.areaId, (perArea.get(visit.areaId) ?? 0) + 1);

      reviews.push({
        id: visit.id,
        name: customer.name.split(' ')[0],
        area: areas.get(visit.areaId) ?? '',
        rating: visit.rating ?? 0,
        comment: visit.ratingComment,
        service: visit.servicesDone[0] ?? 'Wash',
        date: visit.scheduledDate,
      });
    }
  }

  return { average, count: allRated.length, reviews };
}

/** Headline numbers the website can quote honestly. */
export async function publicStats(store: DataStore): Promise<{
  washesDone: number;
  customers: number;
  areas: number;
  averageRating: number;
  collected: Rupees;
}> {
  const [done, customers, areas, summary] = await Promise.all([
    store.visits.count({ status: 'DONE' }),
    store.customers.count({ status: 'ACTIVE' }),
    store.areas.count(),
    publicReviews(store, { minStars: 1, limit: 0 }),
  ]);
  return {
    washesDone: done,
    customers,
    areas,
    averageRating: summary.average,
    collected: 0,
  };
}
