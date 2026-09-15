import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { can } from '@/lib/auth/rbac';
import { getStore } from '@/lib/data';
import { issueStock, receivePurchase, invalidateConsumptionCache } from '@/lib/services/inventory';
import { assertInScope, opsError } from '../_guard';

function revalidateInventoryPages() {
  try {
    revalidatePath('/admin/inventory');
    revalidatePath('/manager/inventory');
    revalidatePath('/area/inventory');
  } catch {
    // ignore — running outside a request context
  }
}

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
    itemId: z.string().optional(),
    isCustom: z.boolean().optional(),
    customItemName: z.string().max(100).optional(),
    customUnit: z.string().max(30).optional(),
    customUnitCost: z.number().nonnegative().optional(),
    quantity: z.number().positive(),
    neededBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal('addItem'),
    name: z.string().min(1).max(100),
    unit: z.string().min(1).max(30),
    unitCost: z.number().nonnegative(),
    reorderLevel: z.number().nonnegative().default(10),
    usagePerWash: z.number().nonnegative().default(0),
  }),
  z.object({
    action: z.literal('updateItem'),
    itemId: z.string().min(1),
    name: z.string().min(1).max(100),
    unit: z.string().min(1).max(30),
    unitCost: z.number().nonnegative(),
    reorderLevel: z.number().nonnegative(),
    usagePerWash: z.number().nonnegative(),
    active: z.boolean(),
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
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues }, { status: 400 });
    }
    const store = await getStore();

    if (parsed.data.action === 'addItem') {
      if (!can(session.user.role, 'purchase:approve') && session.user.role !== 'SUPER_ADMIN') {
        throw new HttpError(403, 'Only the owner or admin can add catalog items.');
      }

      const item = await store.inventoryItems.create({
        name: parsed.data.name.trim(),
        unit: parsed.data.unit.trim(),
        unitCost: Math.round(parsed.data.unitCost),
        reorderLevel: parsed.data.reorderLevel,
        usagePerWash: parsed.data.usagePerWash,
        active: true,
      });

      // Initialize stock levels across all areas for this new item
      const areas = await store.areas.find();
      await Promise.all(
        areas.map((a) =>
          store.stockLevels.create({
            areaId: a.id,
            itemId: item.id,
            quantity: 0,
            updatedAt: new Date().toISOString(),
          }),
        ),
      );

      revalidateInventoryPages();
      return NextResponse.json({
        ok: true,
        item,
        message: `Item "${item.name}" added to catalog successfully.`,
      });
    }

    if (parsed.data.action === 'updateItem') {
      if (!can(session.user.role, 'purchase:approve') && session.user.role !== 'SUPER_ADMIN') {
        throw new HttpError(403, 'Only the owner or admin can update catalog items.');
      }

      const existing = await store.inventoryItems.get(parsed.data.itemId);
      if (!existing) throw new HttpError(404, 'Item not found.');

      const updated = await store.inventoryItems.update(parsed.data.itemId, {
        name: parsed.data.name.trim(),
        unit: parsed.data.unit.trim(),
        unitCost: Math.round(parsed.data.unitCost),
        reorderLevel: parsed.data.reorderLevel,
        usagePerWash: parsed.data.usagePerWash,
        active: parsed.data.active,
      });

      invalidateConsumptionCache();
      revalidateInventoryPages();
      return NextResponse.json({
        ok: true,
        item: updated,
        message: `Item "${updated.name}" updated successfully.`,
      });
    }

    if (parsed.data.action === 'issue') {
      assertInScope(session, parsed.data.areaId);
      await issueStock(store, { ...parsed.data, issuedByUserId: session.user.id });
      invalidateConsumptionCache();
      revalidateInventoryPages();
      return NextResponse.json({
        ok: true,
        message: 'Issued. Area stock has been reduced.',
      });
    }

    if (parsed.data.action === 'request') {
      assertInScope(session, parsed.data.areaId);

      let effectiveItemId = parsed.data.itemId;
      let effectiveUnitCost = 0;
      const isCustomItem = Boolean(parsed.data.isCustom || parsed.data.customItemName);

      if (isCustomItem) {
        if (!parsed.data.customItemName?.trim()) {
          throw new HttpError(400, 'Please enter a name for the custom item.');
        }
        const customUnit = (parsed.data.customUnit?.trim() || 'Units');
        effectiveUnitCost = Math.round(parsed.data.customUnitCost ?? 100);

        // Create new catalog item for this custom request
        const newItem = await store.inventoryItems.create({
          name: parsed.data.customItemName.trim(),
          unit: customUnit,
          unitCost: effectiveUnitCost,
          reorderLevel: 5,
          usagePerWash: 0,
          active: true,
        });

        effectiveItemId = newItem.id;

        // Initialize stock levels across areas
        const areas = await store.areas.find();
        await Promise.all(
          areas.map((a) =>
            store.stockLevels.create({
              areaId: a.id,
              itemId: newItem.id,
              quantity: 0,
              updatedAt: new Date().toISOString(),
            }),
          ),
        );
      } else {
        if (!effectiveItemId) {
          throw new HttpError(400, 'Please select an item or specify a custom item.');
        }
        const item = await store.inventoryItems.get(effectiveItemId);
        if (!item) throw new HttpError(404, 'Item not found.');
        effectiveUnitCost = item.unitCost;
      }

      const totalCost = Math.round(parsed.data.quantity * effectiveUnitCost);
      const customPrefix = isCustomItem ? '[Custom Item] ' : '';
      const finalReason = parsed.data.reason?.trim()
        ? `${customPrefix}${parsed.data.reason.trim()}`
        : isCustomItem
          ? '[Custom Item Request]'
          : null;

      const count = await store.purchaseRequests.count();
      const created = await store.purchaseRequests.create({
        code: `PR-${1100 + count}`,
        areaId: parsed.data.areaId,
        itemId: effectiveItemId!,
        quantity: parsed.data.quantity,
        estimatedCost: totalCost,
        neededBy: parsed.data.neededBy,
        reason: finalReason,
        status: 'PENDING',
        raisedByUserId: session.user.id,
        decidedByUserId: null,
        createdAt: new Date().toISOString(),
        decidedAt: null,
      });

      revalidateInventoryPages();
      return NextResponse.json({
        ok: true,
        request: created,
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

      revalidateInventoryPages();
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
    invalidateConsumptionCache();
    revalidateInventoryPages();

    return NextResponse.json({
      ok: true,
      message: 'Marked received. Stock has been updated.',
    });
  } catch (error) {
    return opsError(error);
  }
}
