/**
 * Which columns of each model hold a date, and in which shape.
 *
 * The domain model carries dates as strings — `DateOnly` ("2026-08-31") and
 * `Timestamp` (a full ISO instant) — because a string survives JSON, a
 * Firestore document and a Postgres column alike. Postgres does not: Prisma
 * hands back `Date` objects. Without this map the rows returned by the Prisma
 * adapter would be a different shape from the ones the memory adapter returns,
 * and the code above the data layer — which sorts, slices and compares those
 * strings — would break on the real database only.
 *
 * `scripts/check-schema-dates.ts` checks this map against
 * `prisma/schema.prisma` so the two cannot drift; `npm run smoke` runs it.
 */
export interface DateFields {
  /** `DateTime @db.Date` columns — the domain carries "YYYY-MM-DD". */
  readonly dateOnly: readonly string[];
  /** `DateTime` columns — the domain carries a full ISO timestamp. */
  readonly timestamp: readonly string[];
}

export const NO_DATE_FIELDS: DateFields = { dateOnly: [], timestamp: [] };

const f = (dateOnly: string[], timestamp: string[]): DateFields => ({
  dateOnly,
  timestamp,
});

/** Keyed by the Prisma delegate name (the model name, camel-cased). */
export const DATE_FIELDS = {
  user: f([], ['createdAt']),
  userCredential: NO_DATE_FIELDS,
  region: f([], ['createdAt']),
  area: f([], ['createdAt']),
  staff: f(['joinedOn'], []),
  attendance: f(['date'], ['loginAt']),
  pocketMoneyRequest: f([], ['requestedAt', 'decidedAt']),
  customer: f(['holdUntil', 'joinedOn'], []),
  servicePackage: NO_DATE_FIELDS,
  car: NO_DATE_FIELDS,
  washVisit: f(['scheduledDate'], ['startedAt', 'completedAt']),
  payment: f([], ['createdAt']),
  invoice: f(['dueOn'], ['createdAt']),
  expense: f([], ['createdAt']),
  staffPayout: f([], ['approvedAt']),
  complaint: f([], ['createdAt', 'resolvedAt']),
  inventoryItem: NO_DATE_FIELDS,
  stockLevel: f([], ['updatedAt']),
  purchaseRequest: f(['neededBy'], ['createdAt', 'decidedAt']),
  stockIssue: f([], ['createdAt']),
  notification: f([], ['readAt', 'createdAt']),
  appSettings: NO_DATE_FIELDS,
  payoutSettings: NO_DATE_FIELDS,
  siteContent: f([], ['updatedAt']),
  enquiry: f([], ['createdAt', 'handledAt']),
} as const satisfies Record<string, DateFields>;

export type PrismaModelName = keyof typeof DATE_FIELDS;
