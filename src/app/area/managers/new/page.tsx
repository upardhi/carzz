import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { AddPersonClient } from '@/app/admin/users/new/AddPersonClient';

export const metadata = { title: 'Add Area Manager — Operations' };

export default async function NewAreaManagerPage() {
  const session = await requirePermission('staff:view');
  const store = await getStore();

  const [areas, regions] = await Promise.all([
    store.areas.find({
      where: session.scope.areaIds ? ({ id: { in: session.scope.areaIds } } as never) : {},
      orderBy: [{ field: 'name' }],
    }),
    store.regions.find({ orderBy: [{ field: 'name' }] }),
  ]);

  return (
    <div className="py-2">
      <AddPersonClient
        areas={areas}
        regions={regions}
        initialRole="MANAGER"
        allowedRoles={['MANAGER']}
        backHref="/area/managers"
        backLabel="Back to Managers"
        title="Add Area Manager"
        description="Create manager account credentials, assign managed area, and verify KYC documents."
      />
    </div>
  );
}
