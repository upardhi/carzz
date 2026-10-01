import { NextResponse } from 'next/server';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';
import { formatClock, formatDateFull } from '@/lib/util/format';
import { washDurationMinutes, formatDurationMinutes } from '@/lib/util/washTiming';

export async function GET() {
  try {
    const session = await requireApiSession('self:jobs');
    if (!session.user.staffId) {
      throw new HttpError(403, 'This account is not linked to a staff record.');
    }

    const store = await getStore();
    const staffId = session.user.staffId;

    const recentVisits = await store.visits.find({
      where: { staffId, status: 'DONE' } as never,
      orderBy: [{ field: 'completedAt', dir: 'desc' }],
      limit: 300,
    });

    const feedback = recentVisits.map((v) => {
      const duration = washDurationMinutes(v);
      return {
        id: v.id,
        dateLabel: formatDateFull(v.completedAt || v.scheduledDate),
        timeLabel: v.completedAt ? formatClock(v.completedAt) : v.scheduledTime,
        startedAtLabel: v.startedAt ? formatClock(v.startedAt) : null,
        completedAtLabel: v.completedAt ? formatClock(v.completedAt) : null,
        durationLabel: duration !== null ? formatDurationMinutes(duration) : null,
        servicesDone: v.servicesDone || [],
        beforePhotoUrl: resolvePublicPhotoUrl(v.beforePhotoUrl),
        afterPhotoUrl: resolvePublicPhotoUrl(v.afterPhotoUrl),
        rating: v.rating,
        comment: v.ratingComment,
        managerRating: v.managerRating,
        managerComment: v.managerRatingComment,
        onTime: v.onTime,
        payoutReverted: Boolean(v.payoutReverted) || Boolean(v.missNote?.includes('[Payout Reverted]')),
        payoutRevertReason:
          v.payoutRevertReason ||
          (v.missNote?.includes('[Payout Reverted:')
            ? v.missNote.split('[Payout Reverted:')[1]?.replace(']', '').trim()
            : null),
      };
    });

    const customerRated = feedback.filter((f) => f.rating !== null);
    const avgRating = customerRated.length
      ? customerRated.reduce((s, f) => s + (f.rating ?? 0), 0) / customerRated.length
      : null;
    const lowRatedCount = customerRated.filter((f) => (f.rating ?? 5) < 3).length;

    return NextResponse.json({
      ok: true,
      feedback,
      stats: {
        avgRating,
        totalFeedback: feedback.length,
        lowRatedCount,
        customerRatedCount: customerRated.length,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching staff feedback:', error);
    return NextResponse.json(
      { error: 'Could not fetch feedback records.' },
      { status: 500 },
    );
  }
}
