import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import { getStore } from '@/lib/data';
import type { ComplaintStatus, Complaint } from '@/lib/data/types';
import type { Where } from '@/lib/data/ports/repository';
import { assertInScope, opsError } from '../_guard';

function revalidateComplaintPages() {
  try {
    for (const base of ['/admin', '/manager', '/area']) {
      revalidatePath(`${base}/complaints`);
      revalidatePath(`${base}/customers/[customerId]`, 'page');
    }
  } catch {
    // ignore — running outside a request context
  }
}

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(6),
  status: z.enum(['ALL', 'OPEN', 'ESCALATED', 'RESOLVED']).default('ALL'),
  time: z.enum(['ALL', 'TODAY', 'WEEK', 'MONTH']).default('ALL'),
  sortBy: z.enum(['LATEST', 'OLDEST']).default('LATEST'),
  areaId: z.string().optional(),
  regionId: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await requireApiSession('complaint:view');
    const url = new URL(request.url);

    const parseResult = querySchema.safeParse({
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      time: url.searchParams.get('time') ?? undefined,
      sortBy: url.searchParams.get('sortBy') ?? undefined,
      areaId: url.searchParams.get('areaId') ?? undefined,
      regionId: url.searchParams.get('regionId') ?? undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    const { page, pageSize, status, time, sortBy, areaId, regionId } = parseResult.data;
    const store = await getStore();

    // Base scope filter from user role / session
    const baseScope = scopeAreaFilter(session.scope) as Where<Complaint>;
    const areaClause: Where<Complaint> = {};

    if (regionId) {
      const regionAreas = await store.areas.find({ where: { regionId } });
      const regionAreaIds = regionAreas.map((a) => a.id);
      if (areaId) {
        assertInScope(session, areaId);
        if (regionAreaIds.includes(areaId)) {
          areaClause.areaId = areaId;
        } else {
          areaClause.areaId = '__none__';
        }
      } else {
        areaClause.areaId = { in: regionAreaIds };
      }
    } else if (areaId) {
      assertInScope(session, areaId);
      areaClause.areaId = areaId;
    }

    // Time filter bounds (computed in UTC / ISO)
    const timeClause: Where<Complaint> = {};
    const now = new Date();
    if (time === 'TODAY') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      timeClause.createdAt = { gte: todayStart.toISOString() };
    } else if (time === 'WEEK') {
      const weekStart = new Date(now.getTime() - 7 * 86400000);
      timeClause.createdAt = { gte: weekStart.toISOString() };
    } else if (time === 'MONTH') {
      const monthStart = new Date(now.getTime() - 30 * 86400000);
      timeClause.createdAt = { gte: monthStart.toISOString() };
    }

    // Base WHERE for current time horizon + area scope
    const timeAndAreaWhere: Where<Complaint> = {
      ...baseScope,
      ...areaClause,
      ...timeClause,
    };

    // Specific WHERE for the requested status filter
    const queryWhere: Where<Complaint> = {
      ...timeAndAreaWhere,
      ...(status !== 'ALL' ? { status: status as ComplaintStatus } : {}),
    };

    const offset = (page - 1) * pageSize;
    const orderDir: 'asc' | 'desc' = sortBy === 'LATEST' ? 'desc' : 'asc';

    // Run parallel high-concurrency optimized queries
    const [
      paginatedComplaints,
      totalMatching,
      countAll,
      countOpen,
      countEscalated,
      countResolved,
      allTimeTotal,
      oldestOpenComplaint,
      recentResolvedSample,
      areasList,
      regionsList,
    ] = await Promise.all([
      // 1. Paginated records with DB LIMIT & OFFSET
      store.complaints.find({
        where: queryWhere,
        orderBy: [{ field: 'createdAt', dir: orderDir }],
        limit: pageSize,
        offset,
      }),
      // 2. Exact count matching the current query filter
      store.complaints.count(queryWhere),
      // 3. Status tab counts within the current time & area scope
      store.complaints.count(timeAndAreaWhere),
      store.complaints.count({ ...timeAndAreaWhere, status: 'OPEN' }),
      store.complaints.count({ ...timeAndAreaWhere, status: 'ESCALATED' }),
      store.complaints.count({ ...timeAndAreaWhere, status: 'RESOLVED' }),
      // 4. Overall all-time count
      store.complaints.count(baseScope),
      // 5. Oldest open complaint for KPI
      store.complaints.findOne({
        where: { ...timeAndAreaWhere, status: { ne: 'RESOLVED' } } as Where<Complaint>,
        orderBy: [{ field: 'createdAt', dir: 'asc' }],
      }),
      // 6. Recent resolved for avg resolution time metric & widget
      store.complaints.find({
        where: { ...timeAndAreaWhere, status: 'RESOLVED' },
        orderBy: [{ field: 'resolvedAt', dir: 'desc' }],
        limit: 30,
      }),
      // 7. Area reference list
      store.areas.find(),
      // 8. Region reference list
      store.regions.find({ orderBy: [{ field: 'name' }] }),
    ]);

    // Batch fetch only the customers and staff present on this page
    const customerIds = Array.from(
      new Set([
        ...paginatedComplaints.map((c) => c.customerId),
        ...recentResolvedSample.map((c) => c.customerId),
      ]),
    ).filter(Boolean);

    const staffIds = Array.from(
      new Set([
        ...paginatedComplaints.map((c) => c.staffId).filter(Boolean),
        ...recentResolvedSample.map((c) => c.staffId).filter(Boolean),
      ]),
    ) as string[];

    const visitIds = Array.from(
      new Set([
        ...paginatedComplaints.map((c) => c.visitId).filter(Boolean),
        ...recentResolvedSample.map((c) => c.visitId).filter(Boolean),
      ]),
    ) as string[];

    const [pageCustomers, pageStaff, pageVisits] = await Promise.all([
      customerIds.length
        ? store.customers.find({ where: { id: { in: customerIds } } as never })
        : [],
      staffIds.length
        ? store.staff.find({ where: { id: { in: staffIds } } as never })
        : [],
      visitIds.length
        ? store.visits.find({ where: { id: { in: visitIds } } as never })
        : [],
    ]);

    // Average resolution time calculation
    const resolutionDurations = recentResolvedSample
      .filter((c) => c.resolvedAt)
      .map(
        (c) =>
          (new Date(c.resolvedAt!).getTime() - new Date(c.createdAt).getTime()) /
          86400000,
      );

    const avgResolutionDays = resolutionDurations.length
      ? (
          resolutionDurations.reduce((acc, v) => acc + v, 0) /
          resolutionDurations.length
        ).toFixed(1) + 'd'
      : '—';

    const totalPages = Math.max(1, Math.ceil(totalMatching / pageSize));

    return NextResponse.json({
      ok: true,
      complaints: paginatedComplaints,
      customers: pageCustomers,
      staff: pageStaff,
      areas: areasList,
      regions: regionsList,
      visits: pageVisits,
      pagination: {
        page,
        pageSize,
        totalItems: totalMatching,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      counts: {
        all: countAll,
        open: countOpen,
        escalated: countEscalated,
        resolved: countResolved,
        allTimeTotal,
      },
      kpis: {
        open: countOpen,
        escalated: countEscalated,
        resolved: countResolved,
        avgResolutionTime: avgResolutionDays,
        oldestOpen: oldestOpenComplaint
          ? {
              createdAt: oldestOpenComplaint.createdAt,
              id: oldestOpenComplaint.id,
            }
          : null,
      },
      recentlyResolved: recentResolvedSample.slice(0, 8),
    });
  } catch (error) {
    return opsError(error);
  }
}

import { currentCycle, formatDateFull } from '@/lib/util/format';

const schema = z.object({
  complaintId: z.string().min(1),
  action: z.enum(['resolve', 'escalate']),
  resolution: z.string().max(500).optional(),
  grantFreeWash: z.boolean().optional(),
  freeWashCarId: z.string().optional(),
  freeWashDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  freeWashServices: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('complaint:view');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }

    const store = await getStore();
    const complaint = await store.complaints.get(parsed.data.complaintId);
    if (!complaint) throw new HttpError(404, 'Complaint not found.');
    assertInScope(session, complaint.areaId);

    if (parsed.data.action === 'escalate') {
      const updated = await store.complaints.update(complaint.id, {
        status: 'ESCALATED',
      });
      revalidateComplaintPages();
      return NextResponse.json({
        ok: true,
        complaint: updated,
        message: 'Escalated to the owner.',
      });
    }

    if (complaint.status === 'RESOLVED') {
      throw new HttpError(409, 'This complaint is already closed.');
    }

    if (!parsed.data.resolution?.trim()) {
      throw new HttpError(400, 'Say what you did before closing this.');
    }

    let freeWashVisit = null;

    if (parsed.data.grantFreeWash) {
      const customer = await store.customers.get(complaint.customerId);
      if (!customer) throw new HttpError(404, 'Customer associated with complaint not found.');

      const customerCars = await store.cars.find({
        where: { customerId: customer.id, active: true } as never,
      });

      if (customerCars.length === 0) {
        throw new HttpError(400, 'Customer has no active cars to assign a free wash to.');
      }

      const car = parsed.data.freeWashCarId
        ? customerCars.find((c) => c.id === parsed.data.freeWashCarId) || customerCars[0]
        : customerCars[0];

      const freeWashDate = parsed.data.freeWashDate ||
        new Date(Date.now() + 86400000).toISOString().slice(0, 10);

      const pkg = car.packageId ? await store.packages.get(car.packageId) : null;
      const subServices = parsed.data.freeWashServices && parsed.data.freeWashServices.length > 0
        ? parsed.data.freeWashServices
        : (pkg?.services || ['Exterior wash']);

      freeWashVisit = await store.visits.create({
        carId: car.id,
        customerId: customer.id,
        areaId: customer.areaId,
        staffId: car.assignedStaffId ?? null,
        cycle: currentCycle(),
        scheduledDate: freeWashDate,
        scheduledTime: car.scheduleTime || '07:00 AM',
        status: 'PENDING',
        startedAt: null,
        completedAt: null,
        plannedService: null,
        servicesDone: subServices,
        beforePhotoUrl: null,
        afterPhotoUrl: null,
        beforePhotoBytes: null,
        afterPhotoBytes: null,
        missReason: null,
        missNote: `[Free Compensatory Wash] ${parsed.data.resolution.trim()}`,
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

    const resolutionText = parsed.data.grantFreeWash && freeWashVisit
      ? `${parsed.data.resolution.trim()} (Free compensatory wash scheduled for ${formatDateFull(freeWashVisit.scheduledDate)})`
      : parsed.data.resolution.trim();

    const updated = await store.complaints.update(complaint.id, {
      status: 'RESOLVED',
      resolution: resolutionText,
      resolvedAt: new Date().toISOString(),
      handledByUserId: session.user.id,
    });

    revalidateComplaintPages();
    return NextResponse.json({
      ok: true,
      complaint: updated,
      freeWashVisit,
      message: parsed.data.grantFreeWash
        ? 'Complaint resolved and free compensatory wash scheduled.'
        : 'Closed and the customer has been told.',
    });
  } catch (error) {
    return opsError(error);
  }
}
