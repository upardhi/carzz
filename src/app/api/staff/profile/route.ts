import { NextResponse } from 'next/server';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { currentCycle } from '@/lib/util/format';

export async function GET() {
  try {
    const session = await requireApiSession('pocket:request');
    if (!session.user.staffId) {
      throw new HttpError(403, 'This account is not linked to a staff record.');
    }

    const store = await getStore();
    const staff = await store.staff.get(session.user.staffId);
    if (!staff) throw new HttpError(404, 'Staff record not found.');

    const area = await store.areas.get(staff.areaId);
    const manager = area?.managerId ? await store.users.get(area.managerId) : null;

    const cycle = currentCycle();
    const visits = await store.visits.find({
      where: { staffId: staff.id, cycle },
    });

    const doneVisits = visits.filter((v) => v.status === 'DONE');
    const missedVisits = visits.filter((v) => v.status === 'MISSED');
    const onTimeVisits = doneVisits.filter((v) => v.onTime);

    const ratedVisits = doneVisits.filter((v) => v.rating !== null);
    const avgRating = ratedVisits.length
      ? (
          ratedVisits.reduce((acc, v) => acc + (v.rating || 0), 0) /
          ratedVisits.length
        ).toFixed(1)
      : '5.0';

    return NextResponse.json({
      ok: true,
      staff: {
        id: staff.id,
        name: staff.name,
        phone: staff.phone,
        joinedOn: staff.joinedOn,
        role: staff.role,
        area: area ? area.name : 'Assigned Area',
        managerName: manager ? manager.name : 'Area Manager',
      },
      performance: {
        washesThisMonth: doneVisits.length,
        onTimeRate: doneVisits.length
          ? Math.round((onTimeVisits.length / doneVisits.length) * 100)
          : 100,
        averageRating: avgRating,
        missedWashes: missedVisits.length,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching staff profile:', error);
    return NextResponse.json(
      { error: 'Could not fetch staff profile.' },
      { status: 500 },
    );
  }
}
