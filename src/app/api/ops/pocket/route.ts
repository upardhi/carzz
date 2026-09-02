import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { pocketAllowance } from '@/lib/services/payroll';
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

    const [staffList, areas, rules, allRequests] = await Promise.all([
      store.staff.find({
        where: {
          role: 'EMPLOYEE',
          ...(session.scope.areaIds ? { areaId: { in: session.scope.areaIds } } : {}),
        } as never,
      }),
      store.areas.find(),
      store.getPayoutSettings(),
      store.pocketRequests.find({
        orderBy: [{ field: 'requestedAt', dir: 'desc' }],
      }),
    ]);

    const staffMap = new Map(staffList.map((s) => [s.id, s]));
    const areaMap = new Map(areas.map((a) => [a.id, a]));

    // Filter requests by staff belonging to scoped areas
    const inScopeRequests = allRequests.filter((r) => staffMap.has(r.staffId));

    // Compute global metrics for all in-scope requests
    const stats = {
      totalCount: inScopeRequests.length,
      pendingCount: inScopeRequests.filter((r) => r.status === 'PENDING').length,
      pendingAmount: inScopeRequests
        .filter((r) => r.status === 'PENDING')
        .reduce((s, r) => s + r.amount, 0),
      approvedCount: inScopeRequests.filter(
        (r) => r.status === 'APPROVED' || r.status === 'PAID',
      ).length,
      approvedAmount: inScopeRequests
        .filter((r) => r.status === 'APPROVED' || r.status === 'PAID')
        .reduce((s, r) => s + r.amount, 0),
      rejectedCount: inScopeRequests.filter((r) => r.status === 'REJECTED').length,
    };

    // Apply filters
    let filtered = inScopeRequests;
    if (status !== 'ALL') {
      filtered = filtered.filter((r) => r.status === status);
    }
    if (staffId) {
      filtered = filtered.filter((r) => r.staffId === staffId);
    }
    if (areaId) {
      filtered = filtered.filter((r) => staffMap.get(r.staffId)?.areaId === areaId);
    }
    if (q) {
      filtered = filtered.filter((r) => {
        const member = staffMap.get(r.staffId);
        const nameMatch = member?.name.toLowerCase().includes(q);
        const phoneMatch = member?.phone.includes(q);
        const noteMatch = r.note?.toLowerCase().includes(q);
        return nameMatch || phoneMatch || noteMatch;
      });
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    // Compute allowance & limit status for the paginated slice
    const items = await Promise.all(
      paginated.map(async (r) => {
        const member = staffMap.get(r.staffId);
        const area = member ? areaMap.get(member.areaId) : null;
        let allowance = null;
        let overCap = false;

        try {
          const a = await pocketAllowance(store, r.staffId, cycle);
          allowance = a;
          overCap = r.amount > a.available;
        } catch {
          // Fallback if payroll allowance calculation fails
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
          availableAllowance: allowance?.available ?? 0,
          inAccount: allowance?.inAccount ?? 0,
          weeklyCap: allowance?.weeklyCap ?? 0,
          takenThisWeek: allowance?.takenThisWeek ?? 0,
          overCap,
          weeklyCapPercent: rules.pocketWeeklyCapPercent,
        };
      }),
    );

    return NextResponse.json({
      ok: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
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
