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
  const store = await getStore();
  const counts = await navCounts(store, session.scope);
  const areas = await store.areas.find();

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
