import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { todayISO } from '@/lib/util/format';
import { businessToday } from '@/lib/util/time';
import {
  broadcastWashboySchedules,
  broadcastCustomerSameDayReminders,
  notifyInvoiceDue,
} from '@/lib/services/whatsappNotifications';
import { opsError } from '../../_guard';

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('washboy-schedule'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    staffId: z.string().optional(),
  }),
  z.object({
    action: z.literal('customer-day-before'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  z.object({
    action: z.literal('customer-same-day'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  z.object({
    action: z.literal('invoice-reminder'),
    customerId: z.string().min(1),
    amount: z.number().positive(),
    dueOn: z.string(),
  }),
]);

export async function POST(request: Request) {
  try {
    await requireApiSession('visit:view');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid notification request' },
        { status: 400 },
      );
    }

    const store = await getStore();

    if (parsed.data.action === 'washboy-schedule') {
      const targetDate = parsed.data.date || todayISO();
      const results = await broadcastWashboySchedules(
        store,
        targetDate,
        parsed.data.staffId,
      );

      const successfulCount = results.filter((r) => r.queued).length;
      return NextResponse.json({
        ok: true,
        results,
        message: `WhatsApp route queued for ${successfulCount} wash boy${successfulCount === 1 ? '' : 's'}.`,
      });
    }

    if (parsed.data.action === 'customer-same-day') {
      // Default target date is today in business timezone (Asia/Kolkata)
      const targetDate = parsed.data.date || businessToday();
      const { total, queuedCount, batchId } = await broadcastCustomerSameDayReminders(
        store,
        targetDate,
      );

      return NextResponse.json({
        ok: true,
        total,
        queuedCount,
        batchId,
        message: `Queued 6:00 AM morning WhatsApp reminders for ${queuedCount} customer${queuedCount === 1 ? '' : 's'}. Worker is delivering in background.`,
      });
    }

    if (parsed.data.action === 'customer-day-before') {
      // Per business policy: 1-day advance reminders are disabled in favor of same-day 6:00 AM morning reminders.
      // Redirect to today's morning reminders so tomorrow's customers are not messaged 1 day early.
      const targetDate = businessToday();
      const { total, queuedCount, batchId } = await broadcastCustomerSameDayReminders(
        store,
        targetDate,
      );

      return NextResponse.json({
        ok: true,
        total,
        queuedCount,
        batchId,
        message: `Queued 6:00 AM morning WhatsApp reminders for ${queuedCount} customer${queuedCount === 1 ? '' : 's'} scheduled today. (1-day advance reminders have been retired).`,
      });
    }

    if (parsed.data.action === 'invoice-reminder') {
      await notifyInvoiceDue(
        store,
        parsed.data.customerId,
        parsed.data.amount,
        parsed.data.dueOn,
      );

      return NextResponse.json({
        ok: true,
        message: 'Outstanding invoice reminder sent via WhatsApp.',
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return opsError(error);
  }
}
