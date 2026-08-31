import 'server-only';

import type { DataStore } from '../data/ports/store';
import type {
  Car,
  Customer,
  DateOnly,
  Id,
  ServicePackage,
  WashVisit,
  WeekdayPattern,
} from '../data/types';

export const PATTERN_DAYS: Record<WeekdayPattern, number[]> = {
  MON_THU: [1, 4],
  TUE_FRI: [2, 5],
  WED_SAT: [3, 6],
  THU_SUN: [4, 0],
};

const toDate = (d: DateOnly) => new Date(`${d}T00:00:00.000Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The dates a car is due in a billing cycle.
 *
 * A package with four or fewer visits a month (detailing) runs weekly on the
 * first day of its pattern; anything larger runs on both.
 *
 * When the month offers more slots than the package allows — a five-Monday
 * August against an eight-wash package — the allowance is spread evenly across
 * the month rather than taken from the front. Truncating the tail would leave
 * the customer with a dead final week and the wash boy with an empty round.
 */
export function scheduledDatesForCycle(
  car: Car,
  pkg: ServicePackage,
  cycle: string,
): DateOnly[] {
  const [year, month] = cycle.split('-').map(Number);
  const days = PATTERN_DAYS[car.schedulePattern];
  const activeDays = pkg.washesPerMonth <= 4 ? [days[0]] : days;

  const slots: DateOnly[] = [];
  const cursor = new Date(Date.UTC(year, month - 1, 1));

  while (cursor.getUTCMonth() === month - 1) {
    if (activeDays.includes(cursor.getUTCDay())) slots.push(toIso(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (slots.length <= pkg.washesPerMonth) return slots;
  if (pkg.washesPerMonth <= 1) return slots.slice(0, pkg.washesPerMonth);

  return Array.from(
    { length: pkg.washesPerMonth },
    (_, i) => slots[Math.round((i * (slots.length - 1)) / (pkg.washesPerMonth - 1))],
  );
}

/**
 * Creates the visits for one car for a cycle, skipping dates that already have
 * one. Safe to call repeatedly — the manager's "regenerate schedule" action and
 * the monthly rollover both rely on that.
 */
export async function generateVisitsForCar(
  store: DataStore,
  car: Car,
  customer: Customer,
  cycle: string,
): Promise<WashVisit[]> {
  const pkg = await store.packages.get(car.packageId);
  if (!pkg) throw new Error(`Package ${car.packageId} not found`);

  const existing = await store.visits.find({
    where: { carId: car.id, cycle },
  });
  const taken = new Set(existing.map((v) => v.scheduledDate));

  const created: WashVisit[] = [];
  for (const date of scheduledDatesForCycle(car, pkg, cycle)) {
    if (taken.has(date)) continue;
    created.push(
      await store.visits.create({
        carId: car.id,
        customerId: customer.id,
        areaId: customer.areaId,
        staffId: car.assignedStaffId,
        cycle,
        scheduledDate: date,
        scheduledTime: car.scheduleTime,
        status: 'PENDING',
        startedAt: null,
        completedAt: null,
        servicesDone: [],
        beforePhotoUrl: null,
        afterPhotoUrl: null,
        missReason: null,
        missNote: null,
        rescheduledToVisitId: null,
        rating: null,
        ratingComment: null,
        onTime: false,
      }),
    );
  }

  return created;
}

/**
 * The next free slot after `from` on this car's pattern — where a missed wash
 * lands when it returns to the customer's count.
 */
export function nextSlotAfter(car: Car, from: DateOnly): DateOnly {
  const days = PATTERN_DAYS[car.schedulePattern];
  const cursor = toDate(from);
  for (let i = 1; i <= 14; i += 1) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (days.includes(cursor.getUTCDay())) return toIso(cursor);
  }
  return toIso(cursor);
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
