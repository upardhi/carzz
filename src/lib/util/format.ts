import type { DateOnly, Rupees, Timestamp } from '../data/types';
import { businessClock, businessCycle, businessToday } from './time';

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function money(amount: Rupees): string {
  return INR.format(amount ?? 0);
}

/** Compact Indian notation: ₹3.40L, ₹1.2Cr. Used in KPI tiles. */
export function moneyShort(amount: Rupees): string {
  const n = amount ?? 0;
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return money(n);
}

export function number(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n ?? 0);
}

export function percent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

const DAY = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
});
const DAY_YEAR = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const WEEKDAY = new Intl.DateTimeFormat('en-IN', { weekday: 'long' });

export function formatDate(value: DateOnly | Timestamp | Date): string {
  return DAY.format(toDate(value));
}

export function formatDateFull(value: DateOnly | Timestamp | Date): string {
  return DAY_YEAR.format(toDate(value));
}

export function formatWeekday(value: DateOnly | Timestamp | Date): string {
  return WEEKDAY.format(toDate(value));
}

/** `09:00` → `9:00 AM`. */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatClock(value: Timestamp | null): string {
  if (!value) return '—';
  // Rendered in the business timezone so a completion time lines up with the
  // slot it is being compared against.
  return formatTime(businessClock(toDate(value)));
}

/** "in 2 days", "3 days ago", "today". */
export function relativeDays(value: DateOnly | Timestamp | Date): string {
  const target = toDate(value);
  const today = new Date();
  const diff = Math.round(
    (Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()) -
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) /
      86400000,
  );
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return diff > 0 ? `in ${diff} days` : `${Math.abs(diff)} days ago`;
}

export function toDate(value: DateOnly | Timestamp | Date): Date {
  if (value instanceof Date) return value;
  return new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
}

/** Today in the business timezone — the working day, not the UTC day. */
export function todayISO(): DateOnly {
  return businessToday();
}

export function currentCycle(): string {
  return businessCycle();
}

export function cycleLabel(cycle: string): string {
  const [y, m] = cycle.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function addDays(value: DateOnly | Date, days: number): Date {
  return new Date(toDate(value).getTime() + days * 86400000);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
