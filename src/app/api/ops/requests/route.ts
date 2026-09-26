import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { currentCycle, todayISO } from '@/lib/util/format';
import { assertInScope, opsError } from '../_guard';

function revalidateRequestPages() {
  try {
    for (const base of ['/admin', '/manager', '/area']) {
      revalidatePath(`${base}/requests`);
      revalidatePath(`${base}/customers`);
      revalidatePath(`${base}/schedule`);
    }
    revalidatePath('/app');
  } catch {
    // ignore
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireApiSession('customer:view');
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const status = url.searchParams.get('status') || 'ALL';
    const type = url.searchParams.get('type') || 'ALL';
    const areaId = url.searchParams.get('areaId');
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    const store = await getStore();
    if (areaId) assertInScope(session, areaId);

    // Fetch customers scoped to session
    const customerWhere: Record<string, unknown> = {};
    if (session.scope.areaIds) {
      customerWhere.areaId = { in: session.scope.areaIds };
    }
    if (areaId) {
      customerWhere.areaId = areaId;
    }

    const cycle = currentCycle();
    const [allCustomers, allCars, allPackages, allStaff, allAreas, allVisits] = await Promise.all([
      store.customers.find({ where: customerWhere as never }),
      store.cars.find(),
      store.packages.find(),
      store.staff.find(),
      store.areas.find(),
      store.visits.find(),
    ]);

    const customerMap = new Map(allCustomers.map((c) => [c.id, c]));
    const carMap = new Map(allCars.map((c) => [c.id, c]));
    const packageMap = new Map(allPackages.map((p) => [p.id, p]));
    const staffMap = new Map(allStaff.map((s) => [s.id, s]));
    const areaMap = new Map(allAreas.map((a) => [a.id, a]));

    const scopedCustomerIds = allCustomers.map((c) => c.id);
    if (scopedCustomerIds.length === 0) {
      return NextResponse.json({
        ok: true,
        data: [],
        pagination: { page, limit, total: 0, totalPages: 1 },
        stats: { pendingCount: 0, approvedCount: 0, rejectedCount: 0, totalCount: 0 },
      });
    }

    // Fetch requests for scoped customers
    const reqWhere: Record<string, unknown> = {
      customerId: { in: scopedCustomerIds },
    };
    if (status !== 'ALL') {
      reqWhere.status = status;
    }
    if (type !== 'ALL') {
      reqWhere.type = type;
    }

    const allRequests = await store.customerRequests.find({
      where: { customerId: { in: scopedCustomerIds } } as never,
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
    });

    const pendingCount = allRequests.filter((r) => r.status === 'PENDING').length;
    const approvedCount = allRequests.filter((r) => r.status === 'APPROVED').length;
    const rejectedCount = allRequests.filter((r) => r.status === 'REJECTED').length;
    const totalCount = allRequests.length;

    // Filter by search query if present
    let filtered = allRequests;
    if (status !== 'ALL') {
      filtered = filtered.filter((r) => r.status === status);
    }
    if (type !== 'ALL') {
      filtered = filtered.filter((r) => r.type === type);
    }
    if (q) {
      filtered = filtered.filter((r) => {
        const cust = customerMap.get(r.customerId);
        const car = r.carId ? carMap.get(r.carId) : null;
        return (
          cust?.name.toLowerCase().includes(q) ||
          cust?.phone.includes(q) ||
          car?.plate.toLowerCase().includes(q) ||
          car?.model.toLowerCase().includes(q) ||
          r.notes?.toLowerCase().includes(q)
        );
      });
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    const data = paginated.map((r) => {
      const customer = customerMap.get(r.customerId);
      const car = r.carId ? carMap.get(r.carId) : null;
      const currentPkg = r.currentPackageId
        ? packageMap.get(r.currentPackageId)
        : car?.packageId
        ? packageMap.get(car.packageId)
        : null;
      const requestedPkg = r.requestedPackageId ? packageMap.get(r.requestedPackageId) : null;
      const assignedStaff = r.assignedStaffId ? staffMap.get(r.assignedStaffId) : null;
      const area = customer ? areaMap.get(customer.areaId) : null;

      // Find all visits for this car (or customer)
      const carVisits = r.carId
        ? allVisits.filter((v) => v.carId === r.carId)
        : allVisits.filter((v) => v.customerId === r.customerId);

      // Find previous completed wash or most recent visit
      const sortedVisits = [...carVisits].sort((a, b) => {
        const dateA = a.completedAt || a.scheduledDate || '';
        const dateB = b.completedAt || b.scheduledDate || '';
        return dateB.localeCompare(dateA);
      });

      const lastDoneVisit = sortedVisits.find((v) => v.status === 'DONE');
      const lastVisit = lastDoneVisit || sortedVisits[0] || null;

      let previousWash = null;
      if (lastVisit) {
        const vStaff = lastVisit.staffId ? staffMap.get(lastVisit.staffId) : null;
        const serviceName = lastVisit.servicesDone && lastVisit.servicesDone.length > 0
          ? lastVisit.servicesDone.join(', ')
          : lastVisit.plannedService || 'Regular Wash';

        previousWash = {
          id: lastVisit.id,
          scheduledDate: lastVisit.scheduledDate,
          completedAt: lastVisit.completedAt,
          service: serviceName,
          status: lastVisit.status,
          staffName: vStaff?.name || null,
          rating: lastVisit.rating ?? lastVisit.managerRating ?? null,
          time: lastVisit.scheduledTime || null,
        };
      }

      // Sub-services and quota calculations for package change
      let packageAudit = null;
      const cycleVisits = carVisits.filter((v) => v.cycle === cycle);
      const washesDoneCount = cycleVisits.filter((v) => v.status === 'DONE').length;

      if (r.type === 'PACKAGE_CHANGE' && (currentPkg || requestedPkg)) {
        const currWashes = currentPkg?.washesPerMonth ?? 8;
        const currPrice = currentPkg?.price ?? 0;
        const reqWashes = requestedPkg?.washesPerMonth ?? 8;
        const reqPrice = requestedPkg?.price ?? 0;

        const currServices = currentPkg?.services ?? [];
        const reqServices = requestedPkg?.services ?? [];

        const washesRemaining = Math.max(0, currWashes - washesDoneCount);
        const unusedCredit = Math.round((washesRemaining / Math.max(1, currWashes)) * currPrice);
        const targetRemainingCost = Math.round((washesRemaining / Math.max(1, reqWashes)) * reqPrice);
        const proratedDifference = targetRemainingCost - unusedCredit;
        const fullDifference = reqPrice - unusedCredit;

        packageAudit = {
          currentPackageName: currentPkg?.name ?? '—',
          currentPrice: currPrice,
          currentWashesPerMonth: currWashes,
          currentServices: currServices,
          requestedPackageName: requestedPkg?.name ?? '—',
          requestedPrice: reqPrice,
          requestedWashesPerMonth: reqWashes,
          requestedServices: reqServices,
          washesDoneCount,
          washesRemaining,
          unusedCredit,
          targetRemainingCost,
          proratedDifference,
          fullDifference,
          isUpgrade: reqPrice >= currPrice,
        };
      }

      return {
        id: r.id,
        customerId: r.customerId,
        customerName: customer?.name ?? 'Unknown Customer',
        customerPhone: customer?.phone ?? '',
        areaId: customer?.areaId ?? '',
        areaName: area?.name ?? '—',
        carId: r.carId,
        carName: car ? `${car.make} ${car.model} (${car.plate})` : '—',
        carPlate: car?.plate ?? '',
        type: r.type,
        status: r.status,
        currentPackageName: currentPkg?.name ?? (car?.packageId ? packageMap.get(car.packageId)?.name : '—') ?? '—',
        requestedPackageName: requestedPkg?.name ?? '—',
        requestedPackageId: r.requestedPackageId,
        washType: r.washType,
        preferredDate: r.preferredDate,
        preferredTime: r.preferredTime,
        serviceDetails: r.serviceDetails,
        assignedStaffId: r.assignedStaffId,
        assignedStaffName: assignedStaff?.name ?? null,
        notes: r.notes,
        adminRemarks: r.adminRemarks,
        paymentStatus: r.paymentStatus ?? null,
        paymentAmount: r.paymentAmount ?? null,
        packageAudit,
        previousWash,
        washesDoneThisCycle: washesDoneCount,
        createdAt: r.createdAt,
        decidedAt: r.decidedAt,
        decidedByUserId: r.decidedByUserId,
      };
    });

    return NextResponse.json({
      ok: true,
      data,
      pagination: { page, limit, total, totalPages },
      stats: { pendingCount, approvedCount, rejectedCount, totalCount },
    });
  } catch (error) {
    return opsError(error);
  }
}

const decisionSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(['APPROVED', 'REJECTED']),
  adminRemarks: z.string().max(500).optional().nullable(),
  assignedStaffId: z.string().optional().nullable(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  activationMode: z.enum(['IMMEDIATE_PRORATED', 'IMMEDIATE_FULL', 'NEXT_CYCLE']).optional().nullable(),
  adjustmentAmount: z.number().optional().nullable(),
  applyFinancialAdjustment: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('customer:create');
    const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input.' },
        { status: 400 },
      );
    }

    const store = await getStore();
    const req = await store.customerRequests.get(parsed.data.requestId);
    if (!req) throw new HttpError(404, 'Request not found.');
    if (req.status !== 'PENDING') {
      throw new HttpError(409, 'This request has already been decided.');
    }

    const customer = await store.customers.get(req.customerId);
    if (!customer) throw new HttpError(404, 'Customer not found.');
    assertInScope(session, customer.areaId);

    if (parsed.data.decision === 'APPROVED') {
      let finalPaymentAmount: number | null = null;
      let finalPaymentStatus: string | null = req.paymentStatus ?? null;

      // 1. If Package Change: update the vehicle's package & handle financial adjustments
      if (req.type === 'PACKAGE_CHANGE' && req.requestedPackageId && req.carId) {
        const car = await store.cars.get(req.carId);
        const requestedPkg = await store.packages.get(req.requestedPackageId);

        if (car) {
          await store.cars.update(car.id, {
            packageId: req.requestedPackageId,
          });
        }

        const activationMode = parsed.data.activationMode || 'IMMEDIATE_PRORATED';
        const adjustmentAmount = parsed.data.adjustmentAmount ?? 0;
        const applyFinance = parsed.data.applyFinancialAdjustment !== false;

        if (applyFinance && activationMode !== 'NEXT_CYCLE' && adjustmentAmount !== 0) {
          finalPaymentAmount = Math.round(adjustmentAmount);

          if (adjustmentAmount > 0) {
            // UPGRADE: Customer owes extra money -> Generate open adjustment invoice
            await store.invoices.create({
              customerId: customer.id,
              areaId: customer.areaId,
              cycle: currentCycle(),
              amount: Math.round(adjustmentAmount),
              dueOn: todayISO(),
              paidAmount: 0,
              status: 'OPEN',
              createdAt: new Date().toISOString(),
            });
            finalPaymentStatus = 'PENDING';
          } else if (adjustmentAmount < 0) {
            // DOWNGRADE: Customer is owed credit -> Record credit payment adjustment to ledger
            const creditRupees = Math.abs(Math.round(adjustmentAmount));
            await store.payments.create({
              customerId: customer.id,
              areaId: customer.areaId,
              amount: creditRupees,
              kind: 'ADJUSTMENT',
              mode: 'MANUAL_UPI',
              status: 'CONFIRMED',
              cycle: currentCycle(),
              recordedByUserId: session.user.id,
              reference: `DOWNGRADE-CREDIT-${req.id.slice(-6).toUpperCase()}`,
              note: `Credit for plan downgrade to ${requestedPkg?.name ?? 'new plan'}`,
              createdAt: new Date().toISOString(),
            });
            finalPaymentStatus = 'CREDITED';
          }
        }
      }

      // 2. If One Wash or Other Service: handle financial adjustment if set & create scheduled wash visit if staff & date specified
      if ((req.type === 'ONE_WASH' || req.type === 'OTHER_SERVICE') && req.carId) {
        const car = await store.cars.get(req.carId);
        const assignedStaffId = parsed.data.assignedStaffId || req.assignedStaffId || car?.assignedStaffId;
        const targetDate = parsed.data.scheduledDate || req.preferredDate || todayISO();
        const adjustmentAmount = parsed.data.adjustmentAmount ?? 0;
        const applyFinance = parsed.data.applyFinancialAdjustment !== false;

        if (applyFinance && adjustmentAmount > 0) {
          finalPaymentAmount = Math.round(adjustmentAmount);
          await store.invoices.create({
            customerId: customer.id,
            areaId: customer.areaId,
            cycle: currentCycle(),
            amount: Math.round(adjustmentAmount),
            dueOn: todayISO(),
            paidAmount: 0,
            status: 'OPEN',
            createdAt: new Date().toISOString(),
          });
          finalPaymentStatus = 'PENDING';
        }

        if (car && assignedStaffId) {
          await store.visits.create({
            carId: car.id,
            customerId: customer.id,
            areaId: customer.areaId,
            staffId: assignedStaffId,
            cycle: currentCycle(),
            scheduledDate: targetDate,
            scheduledTime: req.preferredTime || car.scheduleTime || '09:00',
            status: 'PENDING',
            startedAt: null,
            completedAt: null,
            plannedService: req.serviceDetails || req.washType || 'Special Requested Wash',
            servicesDone: [],
            beforePhotoUrl: null,
            afterPhotoUrl: null,
            beforePhotoBytes: null,
            afterPhotoBytes: null,
            missReason: null,
            missNote: `[Customer Special Request: ${req.type}] ${req.notes || ''}`.trim(),
            rescheduledToVisitId: null,
            rating: null,
            ratingComment: null,
            onTime: false,
            managerRating: null,
            managerRatingComment: null,
            managerRatedAt: null,
            managerRatedByUserId: null,
          });
        }
      }

      await store.customerRequests.update(req.id, {
        status: 'APPROVED',
        assignedStaffId: parsed.data.assignedStaffId || req.assignedStaffId || null,
        adminRemarks: parsed.data.adminRemarks || null,
        paymentAmount: finalPaymentAmount,
        paymentStatus: finalPaymentStatus,
        decidedAt: new Date().toISOString(),
        decidedByUserId: session.user.id,
      });

      revalidateRequestPages();
      return NextResponse.json({
        ok: true,
        message: 'Request approved successfully.',
      });
    }

    // Rejected
    await store.customerRequests.update(req.id, {
      status: 'REJECTED',
      adminRemarks: parsed.data.adminRemarks || null,
      decidedAt: new Date().toISOString(),
      decidedByUserId: session.user.id,
    });

    revalidateRequestPages();
    return NextResponse.json({
      ok: true,
      message: 'Request has been rejected.',
    });
  } catch (error) {
    return opsError(error);
  }
}
