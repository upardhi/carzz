import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';

const submitSchema = z.object({
  type: z.enum(['CUSTOMER', 'STAFF']),
  name: z.string().trim().min(2, 'Please enter a name.'),
  phone: z.string().trim().min(6, 'Please enter a valid phone number.'),
  note: z.string().trim().max(300).optional(),
});

export async function GET() {
  try {
    const session = await requireApiSession('referral:submit');
    if (!session.user.staffId) {
      throw new HttpError(403, 'This account is not linked to a staff record.');
    }

    const store = await getStore();
    const referrals = await store.staffReferrals.find({
      where: { referredByStaffId: session.user.staffId },
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
    });

    return NextResponse.json({ ok: true, referrals });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching staff referrals:', error);
    return NextResponse.json({ error: 'Could not fetch your referrals.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('referral:submit');
    if (!session.user.staffId || !session.user.areaId) {
      throw new HttpError(403, 'This account is not linked to a staff record.');
    }

    const parsed = submitSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid referral form.' },
        { status: 400 },
      );
    }

    const store = await getStore();
    const referral = await store.staffReferrals.create({
      referredByStaffId: session.user.staffId,
      areaId: session.user.areaId,
      type: parsed.data.type,
      name: parsed.data.name,
      phone: parsed.data.phone,
      note: parsed.data.note || null,
      status: 'PENDING',
      areaApprovedByUserId: null,
      areaApprovedAt: null,
      superApprovedByUserId: null,
      superApprovedAt: null,
      rejectedByUserId: null,
      rejectedAt: null,
      rejectionReason: null,
      convertedCustomerId: null,
      convertedStaffId: null,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      referral,
      message:
        'Referral submitted. Your area admin and the owner will both review it — once approved, the bonus is paid automatically when they join.',
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error submitting referral:', error);
    return NextResponse.json({ error: 'Could not submit your referral.' }, { status: 500 });
  }
}
