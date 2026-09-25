import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';
import { formatClock, formatDateFull } from '@/lib/util/format';
import { washDurationMinutes, formatDurationMinutes, washSpeedFlag } from '@/lib/util/washTiming';
import { scopeAreaFilter } from '@/lib/auth/rbac';

const querySchema = z.object({
  staffId: z.string().optional(),
  areaId: z.string().optional(),
  cycle: z.string().optional(),
  speedType: z.enum(['ALL', 'fast', 'slow']).default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const session = await requireApiSession('visit:view');
    const url = new URL(request.url);

    const parseResult = querySchema.safeParse({
      staffId: url.searchParams.get('staffId') || undefined,
      areaId: url.searchParams.get('areaId') || undefined,
      cycle: url.searchParams.get('cycle') || undefined,
      speedType: url.searchParams.get('speedType') || undefined,
      page: url.searchParams.get('page') || undefined,
      pageSize: url.searchParams.get('pageSize') || undefined,
      search: url.searchParams.get('search') || undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message ?? 'Invalid query parameters' },
        { status: 400 },
      );
    }

    const { staffId, areaId, cycle, speedType, page, pageSize, search } = parseResult.data;
    const store = await getStore();
    const settings = await store.getAppSettings();
    const areaScopeFilter = scopeAreaFilter(session.scope);

    // Prepare visit filters
    const whereClause: Record<string, unknown> = {
      status: 'DONE',
      ...areaScopeFilter,
    };
    if (staffId) whereClause.staffId = staffId;
    if (areaId) whereClause.areaId = areaId;
    if (cycle) whereClause.cycle = cycle;

    const allDoneVisits = await store.visits.find({
      where: whereClause as never,
      orderBy: [{ field: 'completedAt', dir: 'desc' }],
      limit: 1000,
    });

    // Compute duration & speed flag for each visit
    const flaggedVisitsWithMetadata = [];
    for (const visit of allDoneVisits) {
      const duration = washDurationMinutes(visit);
      const flag = washSpeedFlag(duration, settings);
      if (!flag) continue;
      flaggedVisitsWithMetadata.push({
        visit,
        durationMinutes: duration,
        speedFlag: flag,
      });
    }

    // Filter by speedType if requested
    let filtered = flaggedVisitsWithMetadata;
    if (speedType !== 'ALL') {
      filtered = filtered.filter((item) => item.speedFlag === speedType);
    }

    // Fetch related entities (customers, cars, staff, areas)
    const customerIds = [...new Set(filtered.map((item) => item.visit.customerId))];
    const carIds = [...new Set(filtered.map((item) => item.visit.carId))];
    const staffIds = [
      ...new Set(
        filtered.map((item) => item.visit.staffId).filter((id): id is string => Boolean(id)),
      ),
    ];
    const areaIds = [...new Set(filtered.map((item) => item.visit.areaId))];

    const [customers, cars, staffList, areas] = await Promise.all([
      customerIds.length
        ? store.customers.find({ where: { id: { in: customerIds } } as never })
        : [],
      carIds.length ? store.cars.find({ where: { id: { in: carIds } } as never }) : [],
      staffIds.length ? store.staff.find({ where: { id: { in: staffIds } } as never }) : [],
      store.areas.find(),
    ]);

    const customerById = new Map(customers.map((c) => [c.id, c]));
    const carById = new Map(cars.map((c) => [c.id, c]));
    const staffById = new Map(staffList.map((s) => [s.id, s]));
    const areaById = new Map(areas.map((a) => [a.id, a.name]));

    // Map formatted response items
    let items = filtered.map(({ visit, durationMinutes, speedFlag }) => {
      const customer = customerById.get(visit.customerId);
      const car = carById.get(visit.carId);
      const staff = visit.staffId ? staffById.get(visit.staffId) : null;
      const areaName = areaById.get(visit.areaId) ?? 'Unknown Area';

      return {
        id: visit.id,
        scheduledDate: visit.scheduledDate,
        dateLabel: formatDateFull(visit.scheduledDate),
        timeLabel: visit.scheduledTime,
        startedAtLabel: visit.startedAt ? formatClock(visit.startedAt) : null,
        completedAtLabel: visit.completedAt ? formatClock(visit.completedAt) : null,
        durationMinutes,
        durationLabel: durationMinutes !== null ? formatDurationMinutes(durationMinutes) : '—',
        speedFlag,
        speedThresholdMin: settings.minWashMinutes,
        speedThresholdMax: settings.maxWashMinutes,
        plannedService: visit.plannedService ?? 'Standard Wash',
        servicesDone: visit.servicesDone || [],
        rating: visit.rating,
        ratingComment: visit.ratingComment,
        managerRating: visit.managerRating,
        managerRatingComment: visit.managerRatingComment,
        beforePhotoUrl: visit.beforePhotoUrl ? resolvePublicPhotoUrl(visit.beforePhotoUrl) : null,
        afterPhotoUrl: visit.afterPhotoUrl ? resolvePublicPhotoUrl(visit.afterPhotoUrl) : null,
        customer: {
          id: customer?.id ?? visit.customerId,
          name: customer?.name ?? 'Customer',
          phone: customer?.phone ?? '',
          address: customer?.address ?? '',
        },
        car: {
          id: car?.id ?? visit.carId,
          make: car?.make ?? '',
          model: car?.model ?? 'Car',
          plateNumber: car?.plate ?? '—',
          color: car?.colour ?? '',
        },
        staff: staff
          ? {
              id: staff.id,
              name: staff.name,
              phone: staff.phone,
            }
          : null,
        areaName,
      };
    });

    // Apply search filter if provided
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      items = items.filter(
        (i) =>
          i.customer.name.toLowerCase().includes(q) ||
          i.customer.phone.toLowerCase().includes(q) ||
          i.car.plateNumber.toLowerCase().includes(q) ||
          i.car.model.toLowerCase().includes(q) ||
          (i.staff && i.staff.name.toLowerCase().includes(q)) ||
          i.areaName.toLowerCase().includes(q),
      );
    }

    const totalFlagged = flaggedVisitsWithMetadata.length;
    const fastCount = flaggedVisitsWithMetadata.filter((i) => i.speedFlag === 'fast').length;
    const slowCount = flaggedVisitsWithMetadata.filter((i) => i.speedFlag === 'slow').length;

    const totalFiltered = items.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const paginatedItems = items.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({
      items: paginatedItems,
      stats: {
        totalFlagged,
        fastCount,
        slowCount,
        minWashMinutes: settings.minWashMinutes,
        maxWashMinutes: settings.maxWashMinutes,
      },
      pagination: {
        page,
        pageSize,
        totalItems: totalFiltered,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
