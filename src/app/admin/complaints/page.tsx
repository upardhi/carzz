import { ConsoleComplaints } from '@/components/console/Complaints';
import { requirePermission } from '@/lib/auth/server';

export const metadata = { title: 'Complaints' };

export default async function AdminComplaints() {
  const session = await requirePermission('complaint:view');
  // Nothing above the owner to escalate to, so that action is hidden here.
  return <ConsoleComplaints session={session} canEscalate={false} />;
}
