import { ConsoleDashboard } from '@/components/console/Dashboard';
import { requirePermission } from '@/lib/auth/server';

export const metadata = { title: 'Dashboard' };

export default async function AreaDashboard() {
  const session = await requirePermission('report:area');
  return <ConsoleDashboard session={session} base="/area" />;
}
