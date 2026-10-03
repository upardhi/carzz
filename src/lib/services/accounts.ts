import 'server-only';
import { cache } from 'react';

import type { DataStore } from '../data/ports/store';
import {
  type Car,
  type Customer,
  type CustomerRequest,
  type Id,
  type Invoice,
  type Payment,
  type Rupees,
  type ServicePackage,
  type WashVisit,
} from '../data/types';
import { tallyVisits, type VisitTally } from './visits';
import { generateVisitsForCar, scheduleNextVisitForCar } from './schedule';
import { resolvePublicPhotoUrl } from '../util/photoUrl';
import { nextCycle, todayISO } from '../util/format';
import { invalidateAreaPerformanceCache } from './reports';

/** Everything the customer app and the manager's customer page both need. */
export interface CustomerAccount {
  customer: Customer;
  cars: (Car & {
    package: ServicePackage | null;
    upcomingPackage?: ServicePackage | null;
    tally: VisitTally;
    payment: {
      price: number;
      paid: number;
      due: number;
      status: 'PAID' | 'DUE' | 'OVERDUE' | 'AWAITING_FIRST_WASH';
      awaitingFirstWash?: boolean;
      isAdvanceCovered?: boolean;
      advanceHeld?: number;
      advanceMessage?: string;
    };
    serviceStartedByUser?: { id: Id; name: string; role: string; email?: string } | null;
    pendingRequest?: (CustomerRequest & {
      requestedPackage?: ServicePackage | null;
      currentPackage?: ServicePackage | null;
    }) | null;
  })[];
  visits: WashVisit[];
  payments: Payment[];
  invoices: Invoice[];
  pendingRequests?: CustomerRequest[];
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

  const [cars, visits, payments, invoices, packages, customerRequests] = await Promise.all([
    store.cars.find({ where: { customerId } }),
    store.visits.find({
      where: { customerId },
      orderBy: [{ field: 'scheduledDate', dir: 'desc' }],
    }),
    // Every status is loaded here, not just CONFIRMED — a customer-declared
    // cash/UPI/gateway payment sits at PENDING until a manager confirms it,
    // and the customer detail page needs to see (and act on) those, not just
    // the ones already settled.
    store.payments.find({
      where: { customerId },
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
    }),
    store.invoices.find({
      where: { customerId },
      orderBy: [{ field: 'cycle', dir: 'desc' }],
    }),
    store.packages.find(),
    store.customerRequests.find({
      where: { customerId },
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
    }),
  ]);

  const packageById = new Map(packages.map((p) => [p.id, p]));
  const pendingRequests = (customerRequests ?? []).filter((r) => r.status === 'PENDING');

  // 0. Auto-promote or manage upcoming next-cycle packages
  for (const car of cars) {
    if (car.nextPackageId && car.nextPackageCycle && cycle >= car.nextPackageCycle) {
      try {
        await store.cars.update(car.id, {
          packageId: car.nextPackageId,
          nextPackageId: null,
          nextPackageCycle: null,
        });
        car.packageId = car.nextPackageId;
        car.nextPackageId = null;
        car.nextPackageCycle = null;
      } catch {
        // ignore
      }
    }
  }

  // Self-heal any cars whose package was prematurely modified in current cycle:
  const approvedNextCycleReqs = (customerRequests ?? []).filter(
    (r) =>
      r.type === 'PACKAGE_CHANGE' &&
      r.status === 'APPROVED' &&
      Boolean(r.carId) &&
      Boolean(r.currentPackageId) &&
      Boolean(r.requestedPackageId) &&
      r.currentPackageId !== r.requestedPackageId
  );
  for (const r of approvedNextCycleReqs) {
    const c = cars.find((car) => car.id === r.carId);
    const currPkgId = r.currentPackageId;
    const reqPkgId = r.requestedPackageId;
    if (c && currPkgId && reqPkgId && c.packageId === reqPkgId && !c.nextPackageId) {
      c.packageId = currPkgId;
      c.nextPackageId = reqPkgId;
      c.nextPackageCycle = nextCycle(cycle);
      try {
        await store.cars.update(c.id, {
          packageId: currPkgId,
          nextPackageId: reqPkgId,
          nextPackageCycle: nextCycle(cycle),
        });
      } catch {
        // ignore
      }
    }
  }

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
      try {
        await store.visits.delete(p.id);
      } catch {
        // Silently continue if record was already deleted
      }
    }
    effectiveVisits = effectiveVisits.filter(
      (v) => !pastPending.some((p) => p.id === v.id),
    );
  }

  // 2. Prune any redundant future pending visits beyond the first upcoming visit per car
  const prunedVisitIds = new Set<string>();
  for (const car of cars) {
    const carPending = effectiveVisits
      .filter((v) => v.carId === car.id && v.status === 'PENDING' && v.scheduledDate >= today)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    if (carPending.length > 1) {
      const redundant = carPending.slice(1);
      for (const r of redundant) {
        prunedVisitIds.add(r.id);
        try {
          await store.visits.delete(r.id);
        } catch {
          // Silently continue if record was already deleted
        }
      }
    }
  }
  effectiveVisits = effectiveVisits.filter((v) => !prunedVisitIds.has(v.id));

  // 2.5 Auto-promote scheduled package upgrades/downgrades ONLY when the current package has completed all its washes
  for (const car of cars) {
    if (car.nextPackageId) {
      const currentPkg = packageById.get(car.packageId);
      const quota = currentPkg?.washesPerMonth ?? 8;
      const completedWashes = effectiveVisits.filter((v) => {
        if (v.carId !== car.id || v.status !== 'DONE') return false;
        if (car.packageResetAt) {
          const resetDate = car.packageResetAt.slice(0, 10);
          return v.scheduledDate >= resetDate || Boolean(v.completedAt && v.completedAt >= car.packageResetAt);
        }
        return true;
      }).length;

      if (completedWashes >= quota) {
        try {
          const resetTime = new Date().toISOString();
          await store.cars.update(car.id, {
            packageId: car.nextPackageId,
            nextPackageId: null,
            nextPackageCycle: null,
            packageResetAt: resetTime,
          });
          car.packageId = car.nextPackageId;
          car.nextPackageId = null;
          car.nextPackageCycle = null;
          car.packageResetAt = resetTime;
        } catch {
          // ignore
        }
      }
    }
  }

  // 3. Ensure cars with active service have their upcoming pending visit scheduled on or after today
  for (const car of cars) {
    const isStarted = car.serviceStarted ?? true;
    if (!isStarted || !car.active || customer.status === 'INACTIVE') continue;
    if (customer.status === 'HOLD' && customer.holdUntil && customer.holdUntil >= today) continue;

    const carDoneThisCycle = effectiveVisits.filter((v) => {
      if (v.carId !== car.id || v.cycle !== cycle || v.status !== 'DONE') return false;
      if (car.packageResetAt && car.packageResetAt.slice(0, 7) === cycle) {
        const resetDate = car.packageResetAt.slice(0, 10);
        return v.scheduledDate >= resetDate || Boolean(v.completedAt && v.completedAt >= car.packageResetAt);
      }
      return true;
    }).length;
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

  // Determine which cars are already covered by an existing fully-paid package whose washes
  // are still in progress, versus cars that need billing for the current cycle (newly added cars
  // or cars whose previous package washes are finished).
  const pastInvoices = invoices
    .filter((inv) => inv.cycle < cycle && inv.status !== 'WRITTEN_OFF')
    .sort((a, b) => b.cycle.localeCompare(a.cycle)); // newest past cycle first

  const hasUnpaidPastInvoice = pastInvoices.some((inv) => inv.paidAmount < inv.amount);
  const latestPastInvoice = pastInvoices[0];

  function isCarCoveredByPaidPackage(car: (typeof cars)[number]): boolean {
    if (!latestPastInvoice || latestPastInvoice.paidAmount < latestPastInvoice.amount) {
      return false;
    }
    // A car is only covered by that past invoice if the car was already registered in or before that cycle.
    // If it was created in a later cycle, it is a newly added car and must be billed.
    const carTimestamp = car.serviceStartedAt || car.createdAt;
    const carCycle = carTimestamp ? carTimestamp.slice(0, 7) : latestPastInvoice.cycle;
    if (carCycle > latestPastInvoice.cycle) {
      return false;
    }
    const pkg = packageById.get(car.packageId);
    const quota = pkg?.washesPerMonth ?? 8;
    const completedWashes = effectiveVisits.filter(
      (v) => v.carId === car.id && v.cycle >= latestPastInvoice.cycle && v.status === 'DONE',
    ).length;
    // A car is only covered by that past invoice if it completed at least 1 wash and hasn't exhausted quota.
    // If completedWashes === 0, the first wash was never completed.
    return completedWashes > 0 && completedWashes < quota;
  }

  const activeCarsRaw = cars.filter((c) => c.active && (c.serviceStarted ?? true));
  const carsNeedingBilling = activeCarsRaw.filter((c) => !isCarCoveredByPaidPackage(c));
  const currentCycleBill = hasUnpaidPastInvoice
    ? 0
    : carsNeedingBilling.reduce((sum, c) => sum + (packageById.get(c.packageId)?.price ?? 0), 0);

  const activePackageCycle = latestPastInvoice && carsNeedingBilling.length === 0
    ? latestPastInvoice.cycle
    : cycle;

  const effectiveCycleVisits = effectiveVisits.filter((v) => v.cycle >= activePackageCycle);

  const carsWithDetail = cars.map((car) => {
    const starterUser = car.serviceStartedByUserId
      ? userById.get(car.serviceStartedByUserId)
      : null;
    const pkg = packageById.get(car.packageId) ?? null;
    const upcomingPackage = car.nextPackageId ? packageById.get(car.nextPackageId) ?? null : null;
    const effectiveQuota = pkg?.washesPerMonth ?? 8;

    const carPending = pendingRequests.find((r) => r.carId === car.id);
    const pendingRequest = carPending
      ? {
          ...carPending,
          requestedPackage: carPending.requestedPackageId
            ? packageById.get(carPending.requestedPackageId) ?? null
            : null,
          currentPackage: carPending.currentPackageId
            ? packageById.get(carPending.currentPackageId) ?? null
            : pkg,
        }
      : null;

    const carActiveCycle = isCarCoveredByPaidPackage(car) && latestPastInvoice
      ? latestPastInvoice.cycle
      : cycle;

    const carVisits = effectiveVisits.filter((v) => {
      if (v.carId !== car.id || v.cycle < carActiveCycle) return false;
      if (car.packageResetAt && car.packageResetAt.slice(0, 7) === cycle) {
        const resetDate = car.packageResetAt.slice(0, 10);
        return v.scheduledDate >= resetDate || Boolean(v.completedAt && v.completedAt >= car.packageResetAt);
      }
      return true;
    });

    return {
      ...car,
      package: pkg,
      upcomingPackage,
      pendingRequest,
      tally: tallyVisits(
        carVisits,
        effectiveQuota,
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
    .filter((c) => c.active && (c.serviceStarted ?? true))
    .reduce((sum, c) => sum + (packageById.get(c.packageId)?.price ?? 0), 0);

  // Keep current cycle's invoice perfectly synchronized with cars needing billing this cycle
  let effectiveInvoices = invoices;
  if (currentCycleBill <= 0) {
    // If no cars need billing for the current cycle (all cars are covered by in-progress paid packages),
    // delete any premature invoice for current cycle so the customer is not double-billed or shown false dues.
    const prematureInvoiceIndex = effectiveInvoices.findIndex((inv) => inv.cycle === cycle);
    if (prematureInvoiceIndex >= 0) {
      const prematureInv = effectiveInvoices[prematureInvoiceIndex];
      try {
        await store.invoices.delete(prematureInv.id);
      } catch {
        // ignore
      }
      effectiveInvoices = effectiveInvoices.filter((inv) => inv.id !== prematureInv.id);
    }
  } else if (customer.status !== 'INACTIVE') {
    const currentInvoiceIndex = effectiveInvoices.findIndex((inv) => inv.cycle === cycle);
    if (currentInvoiceIndex >= 0) {
      const currentInvoice = effectiveInvoices[currentInvoiceIndex];
      if (currentInvoice.amount !== currentCycleBill) {
        try {
          const updatedInvoice = await store.invoices.update(currentInvoice.id, {
            amount: currentCycleBill,
            status: currentInvoice.paidAmount >= currentCycleBill ? 'PAID' : currentInvoice.paidAmount > 0 ? 'PARTIAL' : 'OPEN',
          });
          effectiveInvoices[currentInvoiceIndex] = updatedInvoice;
        } catch {
          // ignore
        }
      }
    } else {
      const firstDueOn = `${cycle}-05` < today ? `${nextCycle(cycle)}-05` : `${cycle}-05`;
      try {
        const createdInvoice = await store.invoices.create({
          customerId: customer.id,
          areaId: customer.areaId,
          cycle,
          amount: currentCycleBill,
          dueOn: firstDueOn,
          paidAmount: 0,
          status: 'OPEN',
          createdAt: new Date().toISOString(),
        });
        effectiveInvoices = [createdInvoice, ...effectiveInvoices];
      } catch {
        // ignore
      }
    }
  }

  // Balance/credit math must only ever count money that's actually landed —
  // a customer's own say-so (PENDING) cannot move these until a manager
  // confirms it, or the account would show credit for money never received.
  const confirmedPayments = payments.filter((p) => p.status === 'CONFIRMED');
  const advanceDeposited = confirmedPayments
    .filter((p) => p.kind === 'ADVANCE')
    .reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = confirmedPayments
    .filter((p) => p.kind !== 'REFUND')
    .reduce((sum, p) => sum + p.amount, 0);

  const activeCars = carsWithDetail.filter((c) => c.active && (c.serviceStarted ?? true));

  // Determine which active cars have completed at least one wash
  function hasCarDoneFirstWash(carId: string): boolean {
    return effectiveVisits.some((v) => v.carId === carId && v.status === 'DONE');
  }

  // Sort active cars: cars with completed first washes first, then highest washes done, then startedAt
  const sortedActiveCars = [...activeCars].sort((a, b) => {
    const firstA = hasCarDoneFirstWash(a.id);
    const firstB = hasCarDoneFirstWash(b.id);
    if (firstA !== firstB) {
      return firstA ? -1 : 1;
    }
    const doneA = effectiveCycleVisits.filter((v) => v.carId === a.id && v.status === 'DONE').length;
    const doneB = effectiveCycleVisits.filter((v) => v.carId === b.id && v.status === 'DONE').length;
    if (doneA !== doneB) {
      return doneB - doneA;
    }
    const startedA = a.serviceStartedAt
      ? new Date(a.serviceStartedAt).getTime()
      : a.serviceStarted ? 1 : 0;
    const startedB = b.serviceStartedAt
      ? new Date(b.serviceStartedAt).getTime()
      : b.serviceStarted ? 1 : 0;
    if (startedA !== startedB) {
      return startedA - startedB;
    }
    return a.id.localeCompare(b.id);
  });

  const isOverdue = effectiveInvoices.some(
    (i) => (i.status === 'OVERDUE' || (i.dueOn < today && i.paidAmount < i.amount)) && i.status !== 'WRITTEN_OFF',
  );

  let remainingConfirmedPaidToDistribute = totalPaid;
  const carPaymentsMap = new Map<
    string,
    {
      price: number;
      paid: number;
      due: number;
      status: 'PAID' | 'DUE' | 'OVERDUE' | 'AWAITING_FIRST_WASH';
      awaitingFirstWash: boolean;
      isAdvanceCovered?: boolean;
      advanceHeld?: number;
      advanceMessage?: string;
    }
  >();

  // Pass 1: Distribute available confirmed funds ONLY to cars that have completed their first wash
  for (const c of sortedActiveCars) {
    const price = c.package?.price ?? 0;
    const hasFirstWash = hasCarDoneFirstWash(c.id);

    if (hasFirstWash) {
      if (isCarCoveredByPaidPackage(c)) {
        carPaymentsMap.set(c.id, {
          price,
          paid: price,
          due: 0,
          status: 'PAID',
          awaitingFirstWash: false,
        });
        remainingConfirmedPaidToDistribute = Math.max(0, remainingConfirmedPaidToDistribute - price);
      } else {
        const allocated = Math.min(price, remainingConfirmedPaidToDistribute);
        remainingConfirmedPaidToDistribute -= allocated;
        const due = Math.max(0, price - allocated);
        const status = due === 0 ? 'PAID' : isOverdue ? 'OVERDUE' : 'DUE';
        carPaymentsMap.set(c.id, {
          price,
          paid: allocated,
          due,
          status,
          awaitingFirstWash: false,
        });
      }
    }
  }

  // Pass 2: Any confirmed funds left over remain in the customer's wallet as advance payment!
  // For cars that have NOT completed their first wash, amount is NOT distributed to that car/package.
  // The car shows Unpaid (Awaiting 1st Wash), and we check how much advance is reserved in wallet.
  const walletAdvanceBalance = remainingConfirmedPaidToDistribute;
  let remainingAdvanceToReserve = walletAdvanceBalance;

  for (const c of sortedActiveCars) {
    const hasFirstWash = hasCarDoneFirstWash(c.id);
    if (!hasFirstWash) {
      const price = c.package?.price ?? 0;
      const advanceHeld = Math.min(price, remainingAdvanceToReserve);
      remainingAdvanceToReserve -= advanceHeld;
      const isAdvanceCovered = advanceHeld >= price && price > 0;

      carPaymentsMap.set(c.id, {
        price,
        paid: 0,
        due: price,
        status: 'AWAITING_FIRST_WASH',
        awaitingFirstWash: true,
        isAdvanceCovered,
        advanceHeld,
        advanceMessage: isAdvanceCovered
          ? `Advance payment of ₹${price.toLocaleString('en-IN')} is reserved in your wallet. Once the first wash is completed, it will automatically be distributed to this car.`
          : advanceHeld > 0
          ? `₹${advanceHeld.toLocaleString('en-IN')} advance is reserved in your wallet. Once the first wash is completed, it will be distributed to this car (remaining due: ₹${(price - advanceHeld).toLocaleString('en-IN')}).`
          : 'First wash not completed yet. Once your 1st wash is completed, payment will automatically be distributed to this vehicle.',
      });
    }
  }

  // Pass 3: Invoices should reflect only the money distributed to cars with completed washes.
  const totalDistributedToCars = [...carPaymentsMap.values()].reduce(
    (sum, p) => sum + p.paid,
    0,
  );

  let remainingDistributedToApply = totalDistributedToCars;
  const sortedInvoices = [...effectiveInvoices]
    .filter((i) => i.status !== 'WRITTEN_OFF')
    .sort((a, b) => a.cycle.localeCompare(b.cycle));

  for (const inv of sortedInvoices) {
    const targetPaid = Math.min(inv.amount, remainingDistributedToApply);
    remainingDistributedToApply -= targetPaid;
    const targetStatus = targetPaid >= inv.amount ? 'PAID' : targetPaid > 0 ? 'PARTIAL' : 'OPEN';

    if (inv.paidAmount !== targetPaid || inv.status !== targetStatus) {
      try {
        const updated = await store.invoices.update(inv.id, {
          paidAmount: targetPaid,
          status: targetStatus,
        });
        const idx = effectiveInvoices.findIndex((x) => x.id === inv.id);
        if (idx >= 0) effectiveInvoices[idx] = updated;
      } catch {
        // ignore
      }
    }
  }

  const finalCarsWithDetail = carsWithDetail.map((c) => ({
    ...c,
    payment: carPaymentsMap.get(c.id) || {
      price: c.package?.price ?? 0,
      paid: 0,
      due: c.active && (c.serviceStarted ?? true) ? (c.package?.price ?? 0) : 0,
      status: (c.active && (c.serviceStarted ?? true) ? (isOverdue ? 'OVERDUE' : 'DUE') : 'PAID') as 'PAID' | 'DUE' | 'OVERDUE' | 'AWAITING_FIRST_WASH',
      awaitingFirstWash: false,
    },
  }));

  const totalBilled = effectiveInvoices.reduce((sum, i) => sum + i.amount, 0);

  // Outstanding: only uncovered dues (if advance covers the due, customer owes nothing out of pocket)
  const outstanding = sortedActiveCars.reduce((sum, c) => {
    const pay = carPaymentsMap.get(c.id);
    if (!pay) return sum;
    if (pay.awaitingFirstWash) {
      return sum + Math.max(0, pay.due - (pay.advanceHeld ?? 0));
    }
    return sum + pay.due;
  }, 0);

  const nextDue =
    effectiveInvoices
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

  const totalAccountQuota = cars
    .filter((c) => c.active && (c.serviceStarted ?? true))
    .reduce((sum, c) => {
      const pkg = packageById.get(c.packageId);
      return sum + (pkg?.washesPerMonth ?? 8);
    }, 0);

  return {
    customer,
    cars: finalCarsWithDetail,
    visits: resolvedVisits,
    payments,
    invoices: effectiveInvoices,
    pendingRequests,
    monthly,
    advanceDeposited,
    totalPaid,
    totalBilled,
    balance: walletAdvanceBalance,
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

  // 1. Deduplication guard by unique reference (e.g. Razorpay payment ID "pay_..." or UPI UTR)
  const trimmedRef = input.reference?.trim();
  if (trimmedRef) {
    const existingWithRef = await store.payments.find({
      where: { reference: trimmedRef } as never,
    });
    if (existingWithRef.length > 0) {
      console.warn(`Payment with reference "${trimmedRef}" already recorded. Skipping duplicate.`);
      const existing = existingWithRef[0];
      if (existing.status === 'PENDING' && input.status === 'CONFIRMED') {
        const updated = await store.payments.update(existing.id, {
          status: 'CONFIRMED',
          recordedByUserId: input.recordedByUserId ?? existing.recordedByUserId,
        });
        await loadCustomerAccount(store, input.customerId, input.cycle);
        return updated;
      }
      return existing;
    }
  }

  // 2. Anti double-click / rapid replay guard (same customer, amount, mode within 30 seconds)
  const nowMs = Date.now();
  const recentPayments = await store.payments.find({
    where: {
      customerId: input.customerId,
      amount: input.amount,
      mode: input.mode,
      cycle: input.cycle,
    } as never,
  });
  const recentDuplicate = recentPayments.find((p) => {
    if (!p.createdAt) return false;
    const createdMs = new Date(p.createdAt).getTime();
    return Math.abs(nowMs - createdMs) < 30000;
  });
  if (recentDuplicate) {
    console.warn(`Identical payment detected within 30s for customer ${input.customerId}. Skipping duplicate.`);
    return recentDuplicate;
  }

  const payment = await store.payments.create({
    customerId: input.customerId,
    areaId: customer.areaId,
    amount: input.amount,
    kind: input.kind ?? 'PACKAGE',
    mode: input.mode,
    status: input.status ?? 'CONFIRMED',
    cycle: input.cycle,
    recordedByUserId: input.recordedByUserId,
    reference: trimmedRef ?? null,
    note: input.note ?? null,
    createdAt: new Date().toISOString(),
  });

  if (payment.status !== 'CONFIRMED') return payment;

  // Reconcile account and invoices: funds stay in wallet advance until 1st wash is completed
  try {
    await loadCustomerAccount(store, input.customerId, input.cycle);
  } catch (err) {
    console.error('Failed to reconcile customer account in recordPayment:', err);
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
  dueOn?: string;
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
      dueOn: agg.earliestDue,
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
