import type {
  ComplaintType,
  ExpenseHead,
  LeadSource,
  Language,
  MissReason,
  PaymentMode,
  Role,
  Weekday,
} from '../data/types';

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  AREA_ADMIN: 'Area Admin',
  MANAGER: 'Manager',
  EMPLOYEE: 'Wash Boys',
  CUSTOMER: 'Customer',
};

export const ROLE_BLURB: Record<Role, string> = {
  SUPER_ADMIN: 'Owner — every area, every rupee',
  AREA_ADMIN: 'Runs a region — managers and their staff',
  MANAGER: 'Runs one area day to day',
  EMPLOYEE: 'Car wash boy — today’s cars and earnings',
  CUSTOMER: 'Cars, schedule and payments',
};

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  GUARD_REF: 'Apartment guard reference',
  CUSTOMER_REF: 'Customer reference',
  STAFF_REF: 'Staff reference',
  DETAILING_CENTRE: 'Detailing centre reference',
  ONLINE_ADS: 'Instagram / Google ads',
  WEBSITE: 'Our website',
  PAMPHLET: 'Pamphlet / banner',
  OTHER: 'Other',
};

export const MISS_REASON_LABEL: Record<MissReason, string> = {
  CAR_NOT_AVAILABLE: 'Car not available',
  CUSTOMER_SKIPPED: 'Customer asked to skip',
  WEATHER: 'Rain / bad weather',
  NO_WATER_OR_ACCESS: 'No water or parking access',
  CUSTOMER_UNREACHABLE: 'Customer not reachable',
  STAFF_ABSENT: 'Staff absent',
  OTHER: 'Other',
};

export const COMPLAINT_TYPE_LABEL: Record<ComplaintType, string> = {
  WASH_QUALITY: 'Wash quality not good',
  STAFF_LATE: 'Staff came late',
  WASH_NOT_DONE: 'Wash not done',
  PAYMENT_ISSUE: 'Payment issue',
  STAFF_BEHAVIOUR: 'Staff behaviour',
  REFUND_DEMAND: 'Refund demand',
  OTHER: 'Other',
};

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  CASH: 'Cash',
  MANUAL_UPI: 'Manual UPI',
  GATEWAY: 'Online gateway',
};

export const EXPENSE_HEAD_LABEL: Record<ExpenseHead, string> = {
  STAFF_PAYOUT: 'Staff payments',
  GOODS: 'Car wash goods',
  MARKETING: 'Marketing',
  STATIONERY: 'Stationery',
  RND: 'R & D',
  OTHER: 'Other',
};

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
  SUN: 'Sun',
};

/** "Mon, Thu" style summary of a car's weekly wash days, in Mon→Sun order. */
export function summarizeWeeklyDays(days: Weekday[]): string {
  if (!days || days.length === 0) return 'No days set';
  const order: Weekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  return order
    .filter((d) => days.includes(d))
    .map((d) => WEEKDAY_SHORT[d])
    .join(', ');
}

export const LANGUAGE_LABEL: Record<Language, string> = {
  en: 'English',
  hi: 'हिंदी',
  mr: 'मराठी',
};
