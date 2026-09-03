import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { computePayoutRun } from '@/lib/services/payroll';
import { currentCycle } from '@/lib/util/format';
import { assertInScope, opsError } from '../_guard';

export async function GET(request: Request) {
  try {
    const session = await requireApiSession('staff:view');
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const status = url.searchParams.get('status') || 'ALL';
    const staffId = url.searchParams.get('staffId');
    const areaId = url.searchParams.get('areaId');
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    const store = await getStore();
    const cycle = currentCycle();

    // Step 1: Fetch only the staff (and settings) we need — scoped to session areas.
    // Staff are small in number (~10-100 per scope), so this is fine.
    const [staffList, areas, rules] = await Promise.all([
      store.staff.find({
        where: {
          role: 'EMPLOYEE',
          ...(session.scope.areaIds ? { areaId: { in: session.scope.areaIds } } : {}),
          ...(areaId ? { areaId } : {}),
          ...(staffId ? { id: staffId } : {}),
        } as never,
        orderBy: [{ field: 'name' }],
      }),
      store.areas.find(),
      store.getPayoutSettings(),
    ]);

    const areaMap = new Map(areas.map((a) => [a.id, a]));

    // Step 2: If text search is requested, narrow the staff list in memory first
    // (name/phone search cannot be pushed to DB cross-table through the current port)
    const matchedStaff = q
      ? staffList.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.phone.includes(q),
        )
      : staffList;

    const matchedStaffIds = matchedStaff.map((s) => s.id);
    const staffMap = new Map(matchedStaff.map((s) => [s.id, s]));

    if (matchedStaffIds.length === 0) {
      return NextResponse.json({
        ok: true,
        data: [],
        pagination: { page, limit, total: 0, totalPages: 1 },
        stats: {
          totalCount: 0,
          pendingCount: 0,
          pendingAmount: 0,
          approvedCount: 0,
          approvedAmount: 0,
          rejectedCount: 0,
        },
      });
    }

    // Step 3: Build the DB-level where clause for the paginated data
    const requestWhere: Record<string, unknown> = {
      staffId: { in: matchedStaffIds },
    };
    if (status !== 'ALL') {
      requestWhere.status = status === 'APPROVED'
        ? { in: ['APPROVED', 'PAID'] as const }
        : status;
    }

    const staffIdIn = { in: matchedStaffIds } as const;
    const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

    // Step 4: Execute database queries in parallel:
    //   - DB count queries for stats cards (no full list fetched!)
    //   - DB find for only pending/approved amount calculation
    //   - DB count for total matching pagination
    //   - DB find with limit & offset for the current page rows
    //   - computePayoutRun for allowance limits (60s cached)
    const [
      totalCount,
      pendingCount,
      approvedCount,
      rejectedCount,
      pendingRequests,
      approvedRequests,
      total,
      paginated,
      payoutRun,
    ] = await Promise.all([
      store.pocketRequests.count({ staffId: staffIdIn } as never),
      store.pocketRequests.count({ staffId: staffIdIn, status: 'PENDING' } as never),
      store.pocketRequests.count({ staffId: staffIdIn, status: { in: ['APPROVED', 'PAID'] } } as never),
      store.pocketRequests.count({ staffId: staffIdIn, status: 'REJECTED' } as never),
      store.pocketRequests.find({ where: { staffId: staffIdIn, status: 'PENDING' } as never }),
      store.pocketRequests.find({ where: { staffId: staffIdIn, status: { in: ['APPROVED', 'PAID'] } } as never }),
      store.pocketRequests.count(requestWhere as never),
      store.pocketRequests.find({
        where: requestWhere as never,
        orderBy: [{ field: 'requestedAt', dir: 'desc' }],
        limit,
        offset: (page - 1) * limit,
      }),
      computePayoutRun(store, cycle, session.scope.areaIds),
    ]);

    const stats = {
      totalCount,
      pendingCount,
      pendingAmount: pendingRequests.reduce((sum, r) => sum + r.amount, 0),
      approvedCount,
      approvedAmount: approvedRequests.reduce((sum, r) => sum + r.amount, 0),
      rejectedCount,
    };

    const totalPages = Math.ceil(total / limit) || 1;

    // Fetch weekly taken only for the staff members present on the current page
    const pageStaffIds = [...new Set(paginated.map((r) => r.staffId))];
    const weeklyTakenRequests = pageStaffIds.length > 0
      ? await store.pocketRequests.find({
          where: {
            staffId: { in: pageStaffIds },
            status: { in: ['APPROVED', 'PAID'] },
            requestedAt: { gte: weekAgo },
          } as never,
        })
      : [];

    const payoutByStaffId = new Map(payoutRun.map((p) => [p.staffId, p]));
    const weeklyTakenByStaff = new Map<string, number>();
    for (const r of weeklyTakenRequests) {
      weeklyTakenByStaff.set(r.staffId, (weeklyTakenByStaff.get(r.staffId) ?? 0) + r.amount);
    }

    // Step 7: Derive allowance values in-memory from the precomputed payout map.
    // Zero async work per row — all data is already in memory.
    const items = paginated.map((r) => {
      const member = staffMap.get(r.staffId);
      const area = member ? areaMap.get(member.areaId) : null;
      const payout = payoutByStaffId.get(r.staffId);

      let available = 0;
      let inAccount = 0;
      let weeklyCap = 0;
      let takenThisWeek = 0;
      let overCap = false;

      if (payout) {
        const earned = payout.base + payout.bonuses + payout.referrals;
        weeklyCap = Math.round((earned * rules.pocketWeeklyCapPercent) / 100);
        inAccount = Math.max(0, payout.net);
        takenThisWeek = weeklyTakenByStaff.get(r.staffId) ?? 0;
        available = Math.max(
          0,
          Math.min(weeklyCap - takenThisWeek, inAccount - rules.pocketMinimumBalance),
        );
        overCap = r.amount > available;
      }

      return {
        id: r.id,
        staffId: r.staffId,
        staffName: member?.name ?? 'Unknown',
        staffPhone: member?.phone ?? '',
        areaId: member?.areaId ?? '',
        areaName: area?.name ?? '—',
        amount: r.amount,
        status: r.status,
        requestedAt: r.requestedAt,
        decidedAt: r.decidedAt,
        decidedByUserId: r.decidedByUserId,
        overrodeCap: r.overrodeCap,
        note: r.note,
        availableAllowance: available,
        inAccount,
        weeklyCap,
        takenThisWeek,
        overCap,
        weeklyCapPercent: rules.pocketWeeklyCapPercent,
      };
    });

    return NextResponse.json({
      ok: true,
      data: items,
      pagination: { page, limit, total, totalPages },
      stats,
    });
  } catch (error) {
    return opsError(error);
  }
}

const schema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('pocket:approve');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const store = await getStore();
    const pocketRequest = await store.pocketRequests.get(parsed.data.requestId);
    if (!pocketRequest) throw new HttpError(404, 'Request not found.');
    if (pocketRequest.status !== 'PENDING') {
      throw new HttpError(409, 'That request has already been decided.');
    }

    const staff = await store.staff.get(pocketRequest.staffId);
    if (!staff) throw new HttpError(404, 'Staff member not found.');
    assertInScope(session, staff.areaId);

    const updated = await store.pocketRequests.update(pocketRequest.id, {
      status: parsed.data.decision,
      decidedAt: new Date().toISOString(),
      decidedByUserId: session.user.id,
      note: parsed.data.note ?? pocketRequest.note,
    });

    return NextResponse.json({
      ok: true,
      request: updated,
      message:
        parsed.data.decision === 'APPROVED'
          ? `Approved. It will be deducted from ${staff.name.split(' ')[0]}'s payout.`
          : 'Rejected. The staff member is notified.',
    });
  } catch (error) {
    return opsError(error);
  }
}
