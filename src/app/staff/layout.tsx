import { redirect } from 'next/navigation';
import { MobileShell, type TabItem } from '@/components/shell/MobileShell';
import {
  IconList,
  IconRupee,
  IconUser,
  IconWallet,
} from '@/components/shell/icons';
import { MarkAttendance } from './MarkAttendance';
import { requireSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { formatDateFull } from '@/lib/util/format';

const TABS: TabItem[] = [
  { href: '/staff', label: 'Today', icon: <IconList /> },
  { href: '/staff/earnings', label: 'Earnings', icon: <IconRupee /> },
  { href: '/staff/pocket', label: 'Pocket', icon: <IconWallet /> },
  { href: '/staff/profile', label: 'Profile', icon: <IconUser /> },
];

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  if (!session.user.staffId) redirect('/');

  const store = await getStore();
  const area = session.user.areaId
    ? await store.areas.get(session.user.areaId)
    : null;

  return (
    <>
      {/* Opening the app is the attendance record — no separate form to forget. */}
      <MarkAttendance />
      <MobileShell
        title={`${session.user.name.split(' ')[0]} — ${area?.name ?? 'Carz'}`}
        subtitle={formatDateFull(new Date())}
        tabs={TABS}
        action={
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-lg px-2 py-1 text-xs font-bold text-teal-300 hover:bg-navy-800"
            >
              Sign out
            </button>
          </form>
        }
      >
        {children}
      </MobileShell>
    </>
  );
}
