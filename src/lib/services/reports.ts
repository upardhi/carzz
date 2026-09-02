import 'server-only';

import type { DataStore } from '../data/ports/store';
import type {
  Area,
  Complaint,
  Customer,
  Id,
  Invoice,
  LeadSource,
  MissReason,
  Rupees,
  Staff,
  StaffPayout,
  StockIssue,
  WashVisit,
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
 * Profitability by area, for one billing cycle.
 *
 * Cost is payout plus consumables, so the margin shown is the one the owner
 * actually banks — which is what makes a weak area visible rather than merely
 * a low-revenue one.
 */
interface AreaPerfCacheEntry {
  data: Promise<AreaPerformance[]>;
  expires: number;
}

const areaPerfCache: Map<string, AreaPerfCacheEntry> =
  ((globalThis as unknown as { __areaPerfCache?: Map<string, AreaPerfCacheEntry> })
    .__areaPerfCache ??= new Map());

export function areaPerformance(
  store: DataStore,
  cycle: string,
  areaIds: Id[] | null,
  precomputedPayouts?: StaffPayout[],
  options?: { skipPayoutsAndGoods?: boolean },
): Promise<AreaPerformance[]> {
  if (precomputedPayouts) {
    return _computeAreaPerformance(store, cycle, areaIds, precomputedPayouts, options);
  }

  const cacheKey = `${cycle}:${areaIds ? areaIds.slice().sort().join(',') : 'all'}:${options?.skipPayoutsAndGoods ? 'fast' : 'full'}`;
  const now = Date.now();
  const cached = areaPerfCache.get(cacheKey);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  const promise = _computeAreaPerformance(store, cycle, areaIds, undefined, options).catch((err) => {
    areaPerfCache.delete(cacheKey);
    throw err;
  });

  areaPerfCache.set(cacheKey, {
    data: promise,
    expires: now + 60_000,
  });

  return promise;
}

async function _computeAreaPerformance(
  store: DataStore,
  cycle: string,
  areaIds: Id[] | null,
  precomputedPayouts?: StaffPayout[],
  options?: { skipPayoutsAndGoods?: boolean },
): Promise<AreaPerformance[]> {
  const areas = (await store.areas.find({ orderBy: [{ field: 'name' }] })).filter(
    (a) => areaIds === null || areaIds.includes(a.id),
  );

  if (areas.length === 0) return [];

  const scopedAreaIds = areas.map((a) => a.id);
  const areaFilter = areaIds ? { areaId: { in: scopedAreaIds } } : {};
  const skipExtra = options?.skipPayoutsAndGoods === true;

  // Bulk queries: instead of 6 queries x N areas, fetch all area data in one batch.
  const [
    payouts,
    items,
    allCustomers,
    allStaff,
    allVisits,
    allInvoices,
    allComplaints,
    allStockIssues,
  ] = await Promise.all([
    skipExtra
      ? Promise.resolve([])
      : (precomputedPayouts ?? computePayoutRun(store, cycle, areaIds)),
    skipExtra ? Promise.resolve([]) : store.inventoryItems.find(),
    store.customers.find({ where: areaFilter as never }),
    store.staff.find({ where: { role: 'EMPLOYEE', ...areaFilter } as never }),
    store.visits.find({ where: { cycle, ...areaFilter } as never }),
    store.invoices.find({ where: { cycle, ...areaFilter } as never }),
    store.complaints.find({
      where: { status: { in: ['OPEN', 'ESCALATED'] }, ...areaFilter } as never,
    }),
    skipExtra ? Promise.resolve([]) : store.stockIssues.find({ where: areaFilter as never }),
  ]);

  const customerIds = allCustomers.map((c) => c.id);
  const allCars = skipExtra
    ? []
    : areaIds
      ? customerIds.length
        ? await store.cars.find({
            where: { active: true, customerId: { in: customerIds } } as never,
          })
        : []
      : await store.cars.find({ where: { active: true } });

  const itemCost = new Map(items.map((i) => [i.id, i]));
  const carsByCustomer = new Map<Id, number>();
  for (const car of allCars) {
    carsByCustomer.set(car.customerId, (carsByCustomer.get(car.customerId) ?? 0) + 1);
  }

  // Group by area in memory
  const customersByArea = new Map<Id, Customer[]>();
  for (const c of allCustomers) {
    const list = customersByArea.get(c.areaId) ?? [];
    list.push(c);
    customersByArea.set(c.areaId, list);
  }

  const staffByArea = new Map<Id, Staff[]>();
  for (const s of allStaff) {
    const list = staffByArea.get(s.areaId) ?? [];
    list.push(s);
    staffByArea.set(s.areaId, list);
  }

  const visitsByArea = new Map<Id, WashVisit[]>();
  for (const v of allVisits) {
    const list = visitsByArea.get(v.areaId) ?? [];
    list.push(v);
    visitsByArea.set(v.areaId, list);
  }

  const invoicesByArea = new Map<Id, Invoice[]>();
  for (const inv of allInvoices) {
    const list = invoicesByArea.get(inv.areaId) ?? [];
    list.push(inv);
    invoicesByArea.set(inv.areaId, list);
  }

  const complaintsByArea = new Map<Id, Complaint[]>();
  for (const comp of allComplaints) {
    const list = complaintsByArea.get(comp.areaId) ?? [];
    list.push(comp);
    complaintsByArea.set(comp.areaId, list);
  }

  const stockIssuesByArea = new Map<Id, StockIssue[]>();
  for (const issue of allStockIssues) {
    const list = stockIssuesByArea.get(issue.areaId) ?? [];
    list.push(issue);
    stockIssuesByArea.set(issue.areaId, list);
  }

  return areas.map((area) => {
    const customers = customersByArea.get(area.id) ?? [];
    const staff = staffByArea.get(area.id) ?? [];
    const visits = visitsByArea.get(area.id) ?? [];
    const invoices = invoicesByArea.get(area.id) ?? [];
    const complaints = complaintsByArea.get(area.id) ?? [];
    const issues = stockIssuesByArea.get(area.id) ?? [];

    const activeCarCount = customers.reduce(
      (sum, c) => sum + (carsByCustomer.get(c.id) ?? 0),
      0,
    );

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
      activeCars: activeCarCount,
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
  });
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
  const [visits, packages] = await Promise.all([
    store.visits.find({
      where: {
        cycle,
        status: 'MISSED',
        ...(areaIds ? { areaId: { in: areaIds } } : {}),
      } as never,
    }),
    store.packages.find(),
  ]);

  if (visits.length === 0) {
    return { rows: [], total: 0, totalCost: 0 };
  }

  const carIds = [...new Set(visits.map((v) => v.carId))];
  const cars = await store.cars.find({
    where: { id: { in: carIds } } as never,
  });

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

  if (staff.length === 0) return [];

  const staffIds = staff.map((s) => s.id);
  const [allVisits, allComplaints] = await Promise.all([
    store.visits.find({
      where: { staffId: { in: staffIds }, cycle } as never,
    }),
    store.complaints.find({
      where: { staffId: { in: staffIds } } as never,
    }),
  ]);

  const visitsByStaff = new Map<Id, WashVisit[]>();
  for (const v of allVisits) {
    if (!v.staffId) continue;
    const list = visitsByStaff.get(v.staffId) ?? [];
    list.push(v);
    visitsByStaff.set(v.staffId, list);
  }

  const complaintsCountByStaff = new Map<Id, number>();
  for (const c of allComplaints) {
    if (!c.staffId) continue;
    complaintsCountByStaff.set(
      c.staffId,
      (complaintsCountByStaff.get(c.staffId) ?? 0) + 1,
    );
  }

  const rows: StaffPerformanceRow[] = staff.map((s) => {
    const visits = visitsByStaff.get(s.id) ?? [];
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
      complaints: complaintsCountByStaff.get(s.id) ?? 0,
    };
  });

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
  /** Pass rows you already have; this report is derived entirely from them. */
  precomputedAreas?: AreaPerformance[],
): Promise<BusinessSummary> {
  const areas = precomputedAreas ?? (await areaPerformance(store, cycle, areaIds));
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
