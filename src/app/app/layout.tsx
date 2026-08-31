import { redirect } from 'next/navigation';
import { MobileShell, type TabItem } from '@/components/shell/MobileShell';
import {
  IconCar,
  IconChat,
  IconHome,
  IconRupee,
} from '@/components/shell/icons';
import { requireSession } from '@/lib/auth/server';

const TABS: TabItem[] = [
  { href: '/app', label: 'Home', icon: <IconHome /> },
  { href: '/app/cars', label: 'My Cars', icon: <IconCar /> },
  { href: '/app/payments', label: 'Payments', icon: <IconRupee /> },
  { href: '/app/help', label: 'Help', icon: <IconChat /> },
];

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  // A staff account has no customer record to show; middleware normally keeps
  // them out, but a role change mid-session would land here.
  if (!session.user.customerId) redirect('/');

  return (
    <MobileShell
      title={`Hello, ${session.user.name.split(' ')[0]}`}
      subtitle="Your cars, schedule and payments"
      tabs={TABS}
      action={
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="rounded-lg px-2 py-1 text-xs font-bold text-navy-300 hover:bg-navy-800"
          >
            Sign out
          </button>
        </form>
      }
    >
      {children}
    </MobileShell>
  );
}
