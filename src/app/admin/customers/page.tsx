import { ConsoleCustomers } from '@/components/console/Customers';
import { requirePermission } from '@/lib/auth/server';

export const metadata = { title: 'Customers' };

export default async function AdminCustomers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePermission('customer:view');
  return (
    <ConsoleCustomers
      session={session}
      base="/admin"
      searchParams={await searchParams}
    />
  );
}
