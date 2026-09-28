import { AddPersonClient } from '@/app/admin/users/new/AddPersonClient';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';

export const metadata = { title: 'Add Wash Staff' };

export default async function ManagerAddStaffPage() {
  const session = await requirePermission('staff:create');
  const store = await getStore();
  const areaFilter = scopeAreaFilter(session.scope);

  const [regions, allAreas, rules, pendingReferrals, staff] = await Promise.all([
    store.regions.find({ orderBy: [{ field: 'name' }] }),
    store.areas.find({ orderBy: [{ field: 'name' }] }),
    store.getPayoutSettings(),
    store.staffReferrals.find({
      where: { type: 'STAFF', status: 'APPROVED', convertedStaffId: null } as never,
    }),
    store.staff.find(),
  ]);
  const staffById = new Map(staff.map((s) => [s.id, s]));

  // Restrict areas to manager's assigned scope
  const areas = session.scope.areaIds && session.scope.areaIds.length > 0
    ? allAreas.filter((a) => session.scope.areaIds!.includes(a.id))
    : allAreas;

  const scopedApprovedReferrals = pendingReferrals.filter((r) => {
    if (!r.areaId) return true;
    if (session.scope.areaIds && session.scope.areaIds.length > 0) {
      return session.scope.areaIds.includes(r.areaId);
    }
    return true;
  });

  return (
    <AddPersonClient
      regions={regions}
      areas={areas}
      initialRole="EMPLOYEE"
      allowedRoles={['EMPLOYEE']}
      backHref="/manager/staff"
      backLabel="Back to Staff"
      title="Add Wash Staff Member"
      description="Register a car wash boy in your assigned area, setup payout details, and attach KYC verification documents (Aadhaar or PAN)."
      staffReferralBonus={rules.staffReferralBonus}
      approvedStaffReferrals={scopedApprovedReferrals.map((r) => ({
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

