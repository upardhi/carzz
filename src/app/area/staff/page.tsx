import { ConsoleStaff } from '@/components/console/Staff';
import { requirePermission } from '@/lib/auth/server';

export const metadata = { title: 'Staff' };

export default async function AreaStaff() {
  const session = await requirePermission('staff:view');
  return <ConsoleStaff session={session} />;
}
