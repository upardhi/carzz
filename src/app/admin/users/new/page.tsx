import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { AddPersonClient } from './AddPersonClient';

export const metadata = { title: 'Add team member — Admin' };

export default async function NewUserPage() {
  await requirePermission('user:manage');
  const store = await getStore();

  const [areas, regions, rules, pendingReferrals, staff] = await Promise.all([
    store.areas.find({ orderBy: [{ field: 'name' }] }),
    store.regions.find({ orderBy: [{ field: 'name' }] }),
    store.getPayoutSettings(),
    store.staffReferrals.find({
      where: { type: 'STAFF', status: 'APPROVED', convertedStaffId: null } as never,
    }),
    store.staff.find(),
  ]);
  const staffById = new Map(staff.map((s) => [s.id, s]));

  return (
    <div className="py-2">
      <AddPersonClient
        areas={areas}
        regions={regions}
        staffReferralBonus={rules.staffReferralBonus}
        approvedStaffReferrals={pendingReferrals.map((r) => ({
          id: r.id,
          areaId: r.areaId,
          name: r.name,
          phone: r.phone,
          referredByStaffId: r.referredByStaffId,
          referredByStaffName: staffById.get(r.referredByStaffId)?.name ?? 'Unknown',
        }))}
        allowDirectReferral
        existingStaff={staff.map((s) => ({ id: s.id, name: s.name, areaId: s.areaId }))}
      />
    </div>
  );
}
