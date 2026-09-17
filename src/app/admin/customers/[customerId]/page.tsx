import { ConsoleCustomerDetail } from '@/components/console/CustomerDetail';
import { requirePermission } from '@/lib/auth/server';

export const metadata = { title: 'Customer' };

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const session = await requirePermission('customer:view');
  return (
    <ConsoleCustomerDetail
      session={session}
      base="/admin"
      customerId={customerId}
    />
  );
}
