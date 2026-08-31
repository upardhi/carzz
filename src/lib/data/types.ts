/**
 * Domain model for Carz Management.
 *
 * These types are storage-agnostic on purpose: ids are opaque strings, dates
 * are ISO strings, and money is a whole number of paise-free rupees. A
 * relational adapter maps them to tables; the Firestore adapter maps them to
 * documents. Nothing above this file knows which one is in play.
 */

export type Id = string;
/** ISO-8601 date-time, always UTC. */
export type Timestamp = string;
/** ISO-8601 calendar date, `YYYY-MM-DD`. */
export type DateOnly = string;
/** Whole rupees. */
export type Rupees = number;

/* -------------------------------------------------------------------------- */
/* Roles & identity                                                           */
/* -------------------------------------------------------------------------- */

export const ROLES = [
  'SUPER_ADMIN',
  'AREA_ADMIN',
  'MANAGER',
  'EMPLOYEE',
  'CUSTOMER',
] as const;
export type Role = (typeof ROLES)[number];

export type Language = 'en' | 'hi' | 'mr';

export interface User {
  id: Id;
  name: string;
  email: string;
  phone: string;
  role: Role;
  /** Region an AREA_ADMIN oversees. Null for every other role. */
  regionId: Id | null;
  /** Area a MANAGER or EMPLOYEE belongs to. Null for admins and customers. */
  areaId: Id | null;
  /** Customer record backing a CUSTOMER login. Null otherwise. */
  customerId: Id | null;
  /** Staff record backing a MANAGER or EMPLOYEE login. Null otherwise. */
  staffId: Id | null;
  language: Language;
  active: boolean;
  createdAt: Timestamp;
}

/** A user plus its bcrypt/scrypt password hash. Never leaves the data layer. */
export interface UserCredential {
  userId: Id;
  passwordHash: string;
}

/* -------------------------------------------------------------------------- */
/* Org structure                                                              */
/* -------------------------------------------------------------------------- */

/** A cluster of areas owned by one Area Admin. */
export interface Region {
  id: Id;
  name: string;
  areaAdminId: Id | null;
  createdAt: Timestamp;
}

export interface Area {
  id: Id;
  regionId: Id;
  name: string;
  city: string;
  managerId: Id | null;
  createdAt: Timestamp;
}

/* -------------------------------------------------------------------------- */
/* Staff                                                                      */
/* -------------------------------------------------------------------------- */

export interface Staff {
  id: Id;
  userId: Id;
  name: string;
  phone: string;
  areaId: Id;
  role: Extract<Role, 'MANAGER' | 'EMPLOYEE'>;
  joinedOn: DateOnly;
  /** Staff id of whoever referred them, for the referral bonus. */
  referredByStaffId: Id | null;
  active: boolean;
}

export interface Attendance {
  id: Id;
  staffId: Id;
  date: DateOnly;
  loginAt: Timestamp | null;
  status: 'PRESENT' | 'ABSENT' | 'OFF' | 'OFF_UNINFORMED';
  note: string | null;
}

export type PocketRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface PocketMoneyRequest {
  id: Id;
  staffId: Id;
  amount: Rupees;
  status: PocketRequestStatus;
  requestedAt: Timestamp;
  decidedAt: Timestamp | null;
  decidedByUserId: Id | null;
  /** Set when a manager approves a request that breaches the weekly cap. */
  overrodeCap: boolean;
  note: string | null;
}

/* -------------------------------------------------------------------------- */
/* Customers, cars, packages                                                  */
/* -------------------------------------------------------------------------- */

export const LEAD_SOURCES = [
  'GUARD_REF',
  'CUSTOMER_REF',
  'STAFF_REF',
  'DETAILING_CENTRE',
  'ONLINE_ADS',
  'WEBSITE',
  'PAMPHLET',
  'OTHER',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export type CustomerStatus = 'ACTIVE' | 'HOLD' | 'INACTIVE';

export interface Customer {
  id: Id;
  userId: Id | null;
  areaId: Id;
  name: string;
  phone: string;
  altPhone: string | null;
  address: string;
  landmark: string | null;
  lat: number | null;
  lng: number | null;
  source: LeadSource;
  /** Staff id when source is STAFF_REF, customer id when CUSTOMER_REF. */
  referredById: Id | null;
  status: CustomerStatus;
  holdUntil: DateOnly | null;
  note: string | null;
  joinedOn: DateOnly;
}

export interface ServicePackage {
  id: Id;
  name: string;
  /** Washes (or visits, for detailing) included per month. */
  washesPerMonth: number;
  price: Rupees;
  /** Internal delivery cost per month, used for margin reporting. */
  costToDeliver: Rupees;
  services: string[];
  active: boolean;
}

export const WEEKDAY_PATTERNS = [
  'MON_THU',
  'TUE_FRI',
  'WED_SAT',
  'THU_SUN',
] as const;
export type WeekdayPattern = (typeof WEEKDAY_PATTERNS)[number];

export interface Car {
  id: Id;
  customerId: Id;
  model: string;
  make: string;
  colour: string;
  plate: string;
  packageId: Id;
  /** Staff id of the wash boy who normally services this car. */
  assignedStaffId: Id | null;
  schedulePattern: WeekdayPattern;
  /** `HH:mm`, 24-hour. */
  scheduleTime: string;
  specialInstructions: string | null;
  active: boolean;
}

/* -------------------------------------------------------------------------- */
/* Wash visits                                                                */
/* -------------------------------------------------------------------------- */

export type VisitStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'MISSED';

export const MISS_REASONS = [
  'CAR_NOT_AVAILABLE',
  'CUSTOMER_SKIPPED',
  'WEATHER',
  'NO_WATER_OR_ACCESS',
  'CUSTOMER_UNREACHABLE',
  'STAFF_ABSENT',
  'OTHER',
] as const;
export type MissReason = (typeof MISS_REASONS)[number];

export interface WashVisit {
  id: Id;
  carId: Id;
  customerId: Id;
  areaId: Id;
  staffId: Id | null;
  /** The billing month this visit is drawn from, `YYYY-MM`. */
  cycle: string;
  scheduledDate: DateOnly;
  /** `HH:mm`. */
  scheduledTime: string;
  status: VisitStatus;
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  servicesDone: string[];
  beforePhotoUrl: string | null;
  afterPhotoUrl: string | null;
  missReason: MissReason | null;
  missNote: string | null;
  /** Set when a missed visit is regenerated, pointing at the replacement. */
  rescheduledToVisitId: Id | null;
  rating: number | null;
  ratingComment: string | null;
  /** True when the visit was closed within its scheduled slot. */
  onTime: boolean;
}

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

export type PaymentMode = 'CASH' | 'MANUAL_UPI' | 'GATEWAY';
export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REFUNDED';
export type PaymentKind = 'ADVANCE' | 'PACKAGE' | 'REFUND' | 'ADJUSTMENT';

export interface Payment {
  id: Id;
  customerId: Id;
  areaId: Id;
  amount: Rupees;
  kind: PaymentKind;
  mode: PaymentMode;
  status: PaymentStatus;
  cycle: string;
  recordedByUserId: Id | null;
  reference: string | null;
  note: string | null;
  createdAt: Timestamp;
}

/** A month's bill for one customer account, across all their cars. */
export interface Invoice {
  id: Id;
  customerId: Id;
  areaId: Id;
  cycle: string;
  amount: Rupees;
  dueOn: DateOnly;
  paidAmount: Rupees;
  status: 'OPEN' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'WRITTEN_OFF';
  createdAt: Timestamp;
}

export const EXPENSE_HEADS = [
  'STAFF_PAYOUT',
  'GOODS',
  'MARKETING',
  'STATIONERY',
  'RND',
  'OTHER',
] as const;
export type ExpenseHead = (typeof EXPENSE_HEADS)[number];

export interface Expense {
  id: Id;
  areaId: Id | null;
  head: ExpenseHead;
  amount: Rupees;
  cycle: string;
  note: string | null;
  recordedByUserId: Id;
  createdAt: Timestamp;
}

/* -------------------------------------------------------------------------- */
/* Payout                                                                     */
/* -------------------------------------------------------------------------- */

/** Company-wide payout rules. Editable by the Super Admin. */
export interface PayoutSettings {
  id: 'default';
  /**
   * How the base pay per wash is worked out.
   *
   *   PER_WASH  — a flat rate for every wash, whatever the day's order.
   *   DAY_SLAB  — a rising rate by the car's position in that day's route,
   *               which rewards a boy for taking a fuller round.
   *
   * The client has not settled which of these applies, so both are supported
   * and the Super Admin can switch between them without a code change. The
   * figures differ by roughly 3x, so this is the single most consequential
   * setting in the system.
   */
  baseMode: 'PER_WASH' | 'DAY_SLAB';
  /** Used when baseMode is PER_WASH. */
  perWashRate: Rupees;
  /** Used when baseMode is DAY_SLAB: rate by position in the day, 1-indexed. */
  slabByCarIndex: Rupees[];
  /** Applied beyond the last slab entry. */
  slabBeyond: Rupees;
  onTimeBonus: Rupees;
  goodReviewBonus: Rupees;
  goodReviewMinStars: number;
  carReferralBonus: Rupees;
  staffReferralBonus: Rupees;
  offsAllowedPerMonth: number;
  extraOffPenalty: Rupees;
  uninformedLeavePenalty: Rupees;
  pocketWeeklyCapPercent: number;
  pocketMinimumBalance: Rupees;
}

export interface PayoutLine {
  label: string;
  qty: number;
  rate: Rupees | null;
  amount: Rupees;
  kind: 'EARNING' | 'DEDUCTION';
  detail?: string;
}

export type PayoutStatus = 'DRAFT' | 'APPROVED' | 'PAID' | 'HELD';

export interface StaffPayout {
  id: Id;
  staffId: Id;
  areaId: Id;
  cycle: string;
  washes: number;
  base: Rupees;
  bonuses: Rupees;
  referrals: Rupees;
  deductions: Rupees;
  pocketTaken: Rupees;
  net: Rupees;
  lines: PayoutLine[];
  status: PayoutStatus;
  approvedByUserId: Id | null;
  approvedAt: Timestamp | null;
}

/* -------------------------------------------------------------------------- */
/* Complaints                                                                 */
/* -------------------------------------------------------------------------- */

export const COMPLAINT_TYPES = [
  'WASH_QUALITY',
  'STAFF_LATE',
  'WASH_NOT_DONE',
  'PAYMENT_ISSUE',
  'STAFF_BEHAVIOUR',
  'REFUND_DEMAND',
  'OTHER',
] as const;
export type ComplaintType = (typeof COMPLAINT_TYPES)[number];

export type ComplaintStatus = 'OPEN' | 'ESCALATED' | 'RESOLVED';

export interface Complaint {
  id: Id;
  customerId: Id;
  areaId: Id;
  staffId: Id | null;
  visitId: Id | null;
  type: ComplaintType;
  body: string;
  status: ComplaintStatus;
  resolution: string | null;
  createdAt: Timestamp;
  resolvedAt: Timestamp | null;
  handledByUserId: Id | null;
}

/* -------------------------------------------------------------------------- */
/* Inventory                                                                  */
/* -------------------------------------------------------------------------- */

export interface InventoryItem {
  id: Id;
  name: string;
  unit: string;
  /** Consumption per wash in `unit`, used to project days of cover. */
  usagePerWash: number;
  reorderLevel: number;
  unitCost: Rupees;
  active: boolean;
}

export interface StockLevel {
  id: Id;
  areaId: Id;
  itemId: Id;
  quantity: number;
  updatedAt: Timestamp;
}

export type PurchaseRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'RECEIVED';

export interface PurchaseRequest {
  id: Id;
  code: string;
  areaId: Id;
  itemId: Id;
  quantity: number;
  estimatedCost: Rupees;
  neededBy: DateOnly;
  reason: string | null;
  status: PurchaseRequestStatus;
  raisedByUserId: Id;
  decidedByUserId: Id | null;
  createdAt: Timestamp;
  decidedAt: Timestamp | null;
}

export interface StockIssue {
  id: Id;
  areaId: Id;
  itemId: Id;
  staffId: Id;
  quantity: number;
  issuedByUserId: Id;
  createdAt: Timestamp;
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export interface AppSettings {
  id: 'default';
  photoRetentionMonths: number;
  requireBothPhotos: boolean;
  missedWashReturnsToCount: boolean;
  paymentModesEnabled: PaymentMode[];
  reminderDaysBeforeDue: number;
  reminderChannel: 'WHATSAPP' | 'SMS' | 'PUSH';
  autoApprovePurchaseUnder: Rupees;
  teaBreakMinutes: number;
  languages: Language[];
}

/* -------------------------------------------------------------------------- */
/* Public website                                                             */
/* -------------------------------------------------------------------------- */

export interface Testimonial {
  id: Id;
  name: string;
  area: string;
  quote: string;
  rating: number;
  /** Hidden testimonials stay stored, so they can be brought back. */
  visible: boolean;
  order: number;
}

export interface SiteFeature {
  id: Id;
  title: string;
  body: string;
  /** Name of an icon in the site's icon set. */
  icon: string;
  order: number;
}

/**
 * Everything on the public website that the Super Admin controls.
 *
 * Deliberately a single record: the site is one page of marketing copy, and
 * one row that is read whole is simpler to edit and to reason about than a
 * block system nobody asked for. Package prices are NOT copied in here —
 * the site reads them from `ServicePackage`, so what is advertised is always
 * what gets billed.
 */
export interface SiteContent {
  id: 'default';

  /** Banner */
  heroEyebrow: string;
  heroTitle: string;
  /** Rendered in the accent colour under the title. */
  heroTitleAccent: string;
  heroBody: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;

  /** Numbers under the banner, e.g. "500+ cars washed". */
  stats: { label: string; value: string }[];

  /** "How it works" */
  howTitle: string;
  howSteps: { title: string; body: string }[];

  /** "Why us" */
  featuresTitle: string;
  features: SiteFeature[];

  /** Packages section */
  packagesTitle: string;
  packagesBody: string;
  /** Which packages to advertise. Empty means every active one. */
  visiblePackageIds: Id[];

  /** Areas served */
  areasTitle: string;
  areasBody: string;

  testimonialsTitle: string;
  testimonials: Testimonial[];

  /** Enquiry form */
  contactTitle: string;
  contactBody: string;

  /** Contact details shown in the footer */
  phone: string;
  whatsapp: string;
  email: string;
  addressLine: string;

  /** Search engines and link previews */
  seoTitle: string;
  seoDescription: string;

  /** Take the site offline without deleting anything. */
  published: boolean;
  updatedAt: Timestamp;
  updatedByUserId: Id | null;
}

export type EnquiryStatus = 'NEW' | 'CONTACTED' | 'CONVERTED' | 'LOST';

/**
 * Someone asking for a wash through the website.
 *
 * Converting one creates a customer with `source: 'WEBSITE'`, which is what
 * makes the lead-source report able to say what the site is actually worth
 * against guards and referrals.
 */
export interface Enquiry {
  id: Id;
  name: string;
  phone: string;
  email: string | null;
  areaId: Id | null;
  /** Free text: the customer's own words about where they are. */
  locality: string | null;
  carCount: number;
  packageId: Id | null;
  message: string | null;
  status: EnquiryStatus;
  /** Set once a manager turns this into a real customer. */
  convertedCustomerId: Id | null;
  handledByUserId: Id | null;
  createdAt: Timestamp;
  handledAt: Timestamp | null;
}

export interface Notification {
  id: Id;
  userId: Id;
  title: string;
  body: string;
  href: string | null;
  readAt: Timestamp | null;
  createdAt: Timestamp;
}
