import { AddPersonClient } from '@/app/admin/users/new/AddPersonClient';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';

export const metadata = { title: 'Add Wash Staff' };

export default async function ManagerAddStaffPage() {
  const session = await requirePermission('staff:create');
  const store = await getStore();
  const areaFilter = scopeAreaFilter(session.scope);

  const [regions, areas, rules, pendingReferrals, staff] = await Promise.all([
    store.regions.find({ orderBy: [{ field: 'name' }] }),
    store.areas.find({ orderBy: [{ field: 'name' }] }),
    store.getPayoutSettings(),
    store.staffReferrals.find({
      where: { type: 'STAFF', status: 'APPROVED', convertedStaffId: null, ...areaFilter } as never,
    }),
    store.staff.find({ where: areaFilter as never }),
  ]);
  const staffById = new Map(staff.map((s) => [s.id, s]));

  return (
    <AddPersonClient
      regions={regions}
      areas={areas}
      initialRole="EMPLOYEE"
      allowedRoles={['EMPLOYEE']}
      backHref="/manager/staff"
      backLabel="Back to Staff"
      title="Add Wash Staff Member"
      description="Register a car wash boy, assign area operations, setup payout details, and attach KYC verification documents (Aadhaar or PAN)."
      staffReferralBonus={rules.staffReferralBonus}
      approvedStaffReferrals={pendingReferrals.map((r) => ({
        id: r.id,
        areaId: r.areaId,
        name: r.name,
        phone: r.phone,
        referredByStaffId: r.referredByStaffId,
        referredByStaffName: staffById.get(r.referredByStaffId)?.name ?? 'Unknown',
      }))}
    />
  );
}
