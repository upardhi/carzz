import { ConsoleCustomers } from '@/components/console/Customers';
import { requirePermission } from '@/lib/auth/server';

export const metadata = { title: 'Customers' };

export default async function ManagerCustomers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePermission('customer:view');
  return (
    <ConsoleCustomers
      session={session}
      base="/manager"
      searchParams={await searchParams}
    />
  );
}
