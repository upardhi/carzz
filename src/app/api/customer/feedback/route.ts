import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { rateVisit, WashRuleError } from '@/lib/services/visits';

const schema = z.object({
  visitId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('self:feedback');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const store = await getStore();
    const visit = await store.visits.get(parsed.data.visitId);
    // Rating someone else's wash would move their staff bonus, so ownership is
    // checked against the session rather than trusted from the payload.
    if (!visit || visit.customerId !== session.user.customerId) {
      throw new HttpError(404, 'That wash was not found on your account.');
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
