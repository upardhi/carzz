import { AddPersonClient } from '@/app/admin/users/new/AddPersonClient';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';

export const metadata = { title: 'Add Wash Staff' };

export default async function AreaAddStaffPage() {
  await requirePermission('staff:create');
  const store = await getStore();

  const [regions, areas] = await Promise.all([
    store.regions.find({ orderBy: [{ field: 'name' }] }),
    store.areas.find({ orderBy: [{ field: 'name' }] }),
  ]);

  return (
    <AddPersonClient
      regions={regions}
      areas={areas}
      initialRole="EMPLOYEE"
      allowedRoles={['EMPLOYEE']}
      backHref="/area/staff"
      backLabel="Back to Staff"
      title="Add Wash Staff Member"
      description="Register a car wash boy, assign area operations, setup payout details, and attach KYC verification documents (Aadhaar or PAN)."
    />
  );
}
