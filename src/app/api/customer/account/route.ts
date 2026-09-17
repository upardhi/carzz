import { NextResponse } from 'next/server';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
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

    // Also fetch customer complaints and active packages
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

    return NextResponse.json({
      ok: true,
      account,
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
