import { NextResponse } from 'next/server';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { visitsForDate } from '@/lib/services/schedule';
import { computePayout } from '@/lib/services/payroll';
import { currentCycle, todayISO } from '@/lib/util/format';

export async function GET() {
  try {
    const session = await requireApiSession('self:jobs');
    if (!session.user.staffId) {
      throw new HttpError(403, 'This account is not linked to a staff record.');
    }

    const store = await getStore();
    const staffId = session.user.staffId;
    const today = todayISO();
    const cycle = currentCycle();

    const [visits, attendance, payout] = await Promise.all([
      visitsForDate(store, today, { staffId }),
      store.attendance.findOne({ where: { staffId, date: today } }),
      computePayout(store, staffId, cycle),
    ]);

    const customerIds = [...new Set(visits.map((v) => v.customerId))];
    const carIds = [...new Set(visits.map((v) => v.carId))];

    const [customers, cars] = await Promise.all([
      customerIds.length
        ? store.customers.find({ where: { id: { in: customerIds } } as never })
        : [],
      carIds.length
        ? store.cars.find({ where: { id: { in: carIds } } as never })
        : [],
    ]);

    const customerById = new Map(customers.map((c) => [c.id, c]));
    const carById = new Map(cars.map((c) => [c.id, c]));

    const enrichedVisits = visits.map((v) => ({
      ...v,
      customer: customerById.get(v.customerId) ?? null,
      car: carById.get(v.carId) ?? null,
    }));

    const doneCount = visits.filter((v) => v.status === 'DONE').length;
    const pendingCount = visits.filter(
      (v) => v.status === 'PENDING' || v.status === 'IN_PROGRESS',
    ).length;

    // Calculate today's incremental earnings
    const earnedToday = visits
      .filter((v) => v.status === 'DONE')
      .reduce((sum, _v, index) => {
        const slab = [300, 350, 400];
        return sum + (slab[index] ?? 400);
      }, 0);

    return NextResponse.json({
      ok: true,
      visits: enrichedVisits,
      attendance,
      summary: {
        total: visits.length,
        done: doneCount,
        pending: pendingCount,
        earnedToday,
        monthNetPayable: payout.net,
        monthWashesDone: payout.washes,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching staff today visits:', error);
    return NextResponse.json(
      { error: 'Could not fetch today’s assigned visits.' },
      { status: 500 },
    );
  }
}
