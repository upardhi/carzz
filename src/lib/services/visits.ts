import 'server-only';

import type { DataStore } from '../data/ports/store';
import type { Id, MissReason, WashVisit } from '../data/types';
import { nextSlotAfter } from './schedule';

export class WashRuleError extends Error {}

/**
 * Closes a wash.
 *
 * The photo rule is enforced here rather than only in the UI: with no before
 * and after photo the visit cannot be completed, which is the entire integrity
 * story the client is buying. `requireBothPhotos` in settings can relax it,
 * but nothing in the app can bypass it.
 */
export async function completeWash(
  store: DataStore,
  visitId: Id,
  input: {
    staffId: Id;
    servicesDone: string[];
    beforePhotoUrl: string | null;
    afterPhotoUrl: string | null;
  },
): Promise<WashVisit> {
  const visit = await store.visits.get(visitId);
  if (!visit) throw new WashRuleError('That wash no longer exists.');
  if (visit.status === 'DONE') return visit;
  if (visit.status === 'MISSED') {
    throw new WashRuleError('This wash was already marked not done.');
  }

  const settings = await store.getAppSettings();
  if (settings.requireBothPhotos) {
    if (!input.beforePhotoUrl || !input.afterPhotoUrl) {
      throw new WashRuleError(
        'Both the before and after photo are needed to close a wash.',
      );
    }
  }
  if (!input.servicesDone.length) {
    throw new WashRuleError('Tick at least one item of work you did.');
  }

  const completedAt = new Date();
  // "On time" means closed within the hour of the booked slot — the window the
  // on-time bonus is paid against.
  const slot = new Date(`${visit.scheduledDate}T${visit.scheduledTime}:00.000Z`);
  const onTime = completedAt.getTime() - slot.getTime() <= 60 * 60 * 1000;

  return store.visits.update(visitId, {
    status: 'DONE',
    staffId: input.staffId,
    startedAt: visit.startedAt ?? completedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    servicesDone: input.servicesDone,
    beforePhotoUrl: input.beforePhotoUrl,
    afterPhotoUrl: input.afterPhotoUrl,
    onTime,
  });
}

/**
 * Records a wash that could not be done.
 *
 * When `missedWashReturnsToCount` is on (the default), a replacement visit is
 * created at the car's next slot so the customer keeps the wash he paid for —
 * and the link between the two is stored, so the customer app can show him
 * exactly where it went.
 */
export async function missWash(
  store: DataStore,
  visitId: Id,
  input: {
    staffId: Id | null;
    reason: MissReason;
    note?: string | null;
    rescheduleTo?: string | null;
  },
): Promise<{ visit: WashVisit; replacement: WashVisit | null }> {
  const visit = await store.visits.get(visitId);
  if (!visit) throw new WashRuleError('That wash no longer exists.');
  if (visit.status === 'DONE') {
    throw new WashRuleError('This wash is already closed as done.');
  }

  const settings = await store.getAppSettings();
  let replacement: WashVisit | null = null;

  if (settings.missedWashReturnsToCount) {
    const car = await store.cars.get(visit.carId);
    const date =
      input.rescheduleTo ??
      (car ? nextSlotAfter(car, visit.scheduledDate) : visit.scheduledDate);

    replacement = await store.visits.create({
      carId: visit.carId,
      customerId: visit.customerId,
      areaId: visit.areaId,
      staffId: visit.staffId,
      // The replacement stays in the same billing cycle: the customer is not
      // charged again, and the month's count still balances.
      cycle: visit.cycle,
      scheduledDate: date,
      scheduledTime: visit.scheduledTime,
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
    });
  }

  const updated = await store.visits.update(visitId, {
    status: 'MISSED',
    staffId: input.staffId ?? visit.staffId,
    missReason: input.reason,
    missNote: input.note ?? null,
    rescheduledToVisitId: replacement?.id ?? null,
  });

  return { visit: updated, replacement };
}

/** Moves a visit to another wash boy — the absence-cover path. */
export async function reassignVisit(
  store: DataStore,
  visitId: Id,
  staffId: Id | null,
): Promise<WashVisit> {
  const visit = await store.visits.get(visitId);
  if (!visit) throw new WashRuleError('That wash no longer exists.');
  if (visit.status === 'DONE') {
    throw new WashRuleError('A completed wash cannot be reassigned.');
  }
  return store.visits.update(visitId, { staffId });
}

export async function rateVisit(
  store: DataStore,
  visitId: Id,
  rating: number,
  comment?: string | null,
): Promise<WashVisit> {
  if (rating < 1 || rating > 5) {
    throw new WashRuleError('A rating must be between 1 and 5 stars.');
  }
  const visit = await store.visits.get(visitId);
  if (!visit) throw new WashRuleError('That wash no longer exists.');
  if (visit.status !== 'DONE') {
    throw new WashRuleError('Only a completed wash can be rated.');
  }
  return store.visits.update(visitId, {
    rating,
    ratingComment: comment ?? null,
  });
}

/** Counts used by the customer's "washes left" and the manager's month view. */
export interface VisitTally {
  total: number;
  done: number;
  missed: number;
  pending: number;
  remaining: number;
}

export function tallyVisits(visits: WashVisit[]): VisitTally {
  const done = visits.filter((v) => v.status === 'DONE').length;
  const missed = visits.filter((v) => v.status === 'MISSED').length;
  const pending = visits.filter(
    (v) => v.status === 'PENDING' || v.status === 'IN_PROGRESS',
  ).length;
  return {
    total: visits.length,
    done,
    missed,
    pending,
    // A missed wash is regenerated as a pending one, so "remaining" is simply
    // what is still open — never a number that quietly loses the customer a wash.
    remaining: pending,
  };
}
