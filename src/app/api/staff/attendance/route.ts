import { NextResponse } from 'next/server';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { todayISO } from '@/lib/util/format';

/**
 * Marks the day's attendance.
 *
 * Opening the app is the attendance record — the client's staff will not fill
 * a separate form, so the first sign of work is the one that counts. It is
 * idempotent: tapping twice does not create a second day.
 */
export async function POST() {
  try {
    const session = await requireApiSession('self:jobs');
    if (!session.user.staffId) {
      throw new HttpError(403, 'This account has no staff record.');
    }

    const store = await getStore();
    const date = todayISO();
    const existing = await store.attendance.findOne({
      where: { staffId: session.user.staffId, date },
    });

    if (existing?.loginAt) {
      return NextResponse.json({ ok: true, attendance: existing });
    }

    const loginAt = new Date().toISOString();
    const attendance = existing
      ? await store.attendance.update(existing.id, {
          loginAt,
          status: 'PRESENT',
        })
      : await store.attendance.create({
          staffId: session.user.staffId,
          date,
          loginAt,
          status: 'PRESENT',
          note: null,
        });

    return NextResponse.json({ ok: true, attendance });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Could not mark attendance.' },
      { status: 500 },
    );
  }
}
