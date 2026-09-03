import { StaffFlagsClient } from '@/components/console/StaffFlagsClient';
import { requirePermission } from '@/lib/auth/server';

export const metadata = { title: 'Discipline Flags' };

export default async function ManagerStaffFlags() {
  await requirePermission('staff:view');
  return <StaffFlagsClient base="/manager" />;
}
