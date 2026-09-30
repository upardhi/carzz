import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/server';
import {
  getWhatsAppLog,
  getWhatsAppStats,
  getBatchProgress,
  retryFailedJobs,
  type WhatsAppJobStatus,
  type WhatsAppRecipientType,
} from '@/lib/services/whatsappQueue';
import { opsError } from '../../_guard';

export async function GET(request: Request) {
  try {
    const session = await requireApiSession('visit:view');
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(5, Number(searchParams.get('limit')) || 20));
    const status = (searchParams.get('status') || 'ALL') as WhatsAppJobStatus | 'ALL';
    const recipientType = (searchParams.get('recipientType') || 'ALL') as WhatsAppRecipientType | 'ALL';
    const event = searchParams.get('event') || undefined;
    const search = searchParams.get('search') || undefined;
    const recipientId = searchParams.get('recipientId') || undefined;
    const batchId = searchParams.get('batchId') || undefined;

    const logData = getWhatsAppLog({
      page,
      limit,
      status,
      recipientType,
      event,
      search,
      recipientId,
      batchId,
    });

    const stats = getWhatsAppStats();
    const batchProgress = batchId ? getBatchProgress(batchId) : null;

    return NextResponse.json({
      ok: true,
      ...logData,
      stats,
      batchProgress,
    });
  } catch (error) {
    return opsError(error);
  }
}

const postSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('retry'),
    jobIds: z.array(z.string()).optional(),
  }),
]);

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('visit:view');
    const parsed = postSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }

    if (parsed.data.action === 'retry') {
      const { retriedCount } = retryFailedJobs(parsed.data.jobIds);
      return NextResponse.json({
        ok: true,
        retriedCount,
        message: `Re-queued ${retriedCount} failed message${retriedCount === 1 ? '' : 's'} for delivery.`,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return opsError(error);
  }
}
