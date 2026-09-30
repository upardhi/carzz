import type { DateOnly, Rupees, Timestamp } from '../data/types';
import { businessClock, businessCycle, businessToday } from './time';

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function money(amount: Rupees | number | null | undefined): string {
  if (amount === null || amount === undefined) return '₹0';
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (isNaN(n)) return '₹0';
  return INR.format(n);
}

/** Compact Indian notation: ₹3.40L, ₹1.2Cr. Used in KPI tiles. */
export function moneyShort(amount: Rupees | number | null | undefined): string {
  if (amount === null || amount === undefined) return '₹0';
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return money(n);
}

export function number(n: number | null | undefined): string {
  if (n === null || n === undefined) return '0';
  const val = typeof n === 'number' ? n : Number(n);
  if (isNaN(val)) return '0';
  return new Intl.NumberFormat('en-IN').format(val);
}

export function percent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return '0%';
  const val = typeof value === 'number' ? value : Number(value);
  if (isNaN(val)) return '0%';
  return `${(val * 100).toFixed(digits)}%`;
}

const DAY = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
});
const DAY_YEAR = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const WEEKDAY = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  weekday: 'long',
});

export function formatDate(value: DateOnly | Timestamp | Date | null | undefined): string {
  if (!value) return '—';
  const str = String(value).trim();
  if (
    !str ||
    str === '—' ||
    str.toLowerCase() === 'nan' ||
    str.toLowerCase() === 'undefined' ||
    str.toLowerCase() === 'null' ||
    str.includes('NaN')
  ) {
    return '—';
  }
  try {
    const d = toDate(value);
    if (isNaN(d.getTime())) return '—';
    return DAY.format(d);
  } catch {
    return '—';
  }
}

export function formatDateFull(value: DateOnly | Timestamp | Date | null | undefined): string {
  if (!value) return '—';
  const str = String(value).trim();
  if (
    !str ||
    str === '—' ||
    str.toLowerCase() === 'nan' ||
    str.toLowerCase() === 'undefined' ||
    str.toLowerCase() === 'null' ||
    str.includes('NaN')
  ) {
    return '—';
  }
  try {
    const d = toDate(value);
    if (isNaN(d.getTime())) return '—';
    return DAY_YEAR.format(d);
  } catch {
    return '—';
  }
}

export function formatWeekday(value: DateOnly | Timestamp | Date | null | undefined): string {
  if (!value) return '—';
  const str = String(value).trim();
  if (
    !str ||
    str === '—' ||
    str.toLowerCase() === 'nan' ||
    str.toLowerCase() === 'undefined' ||
    str.toLowerCase() === 'null' ||
    str.includes('NaN')
  ) {
    return '—';
  }
  try {
    const d = toDate(value);
    if (isNaN(d.getTime())) return '—';
    return WEEKDAY.format(d);
  } catch {
    return '—';
  }
}

/** `09:00` or ISO timestamp → `9:00 AM`. Bulletproof against null/undefined/ISO strings/NaN. */
export function formatTime(value: string | Timestamp | Date | null | undefined): string {
  if (!value) return '—';
  const str = String(value).trim();
  if (
    !str ||
    str === '—' ||
    str.toLowerCase() === 'nan' ||
    str.toLowerCase() === 'undefined' ||
    str.toLowerCase() === 'null' ||
    str.includes('NaN')
  ) {
    return '—';
  }

  // If value is an ISO date or contains 'T' / '-'
  if (str.includes('T') || (str.includes('-') && str.includes(':'))) {
    const d = toDate(str);
    if (!isNaN(d.getTime())) {
      return formatClock(str);
    }
  }

  const parts = str.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m) && h >= 0 && h < 24 && m >= 0 && m < 60) {
      const period = h >= 12 ? 'PM' : 'AM';
      const hour = h % 12 === 0 ? 12 : h % 12;
      return `${hour}:${String(m).padStart(2, '0')} ${period}`;
    }
  }

  // Fallback: try parsing as date
  const d = toDate(str);
  if (!isNaN(d.getTime())) {
    return formatClock(str);
  }

  return '—';
}

export function formatClock(value: Timestamp | Date | string | null | undefined): string {
  if (!value) return '—';
  const str = String(value).trim();
  if (
    !str ||
    str === '—' ||
    str.toLowerCase() === 'nan' ||
    str.toLowerCase() === 'undefined' ||
    str.toLowerCase() === 'null' ||
    str.includes('NaN')
  ) {
    return '—';
  }
  try {
    const d = toDate(value as never);
    if (isNaN(d.getTime())) return '—';
    const clock = businessClock(d);
    if (!clock || clock.includes('NaN')) return '—';
    const parts = clock.split(':');
    if (parts.length < 2) return '—';
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m) || h < 0 || h >= 24 || m < 0 || m >= 60) return '—';
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
  } catch {
    return '—';
  }
}

/** "in 2 days", "3 days ago", "today". */
export function relativeDays(value: DateOnly | Timestamp | Date): string {
  const target = toDate(value);
  if (isNaN(target.getTime())) return '—';
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

export function toDate(value: DateOnly | Timestamp | Date | null | undefined): Date {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return value;
  const str = String(value).trim();
  if (
    !str ||
    str.toLowerCase() === 'nan' ||
    str.toLowerCase() === 'undefined' ||
    str.toLowerCase() === 'null' ||
    str.includes('NaN')
  ) {
    return new Date(NaN);
  }
  return new Date(str.length === 10 ? `${str}T00:00:00.000Z` : str);
}

/** Today in the business timezone — the working day, not the UTC day. */
export function todayISO(): DateOnly {
  return businessToday();
}

export function currentCycle(): string {
  return businessCycle();
}

export function cycleLabel(cycle: string | null | undefined): string {
  if (!cycle || typeof cycle !== 'string' || !cycle.includes('-')) return '—';
  const [y, m] = cycle.split('-').map(Number);
  if (isNaN(y) || isNaN(m)) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function previousCycle(cycle: string = currentCycle()): string {
  if (!cycle || typeof cycle !== 'string' || !cycle.includes('-')) return currentCycle();
  const [y, m] = cycle.split('-').map(Number);
  if (isNaN(y) || isNaN(m)) return currentCycle();
  if (m === 1) {
    return `${y - 1}-12`;
  }
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function nextCycle(cycle: string = currentCycle()): string {
  if (!cycle || typeof cycle !== 'string' || !cycle.includes('-')) return currentCycle();
  const [y, m] = cycle.split('-').map(Number);
  if (isNaN(y) || isNaN(m)) return currentCycle();
  if (m === 12) {
    return `${y + 1}-01`;
  }
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

export function addDays(value: DateOnly | Date, days: number): Date {
  const d = toDate(value);
  if (isNaN(d.getTime())) return new Date();
  return new Date(d.getTime() + days * 86400000);
}

export function initials(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
