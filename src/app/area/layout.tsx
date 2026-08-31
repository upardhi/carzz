import { ConsoleShell } from '@/components/shell/ConsoleShell';
import { navCounts } from '@/components/console/counts';
import { regionNav } from '@/components/console/nav';
import { requireSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { ROLE_LABEL } from '@/lib/util/labels';

export default async function AreaAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const store = await getStore();
  const counts = await navCounts(store, session.scope);

  const region = session.user.regionId
    ? await store.regions.get(session.user.regionId)
    : null;
  const areaCount = session.scope.areaIds?.length ?? 'all';

  return (
    <ConsoleShell
      roleLabel={ROLE_LABEL[session.user.role]}
      scopeLabel={`${region?.name ?? 'All regions'} · ${areaCount} areas`}
      userName={session.user.name}
      nav={regionNav(counts)}
    >
      {children}
    </ConsoleShell>
  );
}
