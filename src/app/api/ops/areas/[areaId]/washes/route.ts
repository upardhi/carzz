import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { todayISO } from '@/lib/util/format';
import type { VisitStatus, WashVisit } from '@/lib/data/types';
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ areaId: string }> },
) {
  try {
    const session = await requireApiSession();
    const { areaId } = await params;

    // RBAC check: if user has scoped areaIds, verify this areaId is allowed
    if (session.scope.areaIds && !session.scope.areaIds.includes(areaId)) {
      return NextResponse.json({ error: 'Unauthorized for this area' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(5, parseInt(searchParams.get('pageSize') || '20', 10)));
    const search = (searchParams.get('search') || '').trim().toLowerCase();
    const status = (searchParams.get('status') || 'ALL').trim().toUpperCase();
    const view = (searchParams.get('view') || 'all').trim().toLowerCase(); // 'today' | 'upcoming' | 'past' | 'all'
    const today = todayISO();

    const store = await getStore();
    const area = await store.areas.get(areaId);
    if (!area) {
      return NextResponse.json({ error: 'Area not found' }, { status: 404 });
    }

    // Build where filter for store.visits
    const where: Record<string, unknown> = { areaId };
    // Composite AND clauses — used when we need more than one OR group at
    // once (e.g. the history date/status rule combined with search).
    const andClauses: Record<string, unknown>[] = [];

    if (status !== 'ALL') {
      where.status = status as VisitStatus;
    }

    if (view === 'today') {
      where.scheduledDate = today;
    } else if (view === 'upcoming') {
      where.scheduledDate = { gt: today };
    } else if (view === 'past') {
      where.scheduledDate = { lt: today };
    } else {
      // view === 'all' / 'history' (Overall Washes tab)
      // A visit belongs in history once it has been resolved (done/missed),
      // regardless of its scheduled date — a wash boy can complete a future
      // slot early — or once its scheduled date has passed either way.
      if (status === 'ALL') {
        // Nested filters bypass the repository's top-level date-field
        // casting, so the date boundary here must already be a real Date —
        // a raw "YYYY-MM-DD" string fails Prisma's DateTime parsing.
        andClauses.push({
          OR: [
            { scheduledDate: { lte: new Date(`${today}T00:00:00.000Z`) } },
            { status: { in: ['DONE', 'MISSED'] } },
          ],
        });
      } else if (status !== 'DONE' && status !== 'MISSED') {
        where.scheduledDate = { lte: today };
      }
      // else: status is explicitly DONE or MISSED — already resolved, no
      // date restriction needed.
    }

    // Fetch visits sorted by scheduledDate DESC, scheduledTime ASC
    const orderBy =
      view === 'upcoming'
        ? [{ field: 'scheduledDate' as keyof WashVisit, dir: 'asc' as const }, { field: 'scheduledTime' as keyof WashVisit, dir: 'asc' as const }]
        : [{ field: 'scheduledDate' as keyof WashVisit, dir: 'desc' as const }, { field: 'scheduledTime' as keyof WashVisit, dir: 'asc' as const }];

    // Fetch total count and paged visits using indexed DB pagination
    let totalCount = 0;
    let pagedVisits: WashVisit[] = [];

    if (search) {
      // Find matching customer, car, or staff IDs scoped to this area
      const areaCustomers = await store.customers.find({ where: { areaId } as never });
      const matchedCustomerIds = areaCustomers
        .filter((c) => c.name.toLowerCase().includes(search))
        .map((c) => c.id);

      const areaCustomerIds = areaCustomers.map((c) => c.id);
      const areaCars = areaCustomerIds.length
        ? await store.cars.find({ where: { customerId: { in: areaCustomerIds } } as never })
        : [];
      const matchedCarIds = areaCars
        .filter((c) => (c.plate || '').toLowerCase().includes(search) || (c.model || '').toLowerCase().includes(search))
        .map((c) => c.id);

      const areaStaff = await store.staff.find({ where: { areaId } as never });
      const matchedStaffIds = areaStaff
        .filter((s) => s.name.toLowerCase().includes(search))
        .map((s) => s.id);

      if (matchedCustomerIds.length === 0 && matchedCarIds.length === 0 && matchedStaffIds.length === 0) {
        return NextResponse.json({
          area: {
            id: area.id,
            name: area.name,
            city: area.city,
            address: area.address,
          },
          page,
          pageSize,
          totalCount: 0,
          totalPages: 0,
          items: [],
        });
      }

      const orClauses: Record<string, unknown>[] = [];
      if (matchedCustomerIds.length > 0) orClauses.push({ customerId: { in: matchedCustomerIds } });
      if (matchedCarIds.length > 0) orClauses.push({ carId: { in: matchedCarIds } });
      if (matchedStaffIds.length > 0) orClauses.push({ staffId: { in: matchedStaffIds } });
      andClauses.push({ OR: orClauses });
    }

    if (andClauses.length === 1) {
      Object.assign(where, andClauses[0]);
    } else if (andClauses.length > 1) {
      where.AND = andClauses;
    }

    const offset = (page - 1) * pageSize;

    [totalCount, pagedVisits] = await Promise.all([
      store.visits.count(where as never),
      store.visits.find({
        where: where as never,
        orderBy,
        limit: pageSize,
        offset,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / pageSize);

    // Fetch relations ONLY for the paged visits (max pageSize items)
    const pageCustomerIds = [...new Set(pagedVisits.map((v) => v.customerId))];
    const pageCarIds = [...new Set(pagedVisits.map((v) => v.carId))];
    const pageStaffIds = [...new Set(pagedVisits.map((v) => v.staffId).filter(Boolean) as string[])];

    const [customers, cars, staffMembers] = await Promise.all([
      pageCustomerIds.length
        ? store.customers.find({ where: { id: { in: pageCustomerIds } } as never })
        : Promise.resolve([]),
      pageCarIds.length
        ? store.cars.find({ where: { id: { in: pageCarIds } } as never })
        : Promise.resolve([]),
      pageStaffIds.length
        ? store.staff.find({ where: { id: { in: pageStaffIds } } as never })
        : Promise.resolve([]),
    ]);

    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const carMap = new Map(cars.map((c) => [c.id, c]));
    const staffMap = new Map(staffMembers.map((s) => [s.id, s]));

    const items = pagedVisits.map((v) => {
      const customer = customerMap.get(v.customerId);
      const car = carMap.get(v.carId);
      const staff = v.staffId ? staffMap.get(v.staffId) : null;

      return {
        id: v.id,
        scheduledDate: v.scheduledDate,
        scheduledTime: v.scheduledTime,
        status: v.status,
        completedAt: v.completedAt,
        startedAt: v.startedAt,
        onTime: v.onTime,
        rating: v.rating,
        ratingComment: v.ratingComment,
        missReason: v.missReason,
        missNote: v.missNote,
        beforePhotoUrl: resolvePublicPhotoUrl(v.beforePhotoUrl),
        afterPhotoUrl: resolvePublicPhotoUrl(v.afterPhotoUrl),
        beforePhotoBytes: v.beforePhotoBytes,
        afterPhotoBytes: v.afterPhotoBytes,
        servicesDone: v.servicesDone,
        customer: {
          id: v.customerId,
          name: customer?.name || 'Customer',
          phone: customer?.phone || '—',
          address: customer?.address || '',
        },
        car: {
          id: v.carId,
          plate: car?.plate || '—',
          model: car?.model || '—',
          color: car?.colour || '',
          parkingSpot: car?.specialInstructions || '',
        },
        staff: staff
          ? {
              id: staff.id,
              name: staff.name,
              phone: staff.phone,
            }
          : null,
      };
    });

    return NextResponse.json({
      area: {
        id: area.id,
        name: area.name,
        city: area.city,
        address: area.address,
      },
      page,
      pageSize,
      totalCount,
      totalPages,
      items,
    });
  } catch (error) {
    console.error('[API /api/ops/areas/[areaId]/washes error]:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch area washes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
