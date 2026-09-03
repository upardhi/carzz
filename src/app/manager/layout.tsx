import { ConsoleShell } from '@/components/shell/ConsoleShell';
import { navCounts } from '@/components/console/counts';
import { operationsNav } from '@/components/console/nav';
import { requireSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { ROLE_LABEL } from '@/lib/util/labels';

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const store = await getStore();

  // counts is served from unstable_cache (60 s TTL). areas.find() needed for
  // the scope label — both run in parallel.
  const [counts, areas] = await Promise.all([
    navCounts(session.scope),
    store.areas.find(),
  ]);

  const scopeLabel =
    session.scope.areaIds === null
      ? 'All areas'
      : areas
          .filter((a) => session.scope.areaIds!.includes(a.id))
          .map((a) => a.name)
          .join(', ') || 'No area assigned';

  return (
    <ConsoleShell
      roleLabel={ROLE_LABEL[session.user.role]}
      scopeLabel={scopeLabel}
      userName={session.user.name}
      nav={operationsNav('/manager', counts)}
    >
      {children}
    </ConsoleShell>
  );
}
