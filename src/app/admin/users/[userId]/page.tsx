import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import type { Complaint, Customer } from '@/lib/data/types';
import { UserDetailClient } from './UserDetailClient';

export const metadata = { title: 'User Profile & Details — Admin' };

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requirePermission('user:manage');
  const { userId } = await params;
  const store = await getStore();

  const [user, areas, regions] = await Promise.all([
    store.users.get(userId),
    store.areas.find({ orderBy: [{ field: 'name' }] }),
    store.regions.find({ orderBy: [{ field: 'name' }] }),
  ]);

  if (!user) {
    notFound();
  }

  let staff = null;
  let complaints: Complaint[] = [];
  let customers: Customer[] = [];

  if (user.staffId) {
    [staff, complaints, customers] = await Promise.all([
      store.staff.get(user.staffId),
      store.complaints.find({
        where: { staffId: user.staffId } as never,
        orderBy: [{ field: 'createdAt', dir: 'desc' }],
      }),
      store.customers.find(),
    ]);
  }

  return (
    <div className="py-2">
      <UserDetailClient
        user={user}
        staff={staff}
        areas={areas}
        regions={regions}
        complaints={complaints}
        customers={customers}
      />
    </div>
  );
}
