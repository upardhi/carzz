import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import { assertInScope, opsError } from '../_guard';

function revalidateReferralPages() {
  try {
    revalidatePath('/admin/referrals');
    revalidatePath('/area/referrals');
    revalidatePath('/staff/refer');
  } catch {
    // ignore — running outside a request context
  }
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), referralId: z.string().min(1) }),
  z.object({
    action: z.literal('reject'),
    referralId: z.string().min(1),
    reason: z.string().trim().max(300).optional(),
  }),
]);

export async function GET(request: Request) {
  try {
    const session = await requireApiSession('referral:manage');
    const store = await getStore();
    const areaFilter = scopeAreaFilter(session.scope);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const referrals = await store.staffReferrals.find({
      where: {
        ...(areaFilter as object),
        ...(status ? { status } : {}),
      } as never,
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
    });

    return NextResponse.json({ ok: true, referrals });
  } catch (error) {
    return opsError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('referral:manage');
    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const store = await getStore();
    const referral = await store.staffReferrals.get(parsed.data.referralId);
    if (!referral) throw new HttpError(404, 'Referral not found.');
    assertInScope(session, referral.areaId);

    if (referral.status === 'APPROVED' || referral.status === 'REJECTED') {
      throw new HttpError(400, `This referral is already ${referral.status.toLowerCase()}.`);
    }

    if (parsed.data.action === 'reject') {
      const updated = await store.staffReferrals.update(referral.id, {
        status: 'REJECTED',
        rejectedByUserId: session.user.id,
        rejectedAt: new Date().toISOString(),
        rejectionReason: parsed.data.reason || 'Not approved.',
      });
      revalidateReferralPages();
      return NextResponse.json({ ok: true, referral: updated, message: 'Referral rejected.' });
    }

    // Approve — a super admin's approval also counts as the area sign-off
    // (they outrank the area admin), but an area admin's approval only fills
    // their own slot; both slots must be filled before the referral is
    // fully APPROVED.
    const isSuperAdmin = session.user.role === 'SUPER_ADMIN';
    const patch: Record<string, unknown> = {};
    if (isSuperAdmin) {
      patch.superApprovedByUserId = session.user.id;
      patch.superApprovedAt = new Date().toISOString();
      if (!referral.areaApprovedByUserId) {
        patch.areaApprovedByUserId = session.user.id;
        patch.areaApprovedAt = new Date().toISOString();
      }
    } else {
      if (referral.areaApprovedByUserId) {
        throw new HttpError(400, 'You have already approved this referral.');
      }
      patch.areaApprovedByUserId = session.user.id;
      patch.areaApprovedAt = new Date().toISOString();
    }

    const bothApproved = Boolean(patch.superApprovedByUserId || referral.superApprovedByUserId) &&
      Boolean(patch.areaApprovedByUserId || referral.areaApprovedByUserId);
    patch.status = bothApproved ? 'APPROVED' : 'AREA_APPROVED';

    const updated = await store.staffReferrals.update(referral.id, patch as never);
    revalidateReferralPages();

    return NextResponse.json({
      ok: true,
      referral: updated,
      message: bothApproved
        ? 'Referral fully approved. Onboard them and pick this wash boy as the referrer — the bonus pays automatically that cycle.'
        : 'Your approval is recorded. Waiting on the other sign-off.',
    });
  } catch (error) {
    return opsError(error);
  }
}
