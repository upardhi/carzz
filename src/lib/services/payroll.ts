import 'server-only';

import type { DataStore } from '../data/ports/store';
import type {
  Attendance,
  Id,
  PayoutLine,
  PayoutSettings,
  PocketMoneyRequest,
  Rupees,
  Staff,
  StaffPayout,
  WashVisit,
} from '../data/types';

function calculatePayoutRecord({
  staff,
  rules,
  cycle,
  visits,
  attendance,
  pocket,
  referredStaff,
  carsReferred,
  existing,
}: {
  staff: Staff;
  rules: PayoutSettings;
  cycle: string;
  visits: WashVisit[];
  attendance: Attendance[];
  pocket: PocketMoneyRequest[];
  referredStaff: Staff[];
  carsReferred: number;
  existing: StaffPayout | null;
}): StaffPayout {
  /* --- base pay, by whichever rule the owner has set --- */
  let base = 0;
  if (rules.baseMode === 'DAY_SLAB') {
    // A rising rate by the car's position in that day's route.
    const byDate = new Map<string, number>();
    for (const visit of [...visits].sort((a, b) =>
      a.scheduledDate.localeCompare(b.scheduledDate) ||
      a.scheduledTime.localeCompare(b.scheduledTime),
    )) {
      const index = byDate.get(visit.scheduledDate) ?? 0;
      byDate.set(visit.scheduledDate, index + 1);
      base += rules.slabByCarIndex[index] ?? rules.slabBeyond;
    }
  } else {
    base = visits.length * rules.perWashRate;
  }

  /* --- bonuses --- */
  const onTime = visits.filter((v) => v.onTime).length;
  const goodReviews = visits.filter(
    (v) => (v.rating ?? 0) >= rules.goodReviewMinStars,
  ).length;

  const onTimeAmount = onTime * rules.onTimeBonus;
  const reviewAmount = goodReviews * rules.goodReviewBonus;

  /* --- referrals --- */
  const cycleStart = `${cycle}-01`;
  const cycleEnd = `${cycle}-31`;
  const staffReferred = referredStaff.filter(
    (s) => s.joinedOn >= cycleStart && s.joinedOn <= cycleEnd,
  ).length;

  const carReferralAmount = carsReferred * rules.carReferralBonus;
  const staffReferralAmount = staffReferred * rules.staffReferralBonus;

  /* --- deductions --- */
  const cycleAttendance = attendance.filter((a) => a.date.startsWith(cycle));
  const offs = cycleAttendance.filter((a) => a.status === 'OFF').length;
  const uninformed = cycleAttendance.filter(
    (a) => a.status === 'OFF_UNINFORMED',
  ).length;
  // The allowance is free, the next one is a warning only, and every off after
  // that is charged — matching the rules the client already runs by hand.
  const chargeableOffs = Math.max(0, offs - rules.offsAllowedPerMonth - 1);
  const offPenalty = chargeableOffs * rules.extraOffPenalty;
  const uninformedPenalty = uninformed * rules.uninformedLeavePenalty;

  const pocketTaken = pocket
    .filter((p) => p.requestedAt.slice(0, 7) === cycle)
    .reduce((sum, p) => sum + p.amount, 0);

  const lines: PayoutLine[] = [
    {
      label: 'Washes completed',
      qty: visits.length,
      rate: null,
      amount: base,
      kind: 'EARNING',
      detail:
        rules.baseMode === 'DAY_SLAB'
          ? `Slab ${rules.slabByCarIndex.join(' / ')} by car position in the day`
          : `Flat rate of ${rules.perWashRate} per wash`,
    },
    {
      label: 'On-time bonus',
      qty: onTime,
      rate: rules.onTimeBonus,
      amount: onTimeAmount,
      kind: 'EARNING',
    },
    {
      label: `Good review bonus (${rules.goodReviewMinStars}★ and above)`,
      qty: goodReviews,
      rate: rules.goodReviewBonus,
      amount: reviewAmount,
      kind: 'EARNING',
    },
    {
      label: 'New car referred',
      qty: carsReferred,
      rate: rules.carReferralBonus,
      amount: carReferralAmount,
      kind: 'EARNING',
    },
    {
      label: 'New staff referred',
      qty: staffReferred,
      rate: rules.staffReferralBonus,
      amount: staffReferralAmount,
      kind: 'EARNING',
    },
  ];

  if (offPenalty > 0) {
    lines.push({
      label: 'Extra offs beyond allowance',
      qty: chargeableOffs,
      rate: rules.extraOffPenalty,
      amount: offPenalty,
      kind: 'DEDUCTION',
      detail: `${offs} offs taken, ${rules.offsAllowedPerMonth} allowed, 1 warning`,
    });
  }
  if (uninformedPenalty > 0) {
    lines.push({
      label: 'Leave without informing',
      qty: uninformed,
      rate: rules.uninformedLeavePenalty,
      amount: uninformedPenalty,
      kind: 'DEDUCTION',
    });
  }
  if (pocketTaken > 0) {
    lines.push({
      label: 'Pocket money already taken',
      qty: pocket.filter((p) => p.requestedAt.slice(0, 7) === cycle).length,
      rate: null,
      amount: pocketTaken,
      kind: 'DEDUCTION',
    });
  }

  const bonuses = onTimeAmount + reviewAmount;
  const referrals = carReferralAmount + staffReferralAmount;
  const deductions = offPenalty + uninformedPenalty;
  const net = base + bonuses + referrals - deductions - pocketTaken;

  return {
    id: existing?.id ?? `pyt_${staff.id}_${cycle}`,
    staffId: staff.id,
    areaId: staff.areaId,
    cycle,
    washes: visits.length,
    base,
    bonuses,
    referrals,
    deductions,
    pocketTaken,
    net,
    lines,
    status: existing?.status ?? 'DRAFT',
    approvedByUserId: existing?.approvedByUserId ?? null,
    approvedAt: existing?.approvedAt ?? null,
  };
}

/**
 * Computes one wash boy's pay for a cycle, line by line.
 *
 * Every figure is derived from recorded events — completed visits, ratings,
 * attendance, pocket withdrawals — so a disputed payslip can always be traced
 * back to the day it came from. Nothing here writes; approval is a separate,
 * deliberate step by the Super Admin.
 */
export async function computePayout(
  store: DataStore,
  staffId: Id,
  cycle: string,
  settings?: PayoutSettings,
): Promise<StaffPayout> {
  const rules = settings ?? (await store.getPayoutSettings());
  const staff = await store.staff.get(staffId);
  if (!staff) throw new Error(`Staff ${staffId} not found`);

  const cycleStart = `${cycle}-01`;
  const cycleEnd = `${cycle}-31`;

  const [visits, attendance, pocket, referredStaff, carsReferred, existing] =
    await Promise.all([
      store.visits.find({ where: { staffId, cycle, status: 'DONE' } }),
      store.attendance.find({ where: { staffId } }),
      store.pocketRequests.find({
        where: { staffId, status: { in: ['APPROVED', 'PAID'] } } as never,
      }),
      store.staff.find({ where: { referredByStaffId: staffId } }),
      store.customers.count({
        referredById: staffId,
        joinedOn: { gte: cycleStart, lte: cycleEnd },
      } as never),
      store.payouts.findOne({ where: { staffId, cycle } }),
    ]);

  return calculatePayoutRecord({
    staff,
    rules,
    cycle,
    visits,
    attendance,
    pocket,
    referredStaff,
    carsReferred,
    existing,
  });
}

interface PayoutRunCacheEntry {
  data: Promise<StaffPayout[]>;
  expires: number;
}

const payoutRunCache: Map<string, PayoutRunCacheEntry> =
  ((globalThis as unknown as { __payoutRunCache?: Map<string, PayoutRunCacheEntry> })
    .__payoutRunCache ??= new Map());

export function invalidatePayoutRunCache(): void {
  payoutRunCache.clear();
}

/** Every employee's payout for a cycle, within an access scope. */
export function computePayoutRun(
  store: DataStore,
  cycle: string,
  areaIds: Id[] | null,
): Promise<StaffPayout[]> {
  const cacheKey = `${cycle}:${areaIds ? areaIds.slice().sort().join(',') : 'all'}`;
  const now = Date.now();
  const cached = payoutRunCache.get(cacheKey);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  const promise = _computePayoutRunInternal(store, cycle, areaIds).catch((err) => {
    payoutRunCache.delete(cacheKey);
    throw err;
  });

  payoutRunCache.set(cacheKey, {
    data: promise,
    expires: now + 60_000,
  });

  return promise;
}

async function _computePayoutRunInternal(
  store: DataStore,
  cycle: string,
  areaIds: Id[] | null,
): Promise<StaffPayout[]> {
  const [settings, staff] = await Promise.all([
    store.getPayoutSettings(),
    store.staff.find({
      where: {
        role: 'EMPLOYEE',
        active: true,
        ...(areaIds ? { areaId: { in: areaIds } } : {}),
      } as never,
    }),
  ]);

  if (staff.length === 0) return [];

  const staffIds = staff.map((s) => s.id);
  const cycleStart = `${cycle}-01`;
  const cycleEnd = `${cycle}-31`;

  // Bulk queries: instead of N queries x 7 tables, fetch the batch once.
  const [
    allVisits,
    allAttendance,
    allPocket,
    allReferredStaff,
    allReferredCustomers,
    allExisting,
  ] = await Promise.all([
    store.visits.find({
      where: {
        staffId: { in: staffIds },
        cycle,
        status: 'DONE',
      } as never,
    }),
    store.attendance.find({
      where: {
        staffId: { in: staffIds },
        date: { gte: cycleStart, lte: cycleEnd },
      } as never,
    }),
    store.pocketRequests.find({
      where: {
        staffId: { in: staffIds },
        status: { in: ['APPROVED', 'PAID'] },
      } as never,
    }),
    store.staff.find({
      where: {
        referredByStaffId: { in: staffIds },
      } as never,
    }),
    store.customers.find({
      where: {
        referredById: { in: staffIds },
        joinedOn: { gte: cycleStart, lte: cycleEnd },
      } as never,
    }),
    store.payouts.find({
      where: {
        staffId: { in: staffIds },
        cycle,
      } as never,
    }),
  ]);

  // Group into memory Maps for instant lookup
  const visitsByStaff = new Map<Id, WashVisit[]>();
  for (const v of allVisits) {
    if (!v.staffId) continue;
    const list = visitsByStaff.get(v.staffId) ?? [];
    list.push(v);
    visitsByStaff.set(v.staffId, list);
  }

  const attendanceByStaff = new Map<Id, Attendance[]>();
  for (const a of allAttendance) {
    const list = attendanceByStaff.get(a.staffId) ?? [];
    list.push(a);
    attendanceByStaff.set(a.staffId, list);
  }

  const pocketByStaff = new Map<Id, PocketMoneyRequest[]>();
  for (const p of allPocket) {
    const list = pocketByStaff.get(p.staffId) ?? [];
    list.push(p);
    pocketByStaff.set(p.staffId, list);
  }

  const referredStaffByStaff = new Map<Id, Staff[]>();
  for (const s of allReferredStaff) {
    if (!s.referredByStaffId) continue;
    const list = referredStaffByStaff.get(s.referredByStaffId) ?? [];
    list.push(s);
    referredStaffByStaff.set(s.referredByStaffId, list);
  }

  const carsReferredCountByStaff = new Map<Id, number>();
  for (const c of allReferredCustomers) {
    if (!c.referredById) continue;
    carsReferredCountByStaff.set(
      c.referredById,
      (carsReferredCountByStaff.get(c.referredById) ?? 0) + 1,
    );
  }

  const existingByStaff = new Map<Id, StaffPayout>(
    allExisting.map((p) => [p.staffId, p]),
  );

  const payouts = staff.map((s) =>
    calculatePayoutRecord({
      staff: s,
      rules: settings,
      cycle,
      visits: visitsByStaff.get(s.id) ?? [],
      attendance: attendanceByStaff.get(s.id) ?? [],
      pocket: pocketByStaff.get(s.id) ?? [],
      referredStaff: referredStaffByStaff.get(s.id) ?? [],
      carsReferred: carsReferredCountByStaff.get(s.id) ?? 0,
      existing: existingByStaff.get(s.id) ?? null,
    }),
  );

  return payouts.sort((a, b) => b.net - a.net);
}

/** Persists an approval so the payout stops being a live calculation. */
export async function approvePayout(
  store: DataStore,
  payout: StaffPayout,
  approvedByUserId: Id,
): Promise<StaffPayout> {
  invalidatePayoutRunCache();
  const record = {
    ...payout,
    status: 'APPROVED' as const,
    approvedByUserId,
    approvedAt: new Date().toISOString(),
  };

  const existing = await store.payouts.findOne({
    where: { staffId: payout.staffId, cycle: payout.cycle },
  });

  return existing
    ? store.payouts.update(existing.id, record)
    : store.payouts.create(record);
}

/* -------------------------------------------------------------------------- */
/* Pocket money                                                               */
/* -------------------------------------------------------------------------- */

export interface PocketAllowance {
  earnedThisCycle: Rupees;
  takenThisWeek: Rupees;
  weeklyCap: Rupees;
  inAccount: Rupees;
  available: Rupees;
}

/**
 * How much a wash boy may withdraw right now.
 *
 * Two rules apply together: at most a percentage of the cycle's earnings per
 * week, and never below the minimum balance that must stay in the account.
 */
export async function pocketAllowance(
  store: DataStore,
  staffId: Id,
  cycle: string,
  precomputedPayout?: StaffPayout,
): Promise<PocketAllowance> {
  const rules = await store.getPayoutSettings();
  const payout =
    precomputedPayout ?? (await computePayout(store, staffId, cycle, rules));

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const requests = await store.pocketRequests.find({
    where: { staffId, status: { in: ['APPROVED', 'PAID'] } } as never,
  });
  const takenThisWeek = requests
    .filter((r) => r.requestedAt >= weekAgo)
    .reduce((sum, r) => sum + r.amount, 0);

  const earned = payout.base + payout.bonuses + payout.referrals;
  const weeklyCap = Math.round((earned * rules.pocketWeeklyCapPercent) / 100);
  const inAccount = Math.max(0, payout.net);

  const available = Math.max(
    0,
    Math.min(
      weeklyCap - takenThisWeek,
      inAccount - rules.pocketMinimumBalance,
    ),
  );

  return { earnedThisCycle: earned, takenThisWeek, weeklyCap, inAccount, available };
}
