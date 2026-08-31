import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { assertInScope, opsError } from '../_guard';

const schema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('pocket:approve');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const store = await getStore();
    const pocketRequest = await store.pocketRequests.get(parsed.data.requestId);
    if (!pocketRequest) throw new HttpError(404, 'Request not found.');
    if (pocketRequest.status !== 'PENDING') {
      throw new HttpError(409, 'That request has already been decided.');
    }

    const staff = await store.staff.get(pocketRequest.staffId);
    if (!staff) throw new HttpError(404, 'Staff member not found.');
    assertInScope(session, staff.areaId);

    const updated = await store.pocketRequests.update(pocketRequest.id, {
      status: parsed.data.decision,
      decidedAt: new Date().toISOString(),
      decidedByUserId: session.user.id,
      note: parsed.data.note ?? pocketRequest.note,
    });

    return NextResponse.json({
      ok: true,
      request: updated,
      message:
        parsed.data.decision === 'APPROVED'
          ? `Approved. It will be deducted from ${staff.name.split(' ')[0]}'s payout.`
          : 'Rejected. The staff member is notified.',
    });
  } catch (error) {
    return opsError(error);
  }
}
