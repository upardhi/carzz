import 'server-only';
import { cache } from 'react';

import type { DataStore } from '../data/ports/store';
import type {
  Car,
  Customer,
  Id,
  Invoice,
  Payment,
  Rupees,
  ServicePackage,
  WashVisit,
} from '../data/types';
import { tallyVisits, type VisitTally } from './visits';

/** Everything the customer app and the manager's customer page both need. */
export interface CustomerAccount {
  customer: Customer;
  cars: (Car & { package: ServicePackage | null; tally: VisitTally })[];
  visits: WashVisit[];
  payments: Payment[];
  invoices: Invoice[];
  /** Monthly charge across every active car on the account. */
  monthly: Rupees;
  advanceDeposited: Rupees;
  totalPaid: Rupees;
  totalBilled: Rupees;
  /** Positive when the customer is in credit. */
  balance: Rupees;
  outstanding: Rupees;
  nextDue: Invoice | null;
  nextVisit: WashVisit | null;
  tally: VisitTally;
}

/**
 * Assembles one customer's whole financial and service picture.
 *
 * Multiple cars share a single payment account — one balance, one due date —
 * while each car keeps its own wash count and schedule. That split is the
 * thing the client asked to see working, so it is modelled here once and read
 * by every screen rather than recomputed per page.
 */
export async function loadCustomerAccount(
  store: DataStore,
  customerId: Id,
  cycle: string,
): Promise<CustomerAccount | null> {
  const customer = await store.customers.get(customerId);
  if (!customer) return null;

  const [cars, visits, payments, invoices, packages] = await Promise.all([
    store.cars.find({ where: { customerId } }),
    store.visits.find({
      where: { customerId },
      orderBy: [{ field: 'scheduledDate', dir: 'desc' }],
    }),
    store.payments.find({
      where: { customerId, status: 'CONFIRMED' },
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
    }),
    store.invoices.find({
      where: { customerId },
      orderBy: [{ field: 'cycle', dir: 'desc' }],
    }),
    store.packages.find(),
  ]);

  const packageById = new Map(packages.map((p) => [p.id, p]));
  const cycleVisits = visits.filter((v) => v.cycle === cycle);

  const carsWithDetail = cars.map((car) => ({
    ...car,
    package: packageById.get(car.packageId) ?? null,
    tally: tallyVisits(cycleVisits.filter((v) => v.carId === car.id)),
  }));

  const monthly = cars
    .filter((c) => c.active)
    .reduce((sum, c) => sum + (packageById.get(c.packageId)?.price ?? 0), 0);

  const advanceDeposited = payments
    .filter((p) => p.kind === 'ADVANCE')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = payments
    .filter((p) => p.kind !== 'REFUND')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalBilled = invoices.reduce((sum, i) => sum + i.amount, 0);
  const outstanding = invoices.reduce(
    (sum, i) => sum + Math.max(0, i.amount - i.paidAmount),
    0,
  );

  const today = new Date().toISOString().slice(0, 10);
  const nextDue =
    invoices
      .filter((i) => i.status !== 'PAID' && i.status !== 'WRITTEN_OFF')
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0] ?? null;

  const nextVisit =
    visits
      .filter((v) => v.status === 'PENDING' && v.scheduledDate >= today)
      .sort(
        (a, b) =>
          a.scheduledDate.localeCompare(b.scheduledDate) ||
          a.scheduledTime.localeCompare(b.scheduledTime),
      )[0] ?? null;

  return {
    customer,
    cars: carsWithDetail,
    visits,
    payments,
    invoices,
    monthly,
    advanceDeposited,
    totalPaid,
    totalBilled,
    balance: totalPaid - (totalBilled - outstanding),
    outstanding,
    nextDue,
    nextVisit,
    tally: tallyVisits(cycleVisits),
  };
}

/**
 * Records a payment and settles it against open invoices, oldest first.
 *
 * Anything left over after every invoice is closed becomes account credit,
 * which is how an advance behaves — so a cash payment and a gateway payment
 * land in exactly the same place.
 */
export async function recordPayment(
  store: DataStore,
  input: {
    customerId: Id;
    amount: Rupees;
    mode: Payment['mode'];
    kind?: Payment['kind'];
    cycle: string;
    recordedByUserId: Id | null;
    note?: string | null;
    reference?: string | null;
    /** Manual UPI is confirmed by a manager, so it can start as PENDING. */
    status?: Payment['status'];
  },
): Promise<Payment> {
  const customer = await store.customers.get(input.customerId);
  if (!customer) throw new Error('Customer not found');
  if (input.amount <= 0) throw new Error('Amount must be more than zero');

  const payment = await store.payments.create({
    customerId: input.customerId,
    areaId: customer.areaId,
    amount: input.amount,
    kind: input.kind ?? 'PACKAGE',
    mode: input.mode,
    status: input.status ?? 'CONFIRMED',
    cycle: input.cycle,
    recordedByUserId: input.recordedByUserId,
    reference: input.reference ?? null,
    note: input.note ?? null,
    createdAt: new Date().toISOString(),
  });

  if (payment.status !== 'CONFIRMED') return payment;

  let remaining = input.amount;
  const open = (
    await store.invoices.find({
      where: { customerId: input.customerId },
      orderBy: [{ field: 'cycle' }],
    })
  ).filter((i) => i.paidAmount < i.amount && i.status !== 'WRITTEN_OFF');

  for (const invoice of open) {
    if (remaining <= 0) break;
    const owed = invoice.amount - invoice.paidAmount;
    const applied = Math.min(owed, remaining);
    remaining -= applied;
    const paidAmount = invoice.paidAmount + applied;
    await store.invoices.update(invoice.id, {
      paidAmount,
      status: paidAmount >= invoice.amount ? 'PAID' : 'PARTIAL',
    });
  }

  return payment;
}

/** Customers a manager needs to chase, worst first. */
export interface RedAlert {
  customer: Customer;
  reason: string;
  amount: Rupees;
  daysOverdue: number;
  lastPaymentOn: string | null;
}

async function _loadRedAlertsInternal(
  store: DataStore,
  areaIds: Id[] | null,
): Promise<RedAlert[]> {
  const invoices = await store.invoices.find({
    where: {
      status: { in: ['OPEN', 'PARTIAL', 'OVERDUE'] },
      ...(areaIds ? { areaId: { in: areaIds } } : {}),
    } as never,
  });

  const today = new Date();
  const byCustomer = new Map<Id, { amount: Rupees; earliestDue: string }>();

  for (const invoice of invoices) {
    const owed = invoice.amount - invoice.paidAmount;
    if (owed <= 0) continue;
    const current = byCustomer.get(invoice.customerId);
    byCustomer.set(invoice.customerId, {
      amount: (current?.amount ?? 0) + owed,
      earliestDue:
        current && current.earliestDue < invoice.dueOn
          ? current.earliestDue
          : invoice.dueOn,
    });
  }

  // Both lookups are done once for the whole set rather than twice per
  // customer inside the loop. This function feeds the sidebar badges, which
  // are computed in the console layout — so every page in every console paid
  // for two round trips per indebted customer, in series. Against a hosted
  // database that was ~150 round trips, and it put roughly forty seconds in
  // front of every screen. The memory provider hid it: there a lookup is a
  // Map read, so the loop cost nothing.
  //
  // Both are narrowed by area rather than by a list of customer ids: the
  // invoices above were already filtered to these areas, and `in` over a list
  // that grows with the customer count would not survive the Firestore
  // adapter, which caps that operator at thirty values. Area ids are at most a
  // handful, and the rest of this file already scopes that way.
  const areaFilter = areaIds ? { areaId: { in: areaIds } } : {};
  const [
    // customers, 
    confirmedPayments] = await Promise.all([
    // store.customers.find({ where: { ...areaFilter } }),
    store.payments.find({
      where: { status: 'CONFIRMED', ...areaFilter },
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
    }),
  ]);
  // const customerById = new Map(customers.map((c) => [c.id, c]));

  // Newest first, so the first row seen for a customer is their latest payment
  // — the same one `findOne` with this ordering returned.
  const lastPaymentOnByCustomer = new Map<Id, string>();
  for (const payment of confirmedPayments) {
    if (!lastPaymentOnByCustomer.has(payment.customerId)) {
      lastPaymentOnByCustomer.set(payment.customerId, payment.createdAt);
    }
  }

  const alerts: RedAlert[] = [];

  // --- Batch fetch to eliminate the N+1 loop ---
  const customerIds = [...byCustomer.keys()];
  if (customerIds.length === 0) return alerts;

  // Two bulk queries replace the N*2 individual queries
  const [allCustomers, allPayments] = await Promise.all([
    store.customers.find({ where: { id: { in: customerIds } } as never }),
    store.payments.find({
      where: {
        customerId: { in: customerIds },
        status: 'CONFIRMED',
      } as never,
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
    }),
  ]);

  const customerMap = new Map(allCustomers.map((c) => [c.id, c]));
  const lastPaymentMap = new Map<Id, Payment>();
  for (const p of allPayments) {
    if (!lastPaymentMap.has(p.customerId)) {
      lastPaymentMap.set(p.customerId, p);
    }
  }

  for (const customerId of customerIds) {
    const customer = customerMap.get(customerId);
    if (!customer) continue;
    const agg = byCustomer.get(customerId);
    if (!agg) continue;

    if (customer.status === 'INACTIVE') continue;

    const due = new Date(`${agg.earliestDue}T00:00:00Z`);
    const daysOverdue = Math.floor(
      (today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysOverdue < 0) continue;

    // const lastPayment = lastPaymentMap.get(customerId);

    alerts.push({
      customer,
      amount: agg.amount,
      daysOverdue,
      reason:
        customer.status === 'HOLD'
          ? 'On hold, unpaid'
          : daysOverdue > 20
            ? 'Long overdue'
            : agg.amount > 0 && daysOverdue > 0
              ? 'Payment overdue'
              : 'Month end, no payment',
      lastPaymentOn: lastPaymentOnByCustomer.get(customerId) ?? null,
    });
  }

  return alerts.sort((a, b) => b.daysOverdue - a.daysOverdue || b.amount - a.amount);
}

const cachedRedAlertsByScope = cache(
  async (scopeKey: string, areaIds: Id[] | null, store: DataStore) => {
    return _loadRedAlertsInternal(store, areaIds);
  },
);

export function loadRedAlerts(
  store: DataStore,
  areaIds: Id[] | null,
): Promise<RedAlert[]> {
  const scopeKey = areaIds ? areaIds.slice().sort().join(',') : 'all';
  return cachedRedAlertsByScope(scopeKey, areaIds, store);
}
