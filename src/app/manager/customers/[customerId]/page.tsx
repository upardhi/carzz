import { ConsoleCustomerDetail } from '@/components/console/CustomerDetail';
import { requirePermission } from '@/lib/auth/server';

export const metadata = { title: 'Customer' };

export default async function ManagerCustomerDetail({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const session = await requirePermission('customer:view');
  const { customerId } = await params;
  return (
    <ConsoleCustomerDetail
      session={session}
      base="/manager"
      customerId={customerId}
    />
  );
}
