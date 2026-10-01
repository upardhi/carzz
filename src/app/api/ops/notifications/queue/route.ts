import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/server';
import {
  getWhatsAppLog,
  getWhatsAppStats,
  getBatchProgress,
  retryFailedJobs,
  enqueueWhatsAppMessage,
  recordInboundWhatsAppMessage,
  type WhatsAppJobStatus,
  type WhatsAppRecipientType,
} from '@/lib/services/whatsappQueue';
import { opsError } from '../../_guard';

export async function GET(request: Request) {
  try {
    const session = await requireApiSession('visit:view');
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(1000, Math.max(5, Number(searchParams.get('limit')) || 20));
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
  z.object({
    action: z.literal('send'),
    to: z.string().min(5),
    recipientName: z.string().optional(),
    recipientType: z.enum(['CUSTOMER', 'STAFF']).default('CUSTOMER'),
    recipientId: z.string().optional(),
    message: z.string().min(1),
  }),
  z.object({
    action: z.literal('simulate_reply'),
    from: z.string().min(5),
    senderName: z.string().optional(),
    message: z.string().min(1),
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

    if (parsed.data.action === 'simulate_reply') {
      const recorded = recordInboundWhatsAppMessage({
        from: parsed.data.from,
        senderName: parsed.data.senderName,
        message: parsed.data.message.trim(),
      });

      return NextResponse.json({
        ok: true,
        record: recorded,
        message: `Simulated customer reply recorded from ${parsed.data.senderName || parsed.data.from}.`,
      });
    }

    if (parsed.data.action === 'send') {
      const job = enqueueWhatsAppMessage({
        to: parsed.data.to,
        recipientName: parsed.data.recipientName || 'Recipient',
        recipientType: parsed.data.recipientType,
        recipientId: parsed.data.recipientId,
        event: 'Direct Message',
        message: parsed.data.message.trim(),
        senderUserId: session.user.id,
        senderUserName: session.user.name,
        senderRole: session.user.role,
      });

      return NextResponse.json({
        ok: true,
        job,
        message: `Message queued for delivery to ${parsed.data.recipientName || parsed.data.to}.`,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return opsError(error);
  }
}
