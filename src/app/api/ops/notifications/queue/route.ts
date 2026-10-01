import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { normalizePhoneNumber } from '@/lib/services/whatsapp';
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

interface CachedScope {
  allowedPhones: Set<string>;
  allowedRecipientIds: Set<string>;
  cachedAt: number;
}

const scopeCache = new Map<string, CachedScope>();
const SCOPE_CACHE_TTL_MS = 60 * 1000;

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

    let allowedPhones: Set<string> | undefined = undefined;
    let allowedRecipientIds: Set<string> | undefined = undefined;

    // Multi-tenant Scoping: If not SUPER_ADMIN (areaIds is not null), restrict to manager's or area admin's area
    if (session.scope.areaIds !== null) {
      const cacheKey = [...session.scope.areaIds].sort().join(',');
      const now = Date.now();
      const cached = scopeCache.get(cacheKey);

      if (cached && now - cached.cachedAt < SCOPE_CACHE_TTL_MS) {
        allowedPhones = cached.allowedPhones;
        allowedRecipientIds = cached.allowedRecipientIds;
      } else {
        const store = await getStore();
        const [scopedCustomers, scopedStaff, scopedUsers] = await Promise.all([
          store.customers.find({
            where: { areaId: { in: session.scope.areaIds } } as never,
          }),
          store.staff.find({
            where: { areaId: { in: session.scope.areaIds } } as never,
          }),
          store.users.find({
            where: { areaId: { in: session.scope.areaIds } } as never,
          }),
        ]);

        allowedPhones = new Set<string>();
        allowedRecipientIds = new Set<string>();

        for (const c of scopedCustomers) {
          if (c.id) allowedRecipientIds.add(c.id);
          if (c.phone) allowedPhones.add(normalizePhoneNumber(c.phone));
        }

        for (const s of scopedStaff) {
          if (s.id) allowedRecipientIds.add(s.id);
          if (s.userId) allowedRecipientIds.add(s.userId);
          if (s.phone) allowedPhones.add(normalizePhoneNumber(s.phone));
        }

        for (const u of scopedUsers) {
          if (u.id) allowedRecipientIds.add(u.id);
          if (u.staffId) allowedRecipientIds.add(u.staffId);
          if (u.phone) allowedPhones.add(normalizePhoneNumber(u.phone));
        }

        scopeCache.set(cacheKey, {
          allowedPhones,
          allowedRecipientIds,
          cachedAt: now,
        });
      }
    }

    const logData = getWhatsAppLog({
      page,
      limit,
      status,
      recipientType,
      event,
      search,
      recipientId,
      batchId,
      allowedPhones,
      allowedRecipientIds,
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
      const sendData = parsed.data;
      const normalizedTo = normalizePhoneNumber(sendData.to);
      const targetRecipientId = sendData.recipientId;

      // Multi-tenant Scoping: If not SUPER_ADMIN, ensure manager or area admin only sends to their own area
      if (session.scope.areaIds !== null) {
        const store = await getStore();
        const [scopedCustomers, scopedStaff, scopedUsers] = await Promise.all([
          store.customers.find({
            where: { areaId: { in: session.scope.areaIds } } as never,
          }),
          store.staff.find({
            where: { areaId: { in: session.scope.areaIds } } as never,
          }),
          store.users.find({
            where: { areaId: { in: session.scope.areaIds } } as never,
          }),
        ]);

        const isAllowed =
          scopedCustomers.some(
            (c) =>
              (c.phone && normalizePhoneNumber(c.phone) === normalizedTo) ||
              (targetRecipientId && c.id === targetRecipientId),
          ) ||
          scopedStaff.some(
            (s) =>
              (s.phone && normalizePhoneNumber(s.phone) === normalizedTo) ||
              (targetRecipientId && (s.id === targetRecipientId || s.userId === targetRecipientId)),
          ) ||
          scopedUsers.some(
            (u) =>
              (u.phone && normalizePhoneNumber(u.phone) === normalizedTo) ||
              (targetRecipientId && (u.id === targetRecipientId || u.staffId === targetRecipientId)),
          );

        if (!isAllowed) {
          return NextResponse.json(
            { error: 'Access denied: You are only authorized to message customers and staff in your assigned area.' },
            { status: 403 },
          );
        }
      }

      const job = enqueueWhatsAppMessage({
        to: sendData.to,
        recipientName: sendData.recipientName || 'Recipient',
        recipientType: sendData.recipientType,
        recipientId: sendData.recipientId,
        event: 'Direct Message',
        message: sendData.message.trim(),
        senderUserId: session.user.id,
        senderUserName: session.user.name,
        senderRole: session.user.role,
      });

      return NextResponse.json({
        ok: true,
        job,
        message: `Message queued for delivery to ${sendData.recipientName || sendData.to}.`,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return opsError(error);
  }
}
