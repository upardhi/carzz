import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
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

  // If user has a staffId, fetch their staff record to get any additional payout info
  let staff = null;
  if (user.staffId) {
    staff = await store.staff.get(user.staffId);
  }

  return (
    <div className="py-2">
      <UserDetailClient
        user={user}
        staff={staff}
        areas={areas}
        regions={regions}
      />
    </div>
  );
}
