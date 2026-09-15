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
import { generateVisitsForCar, scheduleNextVisitForCar } from './schedule';
import { resolvePublicPhotoUrl } from '../util/photoUrl';
import { todayISO } from '../util/format';
import { invalidateAreaPerformanceCache } from './reports';

/** Everything the customer app and the manager's customer page both need. */
export interface CustomerAccount {
  customer: Customer;
  cars: (Car & {
    package: ServicePackage | null;
    tally: VisitTally;
    serviceStartedByUser?: { id: Id; name: string; role: string; email?: string } | null;
  })[];
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

  const starterUserIds = Array.from(
    new Set(cars.map((c) => c.serviceStartedByUserId).filter(Boolean) as string[]),
  );
  const starterUsers = starterUserIds.length
    ? await store.users.find({ where: { id: { in: starterUserIds } } as never })
    : [];
  const userById = new Map(starterUsers.map((u) => [u.id, u]));

  const today = todayISO();
  let effectiveVisits = visits;

  // 1. Clean up stale past pending visits that were never executed
  const pastPending = effectiveVisits.filter(
    (v) => v.status === 'PENDING' && v.scheduledDate < today,
  );
  if (pastPending.length > 0) {
    for (const p of pastPending) {
      await store.visits.delete(p.id);
    }
    effectiveVisits = effectiveVisits.filter(
      (v) => !pastPending.some((p) => p.id === v.id),
    );
  }

  // 2. Prune any redundant future pending visits beyond the first upcoming visit per car
  const prunedVisitIds = new Set<string>();
  for (const car of cars) {
    const carPending = effectiveVisits
      .filter((v) => v.carId === car.id && v.cycle === cycle && v.status === 'PENDING')
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    if (carPending.length > 1) {
      const redundant = carPending.slice(1);
      for (const r of redundant) {
        prunedVisitIds.add(r.id);
        await store.visits.delete(r.id);
      }
    }
  }
  effectiveVisits = effectiveVisits.filter((v) => !prunedVisitIds.has(v.id));

  // 3. Ensure cars with active service have their upcoming pending visit scheduled on or after today
  for (const car of cars) {
    const isStarted = car.serviceStarted ?? true;
    if (!isStarted || !car.active) continue;

    const carDoneThisCycle = effectiveVisits.filter(
      (v) => v.carId === car.id && v.cycle === cycle && v.status === 'DONE',
    ).length;
    const pkg = packageById.get(car.packageId);
    const quota = pkg?.washesPerMonth ?? 8;

    if (carDoneThisCycle < quota) {
      const hasUpcomingOpen = effectiveVisits.some(
        (v) =>
          v.carId === car.id &&
          (v.status === 'PENDING' || v.status === 'IN_PROGRESS') &&
          v.scheduledDate >= today,
      );

      if (!hasUpcomingOpen) {
        const created = await scheduleNextVisitForCar(
          store,
          car,
          customer,
          cycle,
          today,
        );
        if (created) {
          effectiveVisits.push(created);
        }
      }
    }
  }

  const effectiveCycleVisits = effectiveVisits.filter((v) => v.cycle === cycle);

  const carsWithDetail = cars.map((car) => {
    const starterUser = car.serviceStartedByUserId
      ? userById.get(car.serviceStartedByUserId)
      : null;
    const pkg = packageById.get(car.packageId) ?? null;
    return {
      ...car,
      package: pkg,
      tally: tallyVisits(
        effectiveCycleVisits.filter((v) => v.carId === car.id),
        pkg?.washesPerMonth,
      ),
      serviceStartedByUser: starterUser
        ? {
            id: starterUser.id,
            name: starterUser.name,
            role: starterUser.role,
            email: starterUser.email,
          }
        : null,
    };
  });

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

  const nextDue =
    invoices
      .filter((i) => i.status !== 'PAID' && i.status !== 'WRITTEN_OFF')
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0] ?? null;

  const nextVisit =
    effectiveVisits
      .filter((v) => v.status === 'PENDING' && v.scheduledDate >= today)
      .sort(
        (a, b) =>
          a.scheduledDate.localeCompare(b.scheduledDate) ||
          a.scheduledTime.localeCompare(b.scheduledTime),
      )[0] ?? null;

  const resolvedVisits = effectiveVisits.map((v) => ({
    ...v,
    beforePhotoUrl: resolvePublicPhotoUrl(v.beforePhotoUrl),
    afterPhotoUrl: resolvePublicPhotoUrl(v.afterPhotoUrl),
  }));

  const resolvedNextVisit = nextVisit
    ? {
        ...nextVisit,
        beforePhotoUrl: resolvePublicPhotoUrl(nextVisit.beforePhotoUrl),
        afterPhotoUrl: resolvePublicPhotoUrl(nextVisit.afterPhotoUrl),
      }
    : null;

  const totalAccountQuota = cars.reduce(
    (sum, c) => sum + (packageById.get(c.packageId)?.washesPerMonth ?? 8),
    0,
  );

  return {
    customer,
    cars: carsWithDetail,
    visits: resolvedVisits,
    payments,
    invoices,
    monthly,
    advanceDeposited,
    totalPaid,
    totalBilled,
    balance: totalPaid - (totalBilled - outstanding),
    outstanding,
    nextDue,
    nextVisit: resolvedNextVisit,
    tally: tallyVisits(effectiveCycleVisits, totalAccountQuota),
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

  // Auto-activate service for pending cars and immediately generate wash visits for this cycle
  const pendingCars = await store.cars.find({
    where: { customerId: input.customerId, active: true },
  });
  for (const car of pendingCars) {
    if (!car.serviceStarted) {
      const updatedCar = await store.cars.update(car.id, {
        serviceStarted: true,
        serviceStartedAt: new Date().toISOString(),
        serviceStartedBeforePayment: false,
        serviceStartedByUserId: input.recordedByUserId || null,
      });
      try {
        await generateVisitsForCar(store, updatedCar, customer, input.cycle);
      } catch (err) {
        console.error(`Failed to auto-generate visits for car ${car.id}:`, err);
      }
    }
  }

  invalidateAreaPerformanceCache();
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

  const alerts: RedAlert[] = [];
  const customerIds = [...byCustomer.keys()];
  if (customerIds.length === 0) return alerts;

  // Single batch parallel query for indebted customers and their latest confirmed payments
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
      lastPaymentOn: lastPaymentMap.get(customerId)?.createdAt ?? null,
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
