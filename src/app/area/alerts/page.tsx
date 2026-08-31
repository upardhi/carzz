import { ConsoleAlerts } from '@/components/console/Alerts';
import { requirePermission } from '@/lib/auth/server';

export const metadata = { title: 'Red alerts' };

export default async function AreaAlerts() {
  const session = await requirePermission('payment:view');
  return <ConsoleAlerts session={session} base="/area" />;
}
