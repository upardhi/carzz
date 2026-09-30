import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, getSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { rateVisit, WashRuleError } from '@/lib/services/visits';
import { isWashFeedbackExpired } from '@/lib/util/washTiming';

const schema = z.object({
  visitId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const store = await getStore();
    const visit = await store.visits.get(parsed.data.visitId);
    if (!visit) {
      throw new HttpError(404, 'That wash visit was not found.');
    }

    // If customer is signed in, ensure they own the wash
    if (session?.user?.role === 'CUSTOMER' && session.user.customerId && visit.customerId !== session.user.customerId) {
      throw new HttpError(403, 'That wash was not found on your account.');
    }

    if (isWashFeedbackExpired(visit)) {
      throw new HttpError(
        400,
        'Review option is disabled after 7 days of wash completion.',
      );
    }

    const rules = await store.getPayoutSettings();
    await rateVisit(store, visit.id, parsed.data.rating, parsed.data.comment);

    return NextResponse.json({
      ok: true,
      message:
        parsed.data.rating >= rules.goodReviewMinStars
          ? `Thank you. Your wash boy earns ₹${rules.goodReviewBonus} extra for this.`
          : 'Thank you. Your area manager will look into it.',
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof WashRuleError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Could not save your rating.' },
      { status: 500 },
    );
  }
}
