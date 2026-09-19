import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { missWash } from '@/lib/services/visits';
import { nextSlotAfter, PATTERN_DAYS } from '@/lib/services/schedule';
import { formatDateFull } from '@/lib/util/format';
import type { DateOnly } from '@/lib/data/types';

const toIso = (d: Date) => d.toISOString().slice(0, 10);
const toDate = (d: string) => new Date(`${d}T00:00:00.000Z`);

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession('self:cars');
    if (!session.user.customerId) {
      throw new HttpError(403, 'This account is not linked to a customer record.');
    }

    const { searchParams } = new URL(request.url);
    const visitId = searchParams.get('visitId');
    if (!visitId) {
      throw new HttpError(400, 'visitId query parameter is required.');
    }

    const store = await getStore();
    const visit = await store.visits.get(visitId);
    if (!visit || visit.customerId !== session.user.customerId) {
      throw new HttpError(404, 'Wash visit not found or does not belong to you.');
    }

    if (visit.status !== 'PENDING') {
      throw new HttpError(400, `Cannot reschedule a wash with status '${visit.status}'.`);
    }

    const car = await store.cars.get(visit.carId);
    if (!car) {
      throw new HttpError(404, 'Car associated with this wash was not found.');
    }

    const patternDays = PATTERN_DAYS[car.schedulePattern] || [1, 4];
    const nextRegularDate = nextSlotAfter(car, visit.scheduledDate);

    // Calculate available candidate dates for the next 14 days
    const today = toIso(new Date());
    const candidateSlots: Array<{
      date: string;
      formattedDate: string;
      dayOfWeek: string;
      isRegularPatternDay: boolean;
      available: boolean;
      reason?: string;
      times: string[];
    }> = [];

    const cursor = toDate(today);
    const defaultTime = car.scheduleTime || '06:30 AM';

    for (let i = 1; i <= 14; i++) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      const dateStr = toIso(cursor);
      const dayNum = cursor.getUTCDay();
      const isPatternDay = patternDays.includes(dayNum);
      const dayName = cursor.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

      // Don't offer the exact same date as the current visit
      if (dateStr === visit.scheduledDate) {
        continue;
      }

      let available = true;
      let reason: string | undefined;

      // Check staff load if staff is assigned
      if (visit.staffId) {
        const staffVisits = await store.visits.find({
          where: {
            staffId: visit.staffId,
            scheduledDate: dateStr,
            status: { in: ['PENDING', 'IN_PROGRESS'] },
          } as never,
        });

        if (staffVisits.length >= 14) {
          available = false;
          reason = 'Fully booked';
        }
      }

      candidateSlots.push({
        date: dateStr,
        formattedDate: formatDateFull(dateStr),
        dayOfWeek: dayName,
        isRegularPatternDay: isPatternDay,
        available,
        reason,
        times: [defaultTime, '07:30 AM', '05:30 PM', '06:30 PM'],
      });
    }

    // Count how many times customer rescheduled this cycle
    const customerVisitsThisCycle = await store.visits.find({
      where: {
        customerId: session.user.customerId,
        cycle: visit.cycle,
        missReason: 'CUSTOMER_SKIPPED',
      } as never,
    });
    const reschedulesUsed = customerVisitsThisCycle.length;
    const reschedulesAllowed = 3;

    return NextResponse.json({
      ok: true,
      visit: {
        id: visit.id,
        scheduledDate: visit.scheduledDate,
        scheduledTime: visit.scheduledTime,
        carModel: `${car.make || ''} ${car.model}`.trim(),
        carPlate: car.plate,
      },
      nextRegularDate,
      nextRegularDateFormatted: nextRegularDate ? formatDateFull(nextRegularDate) : null,
      candidateSlots,
      reschedulesUsed,
      reschedulesRemaining: Math.max(0, reschedulesAllowed - reschedulesUsed),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching available slots:', error);
    return NextResponse.json(
      { error: 'Could not fetch available slots for rescheduling.' },
      { status: 500 },
    );
  }
}

const RequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('skip'),
    visitId: z.string(),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal('reschedule'),
    visitId: z.string(),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    targetTime: z.string().optional(),
    reason: z.string().optional(),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    const session = await requireApiSession('self:cars');
    if (!session.user.customerId) {
      throw new HttpError(403, 'This account is not linked to a customer record.');
    }

    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body.', details: parsed.error.format() },
        { status: 400 },
      );
    }

    const store = await getStore();
    const visit = await store.visits.get(parsed.data.visitId);

    if (!visit || visit.customerId !== session.user.customerId) {
      throw new HttpError(404, 'Wash visit not found or does not belong to you.');
    }

    if (visit.status !== 'PENDING') {
      throw new HttpError(400, `Cannot reschedule a wash that is '${visit.status}'.`);
    }

    const today = toIso(new Date());

    if (parsed.data.action === 'skip') {
      const result = await missWash(store, visit.id, {
        staffId: visit.staffId,
        reason: 'CUSTOMER_SKIPPED',
        note: parsed.data.reason || 'Customer skipped via app',
      });

      return NextResponse.json({
        ok: true,
        message: 'Wash skipped successfully. It has been moved to your next regular routine slot.',
        visit: result.visit,
        replacement: result.replacement,
      });
    }

    if (parsed.data.action === 'reschedule') {
      const targetDate = parsed.data.targetDate as DateOnly;

      if (targetDate <= today) {
        throw new HttpError(400, 'Reschedule date must be in the future (from tomorrow onwards).');
      }

      // Capacity verification on target date
      if (visit.staffId) {
        const staffVisits = await store.visits.find({
          where: {
            staffId: visit.staffId,
            scheduledDate: targetDate,
            status: { in: ['PENDING', 'IN_PROGRESS'] },
          } as never,
        });
        if (staffVisits.length >= 14) {
          throw new HttpError(400, 'Selected date is fully booked for your area staff. Please pick another date.');
        }
      }

      const result = await missWash(store, visit.id, {
        staffId: visit.staffId,
        reason: 'CUSTOMER_SKIPPED',
        note: parsed.data.reason || 'Customer rescheduled to custom date via app',
        rescheduleTo: targetDate,
      });

      return NextResponse.json({
        ok: true,
        message: `Wash rescheduled successfully for ${formatDateFull(targetDate)}.`,
        visit: result.visit,
        replacement: result.replacement,
      });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error handling customer wash action:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while updating wash schedule.' },
      { status: 500 },
    );
  }
}
