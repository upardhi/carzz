import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { RequestsClient } from '../../admin/requests/RequestsClient';

export const metadata = { title: 'Customer Requests' };

export default async function ManagerCustomerRequests() {
  const session = await requirePermission('customer:view');
  const store = await getStore();
  const staff = await store.staff.find({
    where: {
      role: 'EMPLOYEE',
      ...(session.scope.areaIds ? { areaId: { in: session.scope.areaIds } } : {}),
    } as never,
    orderBy: [{ field: 'name' }],
  });

  const staffList = staff.map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    areaId: s.areaId,
  }));

  return <RequestsClient base="/manager" staffList={staffList} />;
}
