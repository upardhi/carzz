import 'server-only';

import type { DataStore } from '../data/ports/store';
import type {
  Car,
  Customer,
  DateOnly,
  Id,
  WashVisit,
} from '../data/types';
import { WEEKDAY_NUM } from '../data/types';

import { todayISO } from '../util/format';

/** The weekday numbers (0=Sun..6=Sat) this car washes on. Falls back to
 * Mon+Thu for a car with no days configured, rather than never scheduling. */
function weeklyDayNumbers(car: Car): number[] {
  const days = car.weeklyDays && car.weeklyDays.length > 0 ? car.weeklyDays : ['MON', 'THU'] as const;
  return days.map((d) => WEEKDAY_NUM[d]);
}

/** Which named service (if any) this car's plan assigns to a given date. */
export function plannedServiceFor(car: Car, date: DateOnly): string | null {
  if (!car.dayServices) return null;
  const dayNum = toDate(date).getUTCDay();
  const code = (Object.keys(WEEKDAY_NUM) as (keyof typeof WEEKDAY_NUM)[]).find(
    (d) => WEEKDAY_NUM[d] === dayNum,
  );
  return (code && car.dayServices[code]) || null;
}

const toDate = (d: DateOnly) => new Date(`${d}T00:00:00.000Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Finds the earliest configured weekly wash day on or after `from`.
 */
export function nextSlotOnOrAfter(car: Car, from: DateOnly): DateOnly | null {
  const days = weeklyDayNumbers(car);
  const cursor = toDate(from);
  for (let i = 0; i <= 14; i += 1) {
    if (days.includes(cursor.getUTCDay())) return toIso(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return toIso(cursor);
}

/**
 * The next free slot strictly after `from` on this car's weekly plan — where
 * the next wash lands after the current wash completes or is missed.
 */
export function nextSlotAfter(car: Car, from: DateOnly): DateOnly | null {
  const days = weeklyDayNumbers(car);
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
  fromDate?: DateOnly | null,
): Promise<WashVisit | null> {
  const today = todayISO();
  if (customer.status === 'INACTIVE' || !car.active || car.serviceStarted === false) {
    return null;
  }
  // If hold expired, auto-activate customer
  if (customer.status === 'HOLD' && customer.holdUntil && customer.holdUntil < today) {
    try {
      await store.customers.update(customer.id, { status: 'ACTIVE', holdUntil: null });
      customer.status = 'ACTIVE';
      customer.holdUntil = null;
    } catch {
      // ignore
    }
  }

  let pkg = await store.packages.get(car.packageId);
  let quota = pkg?.washesPerMonth ?? 8;

  // Get all visits for this car to evaluate package completion accurately across month boundaries
  const allCarVisits = await store.visits.find({
    where: { carId: car.id },
    orderBy: [{ field: 'scheduledDate', dir: 'asc' }],
  });

  const carStartCycle = car.serviceStartedAt ? car.serviceStartedAt.slice(0, 7) : cycle;

  const doneCount = allCarVisits.filter((v) => {
    if (v.status !== 'DONE') return false;
    if (car.packageResetAt) {
      const resetDate = car.packageResetAt.slice(0, 10);
      return v.scheduledDate >= resetDate || Boolean(v.completedAt && v.completedAt >= car.packageResetAt);
    }
    return v.cycle >= carStartCycle;
  }).length;

  if (doneCount >= quota) {
    // Current package is complete!
    if (car.nextPackageId) {
      // Auto-promote to the queued upcoming package now that current package is complete
      const resetTime = new Date().toISOString();
      try {
        await store.cars.update(car.id, {
          packageId: car.nextPackageId,
          nextPackageId: null,
          nextPackageCycle: null,
          packageResetAt: resetTime,
        });
        car.packageId = car.nextPackageId;
        car.nextPackageId = null;
        car.nextPackageCycle = null;
        car.packageResetAt = resetTime;
        pkg = await store.packages.get(car.packageId);
        quota = pkg?.washesPerMonth ?? 8;
      } catch {
        return null;
      }
    } else {
      // Car reached its package wash limit for this cycle and has no queued package
      return null;
    }
  }

  // Clean up any stale past pending visits that were never completed
  const pastPending = allCarVisits.filter(
    (v) => v.status === 'PENDING' && v.scheduledDate < today,
  );
  for (const p of pastPending) {
    try {
      await store.visits.delete(p.id);
    } catch {
      // Silently continue if record was already deleted
    }
  }

  // Check if there is already an upcoming pending or in-progress visit on or after today
  const openUpcoming = allCarVisits.filter(
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
        try {
          await store.visits.delete(extra.id);
        } catch {
          // Silently continue if record was already deleted
        }
      }
    }
    return firstOpen;
  }

  if (fromDate === null) {
    return null;
  }

  const baseDate = fromDate && fromDate >= today ? fromDate : today;
  const nextDate = nextSlotOnOrAfter(car, baseDate);
  
  if (!nextDate) {
    return null;
  }

  const targetCycle = nextDate.slice(0, 7);

  const created = await store.visits.create({
    carId: car.id,
    customerId: customer.id,
    areaId: customer.areaId,
    staffId: car.assignedStaffId,
    cycle: targetCycle,
    scheduledDate: nextDate,
    scheduledTime: car.scheduleTime,
    status: 'PENDING',
    startedAt: null,
    completedAt: null,
    plannedService: plannedServiceFor(car, nextDate),
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

/**
 * Moves one still-pending visit to a new date/time/staff, as a one-off
 * override — it does not touch the car's recurring weekly plan, so the
 * washes after this one keep landing on the configured weekdays.
 */
export async function rescheduleVisit(
  store: DataStore,
  visitId: Id,
  patch: { scheduledDate?: DateOnly; scheduledTime?: string; staffId?: Id | null },
): Promise<WashVisit> {
  const visit = await store.visits.get(visitId);
  if (!visit) throw new Error('Visit not found.');
  if (visit.status !== 'PENDING') {
    throw new Error('Only a pending wash can be rescheduled.');
  }
  return store.visits.update(visitId, patch);
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
