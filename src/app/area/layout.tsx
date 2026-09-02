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

  // counts is served from unstable_cache (60 s TTL). region lookup is a fast
  // single-row read. Both run in parallel.
  const [counts, region] = await Promise.all([
    navCounts(session.scope),
    session.user.regionId ? store.regions.get(session.user.regionId) : null,
  ]);

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
