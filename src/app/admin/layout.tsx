import { ConsoleShell } from '@/components/shell/ConsoleShell';
import { navCounts } from '@/components/console/counts';
import { adminNav } from '@/components/console/nav';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePermission('report:business');

  // counts is served from unstable_cache after the first hit (60 s TTL).
  // areas.find() is a cheap lookup needed only for the scope label.
  const store = await getStore();
  const [counts, areas] = await Promise.all([
    navCounts(session.scope),
    store.areas.find(),
  ]);

  return (
    <ConsoleShell
      roleLabel="Owner"
      scopeLabel={`All areas · ${areas.length}`}
      userName={session.user.name}
      nav={adminNav(counts)}
    >
      {children}
    </ConsoleShell>
  );
}
