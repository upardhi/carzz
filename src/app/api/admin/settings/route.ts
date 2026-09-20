import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { invalidatePayoutRunCache } from '@/lib/services/payroll';

function revalidateSettingsPages() {
  try {
    revalidatePath('/admin/settings');
    revalidatePath('/admin/payout');
  } catch {
    // ignore — running outside a request context
  }
}

const appSchema = z.object({
  scope: z.literal('app'),
  photoRetentionMonths: z.number().int().min(1).max(24).optional(),
  requireBothPhotos: z.boolean().optional(),
  missedWashReturnsToCount: z.boolean().optional(),
  paymentModesEnabled: z
    .array(z.enum(['CASH', 'MANUAL_UPI', 'GATEWAY']))
    .min(1, 'Leave at least one way for customers to pay')
    .optional(),
  reminderDaysBeforeDue: z.number().int().min(0).max(30).optional(),
  reminderChannel: z.enum(['WHATSAPP', 'SMS', 'PUSH']).optional(),
  teaBreakMinutes: z.number().int().min(0).max(120).optional(),
  autoApprovePurchaseUnder: z.number().int().min(0).optional(),
  minWashMinutes: z.number().int().min(0).max(120).optional(),
  maxWashMinutes: z.number().int().min(1).max(240).optional(),
});

const payoutSchema = z.object({
  scope: z.literal('payout'),
  baseMode: z.enum(['PER_WASH', 'DAY_SLAB']).optional(),
  perWashRate: z.number().int().min(0).optional(),
  slabByCarIndex: z.array(z.number().int().min(0)).min(1).optional(),
  slabBeyond: z.number().int().min(0).optional(),
  onTimeBonus: z.number().int().min(0).optional(),
  goodReviewBonus: z.number().int().min(0).optional(),
  goodReviewMinStars: z.number().int().min(1).max(5).optional(),
  carReferralBonus: z.number().int().min(0).optional(),
  staffReferralBonus: z.number().int().min(0).optional(),
  offsAllowedPerMonth: z.number().int().min(0).max(31).optional(),
  extraOffPenalty: z.number().int().min(0).optional(),
  uninformedLeavePenalty: z.number().int().min(0).optional(),
  pocketWeeklyCapPercent: z.number().int().min(0).max(100).optional(),
  pocketMinimumBalance: z.number().int().min(0).optional(),
});

const schema = z.discriminatedUnion('scope', [appSchema, payoutSchema]);

/**
 * Operating rules the owner owns.
 *
 * Payout rules in particular are read live by the payout calculation, so a
 * change here re-costs every unapproved payout — which is exactly what makes
 * the unresolved base-rate question answerable without a code change.
 */
export async function POST(request: Request) {
  try {
    await requireApiSession('settings:manage');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Check the values.' },
        { status: 400 },
      );
    }

    const store = await getStore();

    // Branch before destructuring so the discriminated union stays narrowed.
    if (parsed.data.scope === 'app') {
      const { scope: _scope, ...patch } = parsed.data;

      // A partial update (only one of the pair) must still be checked against
      // whatever the other one already is in the database, or the same
      // impossible range can be reached one field at a time.
      const current = await store.getAppSettings();
      const nextMin = patch.minWashMinutes ?? current.minWashMinutes;
      const nextMax = patch.maxWashMinutes ?? current.maxWashMinutes;
      if (nextMin >= nextMax) {
        return NextResponse.json(
          { error: 'The fastest a wash can take must be less than the slowest.' },
          { status: 400 },
        );
      }

      const saved = await store.saveAppSettings(patch);
      revalidateSettingsPages();
      return NextResponse.json({
        ok: true,
        settings: saved,
        message: 'Saved. This applies everywhere straight away.',
      });
    }

    const { scope: _scope, ...patch } = parsed.data;
    const saved = await store.savePayoutSettings(patch);
    invalidatePayoutRunCache();
    revalidateSettingsPages();
    return NextResponse.json({
      ok: true,
      settings: saved,
      message:
        'Saved. Every payout that is not yet approved has been recalculated.',
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Could not save those settings.' },
      { status: 500 },
    );
  }
}
