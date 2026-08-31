import { ConsoleSchedule } from '@/components/console/Schedule';
import { requirePermission } from '@/lib/auth/server';

export const metadata = { title: 'Schedule' };

export default async function AreaSchedule({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requirePermission('visit:assign');
  return <ConsoleSchedule session={session} searchParams={await searchParams} />;
}
