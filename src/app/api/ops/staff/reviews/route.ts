import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';
import { formatClock, formatDateFull } from '@/lib/util/format';
import { washDurationMinutes, formatDurationMinutes } from '@/lib/util/washTiming';
import { opsError } from '../../_guard';

const querySchema = z.object({
  staffId: z.string().min(1, 'Staff ID is required'),
  ratingFilter: z.enum(['ALL', '5', '4', '3', 'LOW', 'MANAGER', 'WITH_COMMENTS']).default('ALL'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(request: Request) {
  try {
    const _session = await requireApiSession('staff:view');
    const url = new URL(request.url);

    const parseResult = querySchema.safeParse({
      staffId: url.searchParams.get('staffId') ?? undefined,
      ratingFilter: url.searchParams.get('ratingFilter') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message ?? 'Invalid query parameters' },
        { status: 400 },
      );
    }

    const { staffId, ratingFilter, page, pageSize } = parseResult.data;
    const store = await getStore();

    const staff = await store.staff.get(staffId);
    if (!staff) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    // Fetch all completed visits with any feedback (customer rating, manager rating, or comments)
    const allVisits = await store.visits.find({
      where: { staffId, status: 'DONE' } as never,
      orderBy: [{ field: 'completedAt', dir: 'desc' }],
      limit: 500,
    });

    // Filter to those that have ratings or comments
    const feedbackVisits = allVisits.filter(
      (v) =>
        v.rating !== null ||
        v.managerRating !== null ||
        Boolean(v.ratingComment) ||
        Boolean(v.managerRatingComment),
    );

    // Calculate aggregated statistics
    const customerRatings = feedbackVisits.filter((v) => v.rating !== null);
    const managerRatings = feedbackVisits.filter((v) => v.managerRating !== null);
    const commentReviews = feedbackVisits.filter((v) => Boolean(v.ratingComment));

    const avgCustomerRating = customerRatings.length
      ? Number(
          (
            customerRatings.reduce((sum, v) => sum + (v.rating ?? 0), 0) /
            customerRatings.length
          ).toFixed(1),
        )
      : null;

    const avgManagerRating = managerRatings.length
      ? Number(
          (
            managerRatings.reduce((sum, v) => sum + (v.managerRating ?? 0), 0) /
            managerRatings.length
          ).toFixed(1),
        )
      : null;

    const starCounts = {
      five: customerRatings.filter((v) => v.rating === 5).length,
      four: customerRatings.filter((v) => v.rating === 4).length,
      three: customerRatings.filter((v) => v.rating === 3).length,
      two: customerRatings.filter((v) => v.rating === 2).length,
      one: customerRatings.filter((v) => v.rating === 1).length,
    };

    const lowRatedCount = customerRatings.filter((v) => (v.rating ?? 5) < 3).length;

    // Apply ratingFilter
    let filtered = feedbackVisits;
    if (ratingFilter === '5') {
      filtered = feedbackVisits.filter((v) => v.rating === 5);
    } else if (ratingFilter === '4') {
      filtered = feedbackVisits.filter((v) => v.rating === 4);
    } else if (ratingFilter === '3') {
      filtered = feedbackVisits.filter((v) => v.rating === 3);
    } else if (ratingFilter === 'LOW') {
      filtered = feedbackVisits.filter((v) => (v.rating !== null && v.rating < 3));
    } else if (ratingFilter === 'MANAGER') {
      filtered = feedbackVisits.filter((v) => v.managerRating !== null || Boolean(v.managerRatingComment));
    } else if (ratingFilter === 'WITH_COMMENTS') {
      filtered = feedbackVisits.filter((v) => Boolean(v.ratingComment));
    }

    const totalMatching = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalMatching / pageSize));
    const offset = (page - 1) * pageSize;
    const paginatedVisits = filtered.slice(offset, offset + pageSize);

    // Fetch Customers and Cars for the paginated slice
    const customerIds = [...new Set(paginatedVisits.map((v) => v.customerId))];
    const carIds = [...new Set(paginatedVisits.map((v) => v.carId))];

    const [customers, cars, areas] = await Promise.all([
      customerIds.length
        ? store.customers.find({ where: { id: { in: customerIds } } as never })
        : [],
      carIds.length
        ? store.cars.find({ where: { id: { in: carIds } } as never })
        : [],
      store.areas.find(),
    ]);

    const customerById = new Map(customers.map((c) => [c.id, c]));
    const carById = new Map(cars.map((c) => [c.id, c]));
    const areaById = new Map(areas.map((a) => [a.id, a]));

    const reviews = paginatedVisits.map((v) => {
      const customer = customerById.get(v.customerId);
      const car = carById.get(v.carId);
      const area = areaById.get(v.areaId);
      const duration = washDurationMinutes(v);

      return {
        id: v.id,
        scheduledDate: v.scheduledDate,
        dateLabel: formatDateFull(v.completedAt || v.scheduledDate),
        timeLabel: v.completedAt ? formatClock(v.completedAt) : v.scheduledTime,
        startedAtLabel: v.startedAt ? formatClock(v.startedAt) : null,
        completedAtLabel: v.completedAt ? formatClock(v.completedAt) : null,
        durationLabel: duration !== null ? formatDurationMinutes(duration) : null,
        onTime: v.onTime,
        servicesDone: v.servicesDone || [],
        rating: v.rating,
        ratingComment: v.ratingComment,
        managerRating: v.managerRating,
        managerRatingComment: v.managerRatingComment,
        managerRatedAt: v.managerRatedAt ? formatDateFull(v.managerRatedAt) : null,
        beforePhotoUrl: resolvePublicPhotoUrl(v.beforePhotoUrl),
        afterPhotoUrl: resolvePublicPhotoUrl(v.afterPhotoUrl),
        customer: {
          id: customer?.id ?? v.customerId,
          name: customer?.name ?? 'Customer',
          phone: customer?.phone ?? '—',
        },
        car: {
          id: car?.id ?? v.carId,
          make: car?.make ?? '',
          model: car?.model ?? '',
          plateNumber: car?.plate ?? 'Car',
          color: car?.colour ?? '',
        },
        areaName: area?.name ?? 'Area',
      };
    });

    return NextResponse.json({
      ok: true,
      staff: {
        id: staff.id,
        name: staff.name,
        phone: staff.phone,
        active: staff.active,
        areaId: staff.areaId,
      },
      stats: {
        totalFeedback: feedbackVisits.length,
        totalWashesDone: allVisits.length,
        avgCustomerRating,
        customerRatingCount: customerRatings.length,
        avgManagerRating,
        managerRatingCount: managerRatings.length,
        commentsCount: commentReviews.length,
        lowRatedCount,
        starCounts,
      },
      pagination: {
        page,
        pageSize,
        totalItems: totalMatching,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      reviews,
    });
  } catch (err) {
    return opsError(err);
  }
}
