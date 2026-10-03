import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';
import { businessToday } from '@/lib/util/time';
import { broadcastCustomerSameDayReminders } from '@/lib/services/whatsappNotifications';
import { requireApiSession } from '@/lib/auth/server';

/**
 * Automated 6:00 AM Morning Wash Reminder Cron
 *
 * Runs daily at 6:00 AM IST (00:30 UTC) to send WhatsApp reminders to customers
 * whose vehicles are scheduled for washing today.
 *
 * Can be triggered:
 * 1. By Vercel Cron: sends `Authorization: Bearer <CRON_SECRET>` or `x-vercel-cron` header.
 * 2. Manually by an authenticated admin/operator with `visit:view` or `settings:manage`.
 */
export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronHeader = request.headers.get('x-vercel-cron');
    const cronSecret = process.env.CRON_SECRET;

    const isCron =
      Boolean(cronHeader) ||
      (Boolean(cronSecret) &&
        Boolean(authHeader) &&
        authHeader?.replace(/^Bearer\s+/i, '').trim() === cronSecret?.trim());

    if (!isCron) {
      await requireApiSession('visit:view');
    }

    const today = businessToday();
    const store = await getStore();

    const { total, queuedCount, batchId } = await broadcastCustomerSameDayReminders(
      store,
      today,
    );

    console.log(
      `[Cron 6AM Reminder] Dispatched morning wash reminders for ${today}: ${queuedCount}/${total} queued. Batch: ${batchId}`,
    );

    return NextResponse.json({
      ok: true,
      scheduledDate: today,
      totalVisitsToday: total,
      queuedReminders: queuedCount,
      batchId,
      dispatchedAt: new Date().toISOString(),
      message: `Dispatched 6:00 AM morning reminders for ${queuedCount} customer${queuedCount === 1 ? '' : 's'}.`,
    });
  } catch (error: unknown) {
    console.error('[Cron 6AM Reminder Error]', error);
    const err = error as { message?: string; status?: number } | null | undefined;
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to dispatch 6 AM morning reminders' },
      { status: err?.status || 500 },
    );
  }
}
