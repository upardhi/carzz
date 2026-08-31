import type {
  ComplaintType,
  ExpenseHead,
  LeadSource,
  Language,
  MissReason,
  PaymentMode,
  Role,
  WeekdayPattern,
} from '../data/types';

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  AREA_ADMIN: 'Area Admin',
  MANAGER: 'Manager',
  EMPLOYEE: 'Wash Staff',
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

export const PATTERN_LABEL: Record<WeekdayPattern, string> = {
  MON_THU: 'Monday / Thursday',
  TUE_FRI: 'Tuesday / Friday',
  WED_SAT: 'Wednesday / Saturday',
  THU_SUN: 'Thursday / Sunday',
};

export const PATTERN_SHORT: Record<WeekdayPattern, string> = {
  MON_THU: 'Mon/Thu',
  TUE_FRI: 'Tue/Fri',
  WED_SAT: 'Wed/Sat',
  THU_SUN: 'Thu/Sun',
};

export const LANGUAGE_LABEL: Record<Language, string> = {
  en: 'English',
  hi: 'हिंदी',
  mr: 'मराठी',
};
