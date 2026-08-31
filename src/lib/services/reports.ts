import 'server-only';

import type { DataStore } from '../data/ports/store';
import type {
  Area,
  Id,
  LeadSource,
  MissReason,
  Rupees,
} from '../data/types';
import { computePayoutRun } from './payroll';

export interface AreaPerformance {
  area: Area;
  customers: number;
  activeCars: number;
  staff: number;
  washesDone: number;
  washesMissed: number;
  billed: Rupees;
  collected: Rupees;
  outstanding: Rupees;
  goodsCost: Rupees;
  payoutCost: Rupees;
  profit: Rupees;
  margin: number;
  averageRating: number;
  openComplaints: number;
}

/**
 * Per-area P&L and service quality for one cycle.
 *
 * Cost is payout plus consumables, so the margin shown is the one the owner
 * actually banks — which is what makes a weak area visible rather than merely
 * a low-revenue one.
 */
export async function areaPerformance(
  store: DataStore,
  cycle: string,
  areaIds: Id[] | null,
): Promise<AreaPerformance[]> {
  const areas = (await store.areas.find({ orderBy: [{ field: 'name' }] })).filter(
    (a) => areaIds === null || areaIds.includes(a.id),
  );

  const [payouts, items] = await Promise.all([
    computePayoutRun(store, cycle, areaIds),
    store.inventoryItems.find(),
  ]);
  const itemCost = new Map(items.map((i) => [i.id, i]));

  return Promise.all(
    areas.map(async (area) => {
      const [customers, cars, staff, visits, invoices, complaints, issues] =
        await Promise.all([
          store.customers.find({ where: { areaId: area.id } }),
          store.cars.find({ where: { active: true } }),
          store.staff.find({ where: { areaId: area.id, role: 'EMPLOYEE' } }),
          store.visits.find({ where: { areaId: area.id, cycle } }),
          store.invoices.find({ where: { areaId: area.id, cycle } }),
          store.complaints.find({
            where: { areaId: area.id, status: { in: ['OPEN', 'ESCALATED'] } } as never,
          }),
          store.stockIssues.find({ where: { areaId: area.id } }),
        ]);

      const customerIds = new Set(customers.map((c) => c.id));
      const activeCars = cars.filter((c) => customerIds.has(c.customerId));

      const done = visits.filter((v) => v.status === 'DONE');
      const missed = visits.filter((v) => v.status === 'MISSED');
      const rated = done.filter((v) => v.rating !== null);

      const billed = invoices.reduce((sum, i) => sum + i.amount, 0);
      const collected = invoices.reduce((sum, i) => sum + i.paidAmount, 0);

      const goodsCost = issues.reduce(
        (sum, i) => sum + i.quantity * (itemCost.get(i.itemId)?.unitCost ?? 0),
        0,
      );
      const payoutCost = payouts
        .filter((p) => p.areaId === area.id)
        .reduce((sum, p) => sum + p.net, 0);

      const profit = collected - goodsCost - payoutCost;

      return {
        area,
        customers: customers.filter((c) => c.status !== 'INACTIVE').length,
        activeCars: activeCars.length,
        staff: staff.length,
        washesDone: done.length,
        washesMissed: missed.length,
        billed,
        collected,
        outstanding: billed - collected,
        goodsCost,
        payoutCost,
        profit,
        margin: collected > 0 ? profit / collected : 0,
        averageRating: rated.length
          ? rated.reduce((sum, v) => sum + (v.rating ?? 0), 0) / rated.length
          : 0,
        openComplaints: complaints.length,
      };
    }),
  );
}

export interface LeadSourceRow {
  source: LeadSource;
  joined: number;
  stillActive: number;
  retention: number;
  cost: Rupees;
  costPerActiveCar: Rupees;
}

/**
 * Which reference actually brings customers who stay.
 *
 * Referral costs come from the payout rules rather than a hardcoded table, so
 * the moment the owner changes a bonus this report follows.
 */
export async function leadSourceReport(
  store: DataStore,
  areaIds: Id[] | null,
): Promise<LeadSourceRow[]> {
  const [customers, rules, expenses] = await Promise.all([
    store.customers.find(
      areaIds ? { where: { areaId: { in: areaIds } } as never } : undefined,
    ),
    store.getPayoutSettings(),
    store.expenses.find({ where: { head: 'MARKETING' } }),
  ]);

  const marketingSpend = expenses.reduce((sum, e) => sum + e.amount, 0);
  const paidChannels: LeadSource[] = ['ONLINE_ADS', 'PAMPHLET'];

  const grouped = new Map<LeadSource, { joined: number; active: number }>();
  for (const customer of customers) {
    const entry = grouped.get(customer.source) ?? { joined: 0, active: 0 };
    entry.joined += 1;
    if (customer.status === 'ACTIVE') entry.active += 1;
    grouped.set(customer.source, entry);
  }

  const paidJoined = paidChannels.reduce(
    (sum, s) => sum + (grouped.get(s)?.joined ?? 0),
    0,
  );

  const rows: LeadSourceRow[] = [];
  for (const [source, agg] of grouped) {
    let cost = 0;
    if (source === 'STAFF_REF') cost = agg.joined * rules.carReferralBonus;
    else if (paidChannels.includes(source) && paidJoined > 0) {
      // Split the marketing line across the paid channels by volume — the best
      // attribution available until per-campaign spend is tracked.
      cost = Math.round((marketingSpend * agg.joined) / paidJoined);
    }

    rows.push({
      source,
      joined: agg.joined,
      stillActive: agg.active,
      retention: agg.joined > 0 ? agg.active / agg.joined : 0,
      cost,
      costPerActiveCar: agg.active > 0 ? Math.round(cost / agg.active) : cost,
    });
  }

  return rows.sort((a, b) => a.costPerActiveCar - b.costPerActiveCar);
}

export interface MissedWashRow {
  reason: MissReason;
  count: number;
  costToDeliver: Rupees;
}

/**
 * What missed washes cost. Each one returns to the customer's count, so the
 * business delivers it later at no extra charge — a real cost that never
 * appears on an invoice.
 */
export async function missedWashReport(
  store: DataStore,
  cycle: string,
  areaIds: Id[] | null,
): Promise<{ rows: MissedWashRow[]; total: number; totalCost: Rupees }> {
  const [visits, packages, cars] = await Promise.all([
    store.visits.find({
      where: {
        cycle,
        status: 'MISSED',
        ...(areaIds ? { areaId: { in: areaIds } } : {}),
      } as never,
    }),
    store.packages.find(),
    store.cars.find(),
  ]);

  const packageById = new Map(packages.map((p) => [p.id, p]));
  const carById = new Map(cars.map((c) => [c.id, c]));

  const grouped = new Map<MissReason, { count: number; cost: number }>();
  for (const visit of visits) {
    const reason = visit.missReason ?? 'OTHER';
    const pkg = packageById.get(carById.get(visit.carId)?.packageId ?? '');
    const perWash = pkg ? pkg.costToDeliver / pkg.washesPerMonth : 0;
    const entry = grouped.get(reason) ?? { count: 0, cost: 0 };
    entry.count += 1;
    entry.cost += perWash;
    grouped.set(reason, entry);
  }

  const rows = [...grouped.entries()]
    .map(([reason, v]) => ({
      reason,
      count: v.count,
      costToDeliver: Math.round(v.cost),
    }))
    .sort((a, b) => b.count - a.count);

  return {
    rows,
    total: visits.length,
    totalCost: rows.reduce((sum, r) => sum + r.costToDeliver, 0),
  };
}

export interface StaffPerformanceRow {
  staffId: Id;
  name: string;
  areaId: Id;
  washes: number;
  onTimeRate: number;
  averageRating: number;
  missed: number;
  complaints: number;
}

export async function staffPerformance(
  store: DataStore,
  cycle: string,
  areaIds: Id[] | null,
): Promise<StaffPerformanceRow[]> {
  const staff = await store.staff.find({
    where: {
      role: 'EMPLOYEE',
      ...(areaIds ? { areaId: { in: areaIds } } : {}),
    } as never,
  });

  const rows = await Promise.all(
    staff.map(async (s) => {
      const [visits, complaints] = await Promise.all([
        store.visits.find({ where: { staffId: s.id, cycle } }),
        store.complaints.count({ staffId: s.id }),
      ]);

      const done = visits.filter((v) => v.status === 'DONE');
      const rated = done.filter((v) => v.rating !== null);

      return {
        staffId: s.id,
        name: s.name,
        areaId: s.areaId,
        washes: done.length,
        onTimeRate: done.length
          ? done.filter((v) => v.onTime).length / done.length
          : 0,
        averageRating: rated.length
          ? rated.reduce((sum, v) => sum + (v.rating ?? 0), 0) / rated.length
          : 0,
        missed: visits.filter((v) => v.status === 'MISSED').length,
        complaints,
      };
    }),
  );

  return rows.sort((a, b) => b.washes - a.washes);
}

export interface BusinessSummary {
  cycle: string;
  customers: number;
  activeCars: number;
  staff: number;
  collected: Rupees;
  billed: Rupees;
  outstanding: Rupees;
  expenses: Rupees;
  payoutCost: Rupees;
  profit: Rupees;
  margin: number;
  washesDone: number;
  washesMissed: number;
  averageRating: number;
  openComplaints: number;
  costPerWash: Rupees;
  revenuePerCar: Rupees;
}

export async function businessSummary(
  store: DataStore,
  cycle: string,
  areaIds: Id[] | null,
): Promise<BusinessSummary> {
  const areas = await areaPerformance(store, cycle, areaIds);
  const expenses = await store.expenses.find({ where: { cycle } });

  const collected = areas.reduce((s, a) => s + a.collected, 0);
  const billed = areas.reduce((s, a) => s + a.billed, 0);
  const payoutCost = areas.reduce((s, a) => s + a.payoutCost, 0);
  const washesDone = areas.reduce((s, a) => s + a.washesDone, 0);

  // Staff pay is already counted through payouts, so exclude that expense head
  // to avoid double-charging the month.
  const otherExpenses = expenses
    .filter((e) => e.head !== 'STAFF_PAYOUT')
    .reduce((s, e) => s + e.amount, 0);

  const totalCost = payoutCost + otherExpenses;
  const profit = collected - totalCost;
  const activeCars = areas.reduce((s, a) => s + a.activeCars, 0);
  const ratedAreas = areas.filter((a) => a.averageRating > 0);

  return {
    cycle,
    customers: areas.reduce((s, a) => s + a.customers, 0),
    activeCars,
    staff: areas.reduce((s, a) => s + a.staff, 0),
    collected,
    billed,
    outstanding: billed - collected,
    expenses: otherExpenses,
    payoutCost,
    profit,
    margin: collected > 0 ? profit / collected : 0,
    washesDone,
    washesMissed: areas.reduce((s, a) => s + a.washesMissed, 0),
    averageRating: ratedAreas.length
      ? ratedAreas.reduce((s, a) => s + a.averageRating, 0) / ratedAreas.length
      : 0,
    openComplaints: areas.reduce((s, a) => s + a.openComplaints, 0),
    costPerWash: washesDone > 0 ? Math.round(totalCost / washesDone) : 0,
    revenuePerCar: activeCars > 0 ? Math.round(collected / activeCars) : 0,
  };
}
