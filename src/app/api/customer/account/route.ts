import { NextResponse } from 'next/server';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import type { Staff } from '@/lib/data/types';
import { loadCustomerAccount } from '@/lib/services/accounts';
import { currentCycle } from '@/lib/util/format';

export async function GET() {
  try {
    const session = await requireApiSession('self:cars');
    if (!session.user.customerId) {
      throw new HttpError(403, 'This account is not linked to a customer record.');
    }

    const store = await getStore();
    const cycle = currentCycle();
    const account = await loadCustomerAccount(store, session.user.customerId, cycle);

    if (!account) {
      throw new HttpError(404, 'Customer account not found.');
    }

    // Also fetch customer complaints, active packages, and assigned staff
    const [complaints, packages] = await Promise.all([
      store.complaints.find({
        where: { customerId: session.user.customerId },
        orderBy: [{ field: 'createdAt', dir: 'desc' }],
      }),
      store.packages.find({
        where: { active: true },
        orderBy: [{ field: 'price', dir: 'asc' }],
      }),
    ]);

    // Resolve staff records for nextVisit, cars, and visits (same as web app page)
    const staffIds = new Set<string>();
    if (account.nextVisit?.staffId) staffIds.add(account.nextVisit.staffId);
    for (const c of account.cars) {
      if (c.assignedStaffId) staffIds.add(c.assignedStaffId);
    }
    for (const v of account.visits) {
      if (v.staffId) staffIds.add(v.staffId);
    }

    const areaStaff = account.customer?.areaId
      ? await store.staff.find({ where: { areaId: account.customer.areaId } })
      : [];
    const staffMap = new Map<string, Staff>(areaStaff.map((s) => [s.id, s]));
    for (const id of staffIds) {
      if (!staffMap.has(id)) {
        const s = await store.staff.get(id);
        if (s) staffMap.set(id, s);
      }
    }

    const staffList = Array.from(staffMap.values()).map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      role: s.role,
      areaId: s.areaId,
    }));

    const nextVisitStaff = account.nextVisit?.staffId
      ? staffMap.get(account.nextVisit.staffId)
      : null;

    const enrichedAccount = {
      ...account,
      nextVisit: account.nextVisit
        ? {
            ...account.nextVisit,
            staffName: nextVisitStaff?.name ?? null,
          }
        : null,
      cars: account.cars.map((car) => ({
        ...car,
        assignedStaffName: car.assignedStaffId
          ? staffMap.get(car.assignedStaffId)?.name ?? null
          : null,
      })),
      visits: account.visits.map((v) => ({
        ...v,
        staffName: v.staffId ? staffMap.get(v.staffId)?.name ?? null : null,
      })),
      staff: staffList,
    };

    return NextResponse.json({
      ok: true,
      account: enrichedAccount,
      staff: staffList,
      complaints,
      packages,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error fetching customer account:', error);
    return NextResponse.json(
      { error: 'Could not fetch customer account details.' },
      { status: 500 },
    );
  }
}
