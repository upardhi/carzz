import { PocketRequestsClient } from '@/components/console/PocketRequestsClient';
import { requirePermission } from '@/lib/auth/server';

export const metadata = { title: 'Pocket Money Requests' };

export default async function AreaStaffRequests() {
  await requirePermission('staff:view');
  return <PocketRequestsClient base="/area" />;
}
