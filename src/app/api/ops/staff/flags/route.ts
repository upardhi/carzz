import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { currentCycle } from '@/lib/util/format';
import { opsError } from '../../_guard';

export async function GET(request: Request) {
  try {
    const session = await requireApiSession('staff:view');
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const areaId = url.searchParams.get('areaId');
    const type = url.searchParams.get('type') || 'ALL';
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    const store = await getStore();
    const cycle = currentCycle();

    // Attendance-based flag computation requires reading all attendance records
    // for the current cycle, but we scope tightly to the session's permitted areas
    // and optionally to a single area — so the record count is bounded.
    const staffWhere: Record<string, unknown> = {
      role: 'EMPLOYEE',
      ...(session.scope.areaIds ? { areaId: { in: session.scope.areaIds } } : {}),
      ...(areaId ? { areaId } : {}),
    };

    // Parallel: fetch only what we need, tightly scoped
    const [staffList, areas, rules] = await Promise.all([
      store.staff.find({ where: staffWhere as never, orderBy: [{ field: 'name' }] }),
      store.areas.find(),
      store.getPayoutSettings(),
    ]);

    const staffIds = staffList.map((s) => s.id);

    // Fetch only attendance for these specific staff in the current cycle
    // (not all attendance for all time)
    const monthAttendance = await store.attendance.find({
      where: {
        staffId: { in: staffIds },
        date: { gte: `${cycle}-01`, lte: `${cycle}-31` },
      } as never,
    });

    const areaMap = new Map(areas.map((a) => [a.id, a]));

    // Group attendance by staffId — O(n) single pass
    const attendanceByStaff = new Map<string, typeof monthAttendance>();
    for (const a of monthAttendance) {
      const list = attendanceByStaff.get(a.staffId) ?? [];
      list.push(a);
      attendanceByStaff.set(a.staffId, list);
    }

    // Compute flags for all matching staff — no second DB query needed
    const allFlags = staffList
      .map((member) => {
        const own = attendanceByStaff.get(member.id) ?? [];
        const offs = own.filter((a) => a.status === 'OFF').length;
        const uninformed = own.filter((a) => a.status === 'OFF_UNINFORMED').length;

        const isExtraOff = offs > rules.offsAllowedPerMonth;
        const isUninformed = uninformed > 0;

        // Only include staff who actually have a flag
        if (!isExtraOff && !isUninformed) return null;

        let extraOffPenalty = 0;
        let isWarningOnly = false;
        if (isExtraOff) {
          if (offs === rules.offsAllowedPerMonth + 1) {
            isWarningOnly = true;
          } else {
            extraOffPenalty = (offs - rules.offsAllowedPerMonth - 1) * rules.extraOffPenalty;
          }
        }

        const uninformedPenalty = uninformed * rules.uninformedLeavePenalty;
        const totalPenalty = extraOffPenalty + uninformedPenalty;

        return {
          id: member.id,
          staffId: member.id,
          staffName: member.name,
          staffPhone: member.phone,
          areaId: member.areaId,
          areaName: areaMap.get(member.areaId)?.name ?? '—',
          offs,
          allowedOffs: rules.offsAllowedPerMonth,
          uninformed,
          isExtraOff,
          isUninformed,
          isWarningOnly,
          extraOffPenalty,
          uninformedPenalty,
          totalPenalty,
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    // Stats are computed over all flags before any sub-filtering (type/q)
    const stats = {
      totalFlagged: allFlags.length,
      totalUninformed: allFlags.reduce((s, f) => s + f.uninformed, 0),
      totalExtraOffs: allFlags.reduce((s, f) => s + Math.max(0, f.offs - f.allowedOffs), 0),
      totalPenalties: allFlags.reduce((s, f) => s + f.totalPenalty, 0),
    };

    // Apply sub-filters (type + text search) before paginating
    let filtered = allFlags;
    if (type === 'UNINFORMED') {
      filtered = filtered.filter((f) => f.isUninformed);
    } else if (type === 'EXTRA_OFFS') {
      filtered = filtered.filter((f) => f.isExtraOff);
    }
    if (q) {
      filtered = filtered.filter(
        (f) =>
          f.staffName.toLowerCase().includes(q) ||
          f.staffPhone.includes(q) ||
          f.areaName.toLowerCase().includes(q),
      );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      ok: true,
      data: paginated,
      pagination: { page, limit, total, totalPages },
      stats,
      rules: {
        offsAllowedPerMonth: rules.offsAllowedPerMonth,
        extraOffPenalty: rules.extraOffPenalty,
        uninformedLeavePenalty: rules.uninformedLeavePenalty,
      },
    });
  } catch (error) {
    return opsError(error);
  }
}
