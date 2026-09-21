import { ConsoleReferrals } from '@/components/console/Referrals';
import { requirePermission } from '@/lib/auth/server';

export const metadata = { title: 'Referrals' };

export default async function AreaReferrals() {
  const session = await requirePermission('referral:manage');
  return <ConsoleReferrals session={session} />;
}
