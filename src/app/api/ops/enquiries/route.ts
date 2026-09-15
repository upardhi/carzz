import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import { assertInScope, opsError } from '../_guard';

function revalidateEnquiryPages() {
  try {
    for (const base of ['/admin', '/manager', '/area']) {
      revalidatePath(`${base}/enquiries`);
    }
  } catch {
    // ignore — running outside a request context
  }
}

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(['ALL', 'NEW', 'CONTACTED', 'CONVERTED', 'LOST']).default('ALL'),
  areaId: z.string().optional(),
  search: z.string().default(''),
  sortBy: z.enum(['createdAt', 'name', 'status']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

const patchSchema = z.object({
  enquiryId: z.string().min(1),
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'LOST']),
  convertedCustomerId: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const session = await requireApiSession('enquiry:view');
    const url = new URL(request.url);

    const parseResult = querySchema.safeParse({
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      areaId: url.searchParams.get('areaId') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      sortBy: url.searchParams.get('sortBy') ?? undefined,
      sortDir: url.searchParams.get('sortDir') ?? undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    const { page, pageSize, status, areaId, search, sortBy, sortDir } = parseResult.data;
    const store = await getStore();

    // Area scoping from session
    const scopedAreaFilter = scopeAreaFilter(session.scope);
    const whereClause: Record<string, unknown> = { ...scopedAreaFilter };

    if (areaId && areaId !== 'ALL') {
      assertInScope(session, areaId);
      whereClause.areaId = areaId;
    }

    if (status !== 'ALL') {
      whereClause.status = status;
    }

    const trimmedSearch = search.trim();
    if (trimmedSearch) {
      if (trimmedSearch.includes('@')) {
        whereClause.email = { contains: trimmedSearch };
      } else if (/^\+?\d+$/.test(trimmedSearch)) {
        whereClause.phone = { contains: trimmedSearch };
      } else {
        whereClause.name = { contains: trimmedSearch };
      }
    }

    // Fetch total and matching paginated items
    const [
      items,
      totalMatching,
      countNew,
      countContacted,
      countConverted,
      countLost,
      countAll,
      areas,
      packages,
    ] = await Promise.all([
      store.enquiries.find({
        where: whereClause as never,
        orderBy: [{ field: sortBy, dir: sortDir }],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      store.enquiries.count(whereClause as never),
      store.enquiries.count({ status: 'NEW', ...scopedAreaFilter } as never),
      store.enquiries.count({ status: 'CONTACTED', ...scopedAreaFilter } as never),
      store.enquiries.count({ status: 'CONVERTED', ...scopedAreaFilter } as never),
      store.enquiries.count({ status: 'LOST', ...scopedAreaFilter } as never),
      store.enquiries.count({ ...scopedAreaFilter } as never),
      store.areas.find({ orderBy: [{ field: 'name' }] }),
      store.packages.find(),
    ]);

    // Check if phone numbers are already linked to customers
    const phones = items.map((i) => i.phone);
    const existingCustomers = phones.length
      ? await store.customers.find({
          where: { phone: { in: phones } } as never,
        })
      : [];

    const existingCustomerPhoneMap: Record<string, { id: string; name: string; areaId: string }> = {};
    for (const c of existingCustomers) {
      existingCustomerPhoneMap[c.phone] = {
        id: c.id,
        name: c.name,
        areaId: c.areaId,
      };
    }

    const totalPages = Math.max(1, Math.ceil(totalMatching / pageSize));

    return NextResponse.json({
      items,
      existingCustomerPhoneMap,
      areas,
      packages,
      kpis: {
        all: countAll,
        new: countNew,
        contacted: countContacted,
        converted: countConverted,
        lost: countLost,
      },
      pagination: {
        page,
        pageSize,
        totalItems: totalMatching,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    return opsError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireApiSession('enquiry:manage');
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input data.' },
        { status: 400 },
      );
    }

    const store = await getStore();
    const enquiry = await store.enquiries.get(parsed.data.enquiryId);
    if (!enquiry) {
      throw new HttpError(404, 'Enquiry not found.');
    }

    if (enquiry.areaId) {
      assertInScope(session, enquiry.areaId);
    }

    const updated = await store.enquiries.update(enquiry.id, {
      status: parsed.data.status,
      handledByUserId: session.user.id,
      handledAt: new Date().toISOString(),
      convertedCustomerId: parsed.data.convertedCustomerId ?? enquiry.convertedCustomerId,
    });

    revalidateEnquiryPages();
    return NextResponse.json({
      ok: true,
      enquiry: updated,
      message: `Enquiry status updated to ${parsed.data.status}.`,
    });
  } catch (error) {
    return opsError(error);
  }
}
