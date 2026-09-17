import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { currentCycle } from '@/lib/util/format';
import type { LeaveType } from '@/lib/data/types';

const applySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid start date (YYYY-MM-DD) is required'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid end date (YYYY-MM-DD) is required'),
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
  reason: z.string().trim().min(3, 'Please provide a reason for the leave (at least 3 characters)'),
});

function calculateDaysBetween(start: string, end: string): number {
  const d1 = new Date(`${start}T00:00:00.000Z`);
  const d2 = new Date(`${end}T00:00:00.000Z`);
  const diffTime = d2.getTime() - d1.getTime();
  if (diffTime < 0) return 0;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

export async function GET() {
  try {
    const session = await requireApiSession('leave:request');
    if (!session.user.staffId) {
      throw new HttpError(403, 'This account is not linked to a staff record.');
    }

    const store = await getStore();
    const staffId = session.user.staffId;
    const cycle = currentCycle();

    const [leaves, settings, monthAttendance] = await Promise.all([
      store.leaves.find({
        where: { staffId },
        orderBy: [{ field: 'appliedAt', dir: 'desc' }],
      }),

      store.getPayoutSettings(),
      store.attendance.find({
        where: {
          staffId,
          date: { gte: `${cycle}-01`, lte: `${cycle}-31` },
        } as never,
      }),
    ]);

    const offsTaken = monthAttendance.filter(
      (a) => a.status === 'OFF' || a.status === 'OFF_UNINFORMED' || a.status === 'ABSENT',
    ).length;

    const pendingLeaves = leaves.filter((l) => l.status === 'PENDING');
    const approvedLeaves = leaves.filter((l) => l.status === 'APPROVED');
    const pastLeaves = leaves.filter((l) => l.status !== 'PENDING');

    return NextResponse.json({
      ok: true,
      leaves,
      pendingLeaves,
      approvedLeaves,
      pastLeaves,
      summary: {
        offsAllowedPerMonth: settings.offsAllowedPerMonth,
        offsTakenThisMonth: offsTaken,
        extraOffPenalty: settings.extraOffPenalty,
        uninformedLeavePenalty: settings.uninformedLeavePenalty,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching staff leaves:', error);
    return NextResponse.json({ error: 'Could not fetch leave records.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('leave:request');
    if (!session.user.staffId) {
      throw new HttpError(403, 'This account is not linked to a staff record.');
    }

    const body = await request.json().catch(() => null);
    const parsed = applySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid leave application form.' },
        { status: 400 },
      );
    }

    const { startDate, endDate, type, reason } = parsed.data;
    if (endDate < startDate) {
      return NextResponse.json(
        { error: 'End date cannot be earlier than start date.' },
        { status: 400 },
      );
    }

    const daysCount = calculateDaysBetween(startDate, endDate);
    if (daysCount <= 0) {
      return NextResponse.json({ error: 'Invalid date selection.' }, { status: 400 });
    }

    const store = await getStore();
    const staffId = session.user.staffId;

    // Check if there is already an overlapping pending or approved leave
    const existing = await store.leaves.find({
      where: {
        staffId,
        status: { in: ['PENDING', 'APPROVED'] },
      } as never,
    });

    const hasOverlap = existing.some((l) => {
      return !(endDate < l.startDate || startDate > l.endDate);
    });

    if (hasOverlap) {
      return NextResponse.json(
        { error: 'You already have a pending or approved leave during this date range.' },
        { status: 409 },
      );
    }

    const leave = await store.leaves.create({
      staffId,
      startDate,
      endDate,
      daysCount,
      type,
      reason,
      status: 'PENDING',
      appliedBy: 'STAFF',
      appliedAt: new Date().toISOString(),
      decidedByUserId: null,
      decidedAt: null,
      rejectionReason: null,
      note: null,
    });

    return NextResponse.json({
      ok: true,
      leave,
      message: 'Leave request submitted. Awaiting manager approval.',
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error applying for leave:', error);
    return NextResponse.json({ error: 'Could not submit leave request.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireApiSession('leave:request');
    if (!session.user.staffId) {
      throw new HttpError(403, 'This account is not linked to a staff record.');
    }

    const { searchParams } = new URL(request.url);
    const leaveId = searchParams.get('id');
    if (!leaveId) {
      return NextResponse.json({ error: 'Leave ID is required.' }, { status: 400 });
    }

    const store = await getStore();
    const leave = await store.leaves.get(leaveId);
    if (!leave) {
      throw new HttpError(404, 'Leave request not found.');
    }

    if (leave.staffId !== session.user.staffId) {
      throw new HttpError(403, 'You can only cancel your own leave requests.');
    }

    if (leave.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending leave requests can be cancelled directly. Contact your manager.' },
        { status: 400 },
      );
    }

    await store.leaves.update(leave.id, {
      status: 'CANCELLED',
      note: 'Cancelled by staff member',
    });

    return NextResponse.json({ ok: true, message: 'Leave request cancelled.' });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error cancelling leave:', error);
    return NextResponse.json({ error: 'Could not cancel leave request.' }, { status: 500 });
  }
}
