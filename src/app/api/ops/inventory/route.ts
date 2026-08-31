import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { can } from '@/lib/auth/rbac';
import { getStore } from '@/lib/data';
import { issueStock, receivePurchase } from '@/lib/services/inventory';
import { assertInScope, opsError } from '../_guard';

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('issue'),
    areaId: z.string().min(1),
    itemId: z.string().min(1),
    staffId: z.string().min(1),
    quantity: z.number().positive(),
  }),
  z.object({
    action: z.literal('request'),
    areaId: z.string().min(1),
    itemId: z.string().min(1),
    quantity: z.number().positive(),
    neededBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().max(300).optional(),
  }),
  z.object({
    action: z.literal('decide'),
    requestId: z.string().min(1),
    decision: z.enum(['APPROVED', 'REJECTED']),
  }),
  z.object({ action: z.literal('receive'), requestId: z.string().min(1) }),
]);

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('inventory:view');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const store = await getStore();

    if (parsed.data.action === 'issue') {
      assertInScope(session, parsed.data.areaId);
      await issueStock(store, { ...parsed.data, issuedByUserId: session.user.id });
      return NextResponse.json({
        ok: true,
        message: 'Issued. Area stock has been reduced.',
      });
    }

    if (parsed.data.action === 'request') {
      assertInScope(session, parsed.data.areaId);
      const item = await store.inventoryItems.get(parsed.data.itemId);
      if (!item) throw new HttpError(404, 'Item not found.');

      const count = await store.purchaseRequests.count();
      const created = await store.purchaseRequests.create({
        code: `PR-${1100 + count}`,
        areaId: parsed.data.areaId,
        itemId: parsed.data.itemId,
        quantity: parsed.data.quantity,
        estimatedCost: Math.round(parsed.data.quantity * item.unitCost),
        neededBy: parsed.data.neededBy,
        reason: parsed.data.reason ?? null,
        status: 'PENDING',
        raisedByUserId: session.user.id,
        decidedByUserId: null,
        createdAt: new Date().toISOString(),
        decidedAt: null,
      });

      return NextResponse.json({
        ok: true,
        request: created,
        // Nothing is bought until the owner approves it — that is how stock
        // cost stays under his control.
        message: `${created.code} sent to the owner for approval.`,
      });
    }

    if (parsed.data.action === 'decide') {
      if (!can(session.user.role, 'purchase:approve')) {
        throw new HttpError(403, 'Only the owner approves purchases.');
      }
      const req = await store.purchaseRequests.get(parsed.data.requestId);
      if (!req) throw new HttpError(404, 'Request not found.');
      if (req.status !== 'PENDING') {
        throw new HttpError(409, 'That request has already been decided.');
      }

      const updated = await store.purchaseRequests.update(req.id, {
        status: parsed.data.decision,
        decidedByUserId: session.user.id,
        decidedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        ok: true,
        request: updated,
        message:
          parsed.data.decision === 'APPROVED'
            ? `${req.code} approved. The vendor has been notified.`
            : `${req.code} rejected.`,
      });
    }

    const req = await store.purchaseRequests.get(parsed.data.requestId);
    if (!req) throw new HttpError(404, 'Request not found.');
    assertInScope(session, req.areaId);
    await receivePurchase(store, req.id);

    return NextResponse.json({
      ok: true,
      message: 'Marked received. Stock has been updated.',
    });
  } catch (error) {
    return opsError(error);
  }
}
