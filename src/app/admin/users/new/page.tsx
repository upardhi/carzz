import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { AddPersonClient } from './AddPersonClient';

export const metadata = { title: 'Add team member — Admin' };

export default async function NewUserPage() {
  await requirePermission('user:manage');
  const store = await getStore();

  const [areas, regions] = await Promise.all([
    store.areas.find({ orderBy: [{ field: 'name' }] }),
    store.regions.find({ orderBy: [{ field: 'name' }] }),
  ]);

  return (
    <div className="py-2">
      <AddPersonClient areas={areas} regions={regions} />
    </div>
  );
}
