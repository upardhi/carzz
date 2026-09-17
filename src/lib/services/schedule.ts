import 'server-only';

import type { DataStore } from '../data/ports/store';
import type {
  Car,
  Customer,
  DateOnly,
  Id,
  WashVisit,
  WeekdayPattern,
} from '../data/types';

import { todayISO } from '../util/format';

export const PATTERN_DAYS: Record<WeekdayPattern, number[]> = {
  MON_THU: [1, 4],
  TUE_FRI: [2, 5],
  WED_SAT: [3, 6],
  THU_SUN: [4, 0],
};

const toDate = (d: DateOnly) => new Date(`${d}T00:00:00.000Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Finds the earliest available pattern day on or after `from`.
 */
export function nextSlotOnOrAfter(car: Car, from: DateOnly): DateOnly {
  const days = PATTERN_DAYS[car.schedulePattern] || [1, 4];
  const cursor = toDate(from);
  for (let i = 0; i <= 14; i += 1) {
    if (days.includes(cursor.getUTCDay())) return toIso(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return toIso(cursor);
}

/**
 * The next free slot strictly after `from` on this car's pattern — where the
 * next wash lands after the current wash completes or is missed.
 */
export function nextSlotAfter(car: Car, from: DateOnly): DateOnly {
  const days = PATTERN_DAYS[car.schedulePattern] || [1, 4];
  const cursor = toDate(from);
  for (let i = 1; i <= 14; i += 1) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (days.includes(cursor.getUTCDay())) return toIso(cursor);
  }
  return toIso(cursor);
}

/**
 * Schedules ONLY the single next upcoming pending wash for a car.
 * When this wash completes, the subsequent wash is automatically scheduled.
 */
export async function scheduleNextVisitForCar(
  store: DataStore,
  car: Car,
  customer: Customer,
  cycle: string,
  fromDate?: DateOnly,
): Promise<WashVisit | null> {
  const pkg = await store.packages.get(car.packageId);
  const quota = pkg?.washesPerMonth ?? 8;
  const today = todayISO();

  // Get all visits for this car in the cycle
  const existing = await store.visits.find({
    where: { carId: car.id, cycle },
    orderBy: [{ field: 'scheduledDate', dir: 'asc' }],
  });

  const doneCount = existing.filter((v) => v.status === 'DONE').length;
  if (doneCount >= quota) {
    // Car already reached its monthly wash limit for this cycle
    return null;
  }

  // Clean up any stale past pending visits that were never completed
  const pastPending = existing.filter(
    (v) => v.status === 'PENDING' && v.scheduledDate < today,
  );
  for (const p of pastPending) {
    await store.visits.delete(p.id);
  }

  // Check if there is already an upcoming pending or in-progress visit on or after today
  const openUpcoming = existing.filter(
    (v) =>
      (v.status === 'PENDING' || v.status === 'IN_PROGRESS') &&
      v.scheduledDate >= today,
  );

  if (openUpcoming.length > 0) {
    // Keep the first open visit, remove any redundant future pending visits in DB
    const firstOpen = openUpcoming[0];
    const extraOpen = openUpcoming.slice(1);
    for (const extra of extraOpen) {
      if (extra.status === 'PENDING') {
        await store.visits.delete(extra.id);
      }
    }
    return firstOpen;
  }

  const baseDate = fromDate && fromDate >= today ? fromDate : today;
  const nextDate = nextSlotOnOrAfter(car, baseDate);

  const created = await store.visits.create({
    carId: car.id,
    customerId: customer.id,
    areaId: customer.areaId,
    staffId: car.assignedStaffId,
    cycle,
    scheduledDate: nextDate,
    scheduledTime: car.scheduleTime,
    status: 'PENDING',
    startedAt: null,
    completedAt: null,
    servicesDone: [],
    beforePhotoUrl: null,
    afterPhotoUrl: null,
    beforePhotoBytes: null,
    afterPhotoBytes: null,
    missReason: null,
    missNote: null,
    rescheduledToVisitId: null,
    rating: null,
    ratingComment: null,
    onTime: false,
    managerRating: null,
    managerRatingComment: null,
    managerRatedAt: null,
    managerRatedByUserId: null,
  });

  return created;
}

/**
 * Generates the immediate next visit for one car for a cycle.
 * Safe to call repeatedly — enforces single-step sequential scheduling.
 */
export async function generateVisitsForCar(
  store: DataStore,
  car: Car,
  customer: Customer,
  cycle: string,
  fromDate?: DateOnly,
): Promise<WashVisit[]> {
  const visit = await scheduleNextVisitForCar(store, car, customer, cycle, fromDate);
  return visit ? [visit] : [];
}

/** Visits due on one date, for one area or one staff member. */
export async function visitsForDate(
  store: DataStore,
  date: DateOnly,
  filter: { areaId?: Id; staffId?: Id; areaIds?: Id[] },
): Promise<WashVisit[]> {
  const where: Record<string, unknown> = { scheduledDate: date };
  if (filter.staffId) where.staffId = filter.staffId;
  if (filter.areaId) where.areaId = filter.areaId;
  else if (filter.areaIds) where.areaId = { in: filter.areaIds };

  return store.visits.find({
    where: where as never,
    orderBy: [{ field: 'scheduledTime' }],
  });
}
