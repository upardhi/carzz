import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { currentCycle } from '@/lib/util/format';
import { StaffLeaveClient } from './StaffLeaveClient';

export const metadata = { title: 'Leave & Absence' };

export default async function StaffLeavePage() {
  const session = await requirePermission('leave:request');
  const store = await getStore();
  const staffId = session.user.staffId!;
  const cycle = currentCycle();

  const [leaves, settings, monthAttendance] = await Promise.all([
    store.leaves.find({
      where: { staffId },
      orderBy: [{ field: 'appliedAt', dir: 'desc' }],
    }),

    store.getPayoutSettings(),
    store.attendance.find({
      where: {
        staffId,
        date: { gte: `${cycle}-01`, lte: `${cycle}-31` },
      } as never,
    }),
  ]);

  const offsTaken = monthAttendance.filter(
    (a) => a.status === 'OFF' || a.status === 'OFF_UNINFORMED' || a.status === 'ABSENT',
  ).length;

  return (
    <StaffLeaveClient
      userName={session.user.name}
      leaves={leaves}
      offsAllowed={settings.offsAllowedPerMonth}
      offsTaken={offsTaken}
      extraOffPenalty={settings.extraOffPenalty}
    />
  );
}
