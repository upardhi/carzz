import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import { assertInScope, opsError } from '../_guard';
import type { LeaveType, LeaveStatus, DateOnly } from '@/lib/data/types';

function revalidateLeavePages() {
  try {
    for (const base of ['/admin', '/manager', '/area']) {
      revalidatePath(`${base}/staff/leaves`);
      revalidatePath(`${base}/schedule`);
    }
    revalidatePath('/staff/leave');
  } catch {
    // ignore — running outside a request context
  }
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    leaveId: z.string().min(1),
    note: z.string().optional(),
  }),
  z.object({
    action: z.literal('reject'),
    leaveId: z.string().min(1),
    rejectionReason: z.string().trim().min(1, 'Please specify a rejection reason'),
  }),
  z.object({
    action: z.literal('create'),
    staffId: z.string().min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    type: z.enum([
      'PLANNED',
      'ON_THE_SPOT',
      'EMERGENCY',
      'SICK',
      'CASUAL',
      'HALF_DAY',
      'UNINFORMED',
      'OTHER',
    ] as [LeaveType, ...LeaveType[]]).default('PLANNED'),
    reason: z.string().trim().min(2, 'Reason is required'),
    status: z.enum(['APPROVED', 'PENDING'] as [LeaveStatus, ...LeaveStatus[]]).default('APPROVED'),
  }),
  z.object({
    action: z.literal('cancel'),
    leaveId: z.string().min(1),
    note: z.string().optional(),
  }),
]);

function getDatesInRange(startDate: string, endDate: string): DateOnly[] {
  const dates: DateOnly[] = [];
  const current = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export async function GET(request: Request) {
  try {
    const session = await requireApiSession('leave:view');
    const store = await getStore();
    const areaFilter = scopeAreaFilter(session.scope);

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const staffIdParam = searchParams.get('staffId');

    const [allLeaves, staffList, areas] = await Promise.all([
      store.leaves.find({
        orderBy: [{ field: 'appliedAt', dir: 'desc' }],
      }),

      store.staff.find({
        where: { role: 'EMPLOYEE', ...areaFilter } as never,
      }),
      store.areas.find(),
    ]);

    const staffMap = new Map(staffList.map((s) => [s.id, s]));
    const areaMap = new Map(areas.map((a) => [a.id, a]));

    // Filter leaves to only include staff in the current user's scope
    let filteredLeaves = allLeaves.filter((l) => staffMap.has(l.staffId));

    if (statusParam && statusParam !== 'ALL') {
      filteredLeaves = filteredLeaves.filter((l) => l.status === statusParam);
    }
    if (staffIdParam && staffIdParam !== 'ALL') {
      filteredLeaves = filteredLeaves.filter((l) => l.staffId === staffIdParam);
    }

    const enrichedLeaves = filteredLeaves.map((l) => {
      const staffMember = staffMap.get(l.staffId);
      const area = staffMember ? areaMap.get(staffMember.areaId) : null;
      return {
        ...l,
        staffName: staffMember?.name ?? 'Unknown Staff',
        staffPhone: staffMember?.phone ?? '—',
        areaId: staffMember?.areaId ?? '',
        areaName: area?.name ?? '—',
      };
    });

    const pendingCount = enrichedLeaves.filter((l) => l.status === 'PENDING').length;
    const approvedCount = enrichedLeaves.filter((l) => l.status === 'APPROVED').length;

    return NextResponse.json({
      ok: true,
      leaves: enrichedLeaves,
      summary: {
        total: enrichedLeaves.length,
        pending: pendingCount,
        approved: approvedCount,
      },
    });
  } catch (error) {
    return opsError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('leave:manage');
    const body = await request.json().catch(() => null);
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request.' },
        { status: 400 },
      );
    }

    const store = await getStore();
    const now = new Date().toISOString();

    if (parsed.data.action === 'approve') {
      const { leaveId, note } = parsed.data;
      const leave = await store.leaves.get(leaveId);
      if (!leave) throw new HttpError(404, 'Leave record not found.');

      const staff = await store.staff.get(leave.staffId);
      if (!staff) throw new HttpError(404, 'Staff member not found.');
      assertInScope(session, staff.areaId);

      if (leave.status !== 'PENDING') {
        throw new HttpError(409, 'This leave has already been decided.');
      }

      const dates = getDatesInRange(leave.startDate, leave.endDate);

      // 1. Update Attendance for all dates in range to 'OFF'
      for (const date of dates) {
        const existingAtt = await store.attendance.findOne({
          where: { staffId: staff.id, date },
        });
        const attStatus = leave.type === 'UNINFORMED' ? 'OFF_UNINFORMED' : 'OFF';
        const attNote = `Leave (${leave.type}): ${leave.reason}`;

        if (existingAtt) {
          await store.attendance.update(existingAtt.id, {
            status: attStatus,
            note: attNote,
          });
        } else {
          await store.attendance.create({
            staffId: staff.id,
            date,
            loginAt: null,
            status: attStatus,
            note: attNote,
          });
        }
      }

      // 2. Unassign pending visits scheduled for this staff on those leave dates
      const visitsToUnassign = await store.visits.find({
        where: {
          staffId: staff.id,
          status: 'PENDING',
          scheduledDate: { in: dates },
        } as never,
      });

      await Promise.all(
        visitsToUnassign.map((v) => store.visits.update(v.id, { staffId: null })),
      );

      // 3. Mark leave as APPROVED
      const updatedLeave = await store.leaves.update(leave.id, {
        status: 'APPROVED',
        decidedByUserId: session.user.id,
        decidedAt: now,
        note: note || leave.note,
      });

      revalidateLeavePages();
      return NextResponse.json({
        ok: true,
        leave: updatedLeave,
        unassignedVisitsCount: visitsToUnassign.length,
        message: `Leave approved for ${staff.name}. ${
          visitsToUnassign.length > 0
            ? `${visitsToUnassign.length} assigned cars have been moved to the unassigned queue for reassignment.`
            : 'Attendance updated.'
        }`,
      });
    }

    if (parsed.data.action === 'reject') {
      const { leaveId, rejectionReason } = parsed.data;
      const leave = await store.leaves.get(leaveId);
      if (!leave) throw new HttpError(404, 'Leave record not found.');

      const staff = await store.staff.get(leave.staffId);
      if (!staff) throw new HttpError(404, 'Staff member not found.');
      assertInScope(session, staff.areaId);

      if (leave.status !== 'PENDING') {
        throw new HttpError(409, 'This leave has already been decided.');
      }

      const updatedLeave = await store.leaves.update(leave.id, {
        status: 'REJECTED',
        decidedByUserId: session.user.id,
        decidedAt: now,
        rejectionReason,
      });

      revalidateLeavePages();
      return NextResponse.json({
        ok: true,
        leave: updatedLeave,
        message: `Leave rejected for ${staff.name}.`,
      });
    }

    if (parsed.data.action === 'create') {
      const { staffId, startDate, endDate, type, reason, status } = parsed.data;
      if (endDate < startDate) {
        return NextResponse.json(
          { error: 'End date cannot be earlier than start date.' },
          { status: 400 },
        );
      }

      const staff = await store.staff.get(staffId);
      if (!staff) throw new HttpError(404, 'Staff member not found.');
      assertInScope(session, staff.areaId);

      // Check if there is already an overlapping pending or approved leave for this staff
      const existingLeaves = await store.leaves.find({
        where: {
          staffId,
          status: { in: ['PENDING', 'APPROVED'] },
        } as never,
      });

      const hasOverlap = existingLeaves.some((l) => {
        return !(endDate < l.startDate || startDate > l.endDate);
      });

      if (hasOverlap) {
        return NextResponse.json(
          { error: `${staff.name} already has an active leave (pending or approved) during ${startDate} to ${endDate}.` },
          { status: 409 },
        );
      }

      const dates = getDatesInRange(startDate, endDate);
      const daysCount = dates.length;

      const leave = await store.leaves.create({
        staffId,
        startDate,
        endDate,
        daysCount,
        type,
        reason,
        status,
        appliedBy: session.user.role === 'MANAGER' ? 'MANAGER' : 'ADMIN',
        appliedAt: now,
        decidedByUserId: status === 'APPROVED' ? session.user.id : null,
        decidedAt: status === 'APPROVED' ? now : null,
        rejectionReason: null,
        note: `Added by ${session.user.name}`,
      });

      let unassignedCount = 0;
      if (status === 'APPROVED') {
        // Update attendance
        for (const date of dates) {
          const existingAtt = await store.attendance.findOne({
            where: { staffId: staff.id, date },
          });
          const attStatus = type === 'UNINFORMED' ? 'OFF_UNINFORMED' : 'OFF';
          const attNote = `Leave (${type}): ${reason}`;

          if (existingAtt) {
            await store.attendance.update(existingAtt.id, {
              status: attStatus,
              note: attNote,
            });
          } else {
            await store.attendance.create({
              staffId: staff.id,
              date,
              loginAt: null,
              status: attStatus,
              note: attNote,
            });
          }
        }

        // Unassign pending visits
        const visitsToUnassign = await store.visits.find({
          where: {
            staffId: staff.id,
            status: 'PENDING',
            scheduledDate: { in: dates },
          } as never,
        });

        await Promise.all(
          visitsToUnassign.map((v) => store.visits.update(v.id, { staffId: null })),
        );
        unassignedCount = visitsToUnassign.length;
      }

      revalidateLeavePages();
      return NextResponse.json({
        ok: true,
        leave,
        unassignedVisitsCount: unassignedCount,
        message: `Leave scheduled for ${staff.name}.${
          unassignedCount > 0 ? ` ${unassignedCount} cars are now in the unassigned queue.` : ''
        }`,
      });
    }

    if (parsed.data.action === 'cancel') {
      const { leaveId, note } = parsed.data;
      const leave = await store.leaves.get(leaveId);
      if (!leave) throw new HttpError(404, 'Leave record not found.');

      const staff = await store.staff.get(leave.staffId);
      if (!staff) throw new HttpError(404, 'Staff member not found.');
      assertInScope(session, staff.areaId);

      const dates = getDatesInRange(leave.startDate, leave.endDate);

      // If leave was approved, restore/reset attendance records
      if (leave.status === 'APPROVED') {
        for (const date of dates) {
          const existingAtt = await store.attendance.findOne({
            where: { staffId: staff.id, date },
          });
          if (existingAtt && (existingAtt.status === 'OFF' || existingAtt.status === 'OFF_UNINFORMED')) {
            await store.attendance.update(existingAtt.id, {
              status: 'PRESENT',
              note: 'Leave cancelled by manager',
            });
          }
        }
      }

      const updatedLeave = await store.leaves.update(leave.id, {
        status: 'CANCELLED',
        note: note || 'Cancelled by manager',
      });

      revalidateLeavePages();
      return NextResponse.json({
        ok: true,
        leave: updatedLeave,
        message: `Leave cancelled for ${staff.name}. Attendance restored.`,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return opsError(error);
  }
}
