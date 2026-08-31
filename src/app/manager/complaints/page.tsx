import { ConsoleComplaints } from '@/components/console/Complaints';
import { requirePermission } from '@/lib/auth/server';

export const metadata = { title: 'Complaints' };

export default async function ManagerComplaints() {
  const session = await requirePermission('complaint:view');
  return <ConsoleComplaints session={session} />;
}
