import type { AppSettings, WashVisit } from '@/lib/data/types';

export type WashSpeedFlag = 'fast' | 'slow' | null;

/** Minutes between a wash starting and finishing, or null if either is missing. */
export function washDurationMinutes(
  visit: Pick<WashVisit, 'startedAt' | 'completedAt'>,
): number | null {
  if (!visit.startedAt || !visit.completedAt) return null;
  const ms = new Date(visit.completedAt).getTime() - new Date(visit.startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 60000);
}

/**
 * Flags a wash as suspiciously fast (likely skipped steps) or too slow
 * (a boy stuck, or padding for overtime), against the owner's own thresholds.
 */
export function washSpeedFlag(
  durationMinutes: number | null,
  settings: Pick<AppSettings, 'minWashMinutes' | 'maxWashMinutes'>,
): WashSpeedFlag {
  if (durationMinutes === null) return null;
  if (durationMinutes < settings.minWashMinutes) return 'fast';
  if (durationMinutes > settings.maxWashMinutes) return 'slow';
  return null;
}

/** "45 min" under an hour, "1h 5m" at or beyond. */
export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export const WASH_FEEDBACK_WINDOW_DAYS = 7;
export const WASH_FEEDBACK_WINDOW_MS = WASH_FEEDBACK_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * Checks whether the feedback / complaint window (7 days after wash completion) has expired.
 */
export function isWashFeedbackExpired(
  visit: { completedAt?: string | null; scheduledDate?: string | null },
  now = Date.now(),
): boolean {
  const completionTime = visit.completedAt
    ? new Date(visit.completedAt).getTime()
    : visit.scheduledDate
    ? new Date(visit.scheduledDate).getTime()
    : null;

  if (completionTime === null || !Number.isFinite(completionTime)) {
    return false;
  }
  return now - completionTime > WASH_FEEDBACK_WINDOW_MS;
}


