import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Card,
  CardHeading,
  Note,
  Table,
  TableWrap,
  Tag,
  Td,
  Th,
} from '@/components/ui/primitives';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { areaPerformance } from '@/lib/services/reports';
import { currentCycle, formatDateFull, money, percent } from '@/lib/util/format';

export const metadata = { title: 'Managers' };

/** An Area Admin manages managers; their area's numbers are their scorecard. */
export default async function AreaAdminManagers() {
  const session = await requirePermission('staff:view');
  const store = await getStore();
  const cycle = currentCycle();

  const [managers, performance, users] = await Promise.all([
    store.staff.find({
      where: {
        role: 'MANAGER',
        ...(session.scope.areaIds
          ? { areaId: { in: session.scope.areaIds } }
          : {}),
      } as never,
      orderBy: [{ field: 'name' }],
    }),
    areaPerformance(store, cycle, session.scope.areaIds),
    store.users.find({ where: { role: 'MANAGER' } }),
  ]);

  const performanceByArea = new Map(performance.map((p) => [p.area.id, p]));
  const userByStaff = new Map(
    users.filter((u) => u.staffId).map((u) => [u.staffId!, u]),
  );

  return (
    <>
      <PageHeader
        title="Managers"
        description={`${managers.length} area managers reporting to you`}
      />

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>Manager</Th>
              <Th>Area</Th>
              <Th>Login</Th>
              <Th>Customers</Th>
              <Th>Collected</Th>
              <Th>Outstanding</Th>
              <Th>Missed</Th>
              <Th>Complaints</Th>
              <Th>Margin</Th>
              <Th>Since</Th>
            </tr>
          </thead>
          <tbody>
            {managers.map((manager) => {
              const stats = performanceByArea.get(manager.areaId);
              const user = userByStaff.get(manager.id);
              return (
                <tr key={manager.id}>
                  <Td className="font-bold">{manager.name}</Td>
                  <Td>{stats?.area.name ?? '—'}</Td>
                  <Td className="text-[12px] text-ink-mute">
                    {user?.email ?? '—'}
                  </Td>
                  <Td>{stats?.customers ?? 0}</Td>
                  <Td>{money(stats?.collected ?? 0)}</Td>
                  <Td
                    className={
                      (stats?.outstanding ?? 0) > 0 ? 'font-bold text-gold-600' : ''
                    }
                  >
                    {money(stats?.outstanding ?? 0)}
                  </Td>
                  <Td
                    className={
                      (stats?.washesMissed ?? 0) > 30
                        ? 'font-bold text-danger-500'
                        : ''
                    }
                  >
                    {stats?.washesMissed ?? 0}
                  </Td>
                  <Td>{stats?.openComplaints ?? 0}</Td>
                  <Td className="font-bold">
                    {stats ? percent(stats.margin) : '—'}
                  </Td>
                  <Td className="whitespace-nowrap text-[12px] text-ink-mute">
                    {formatDateFull(manager.joinedOn)}
                  </Td>
                </tr>
              );
            })}
            {managers.length === 0 ? (
              <tr>
                <Td className="py-8 text-center text-ink-mute" colSpan={10}>
                  No managers in your region yet.
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </TableWrap>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <CardHeading>Where to push</CardHeading>
          {performance
            .slice()
            .sort((a, b) => b.outstanding - a.outstanding)
            .slice(0, 3)
            .map((area) => (
              <div
                key={area.area.id}
                className="mb-2 rounded-lg border border-line bg-white p-3 last:mb-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <b className="text-sm">{area.area.name}</b>
                  <Tag tone={area.outstanding > 30000 ? 'bad' : 'warn'}>
                    {money(area.outstanding)} outstanding
                  </Tag>
                </div>
                <p className="mt-1 text-xs text-ink-mute">
                  {area.washesMissed} missed washes ·{' '}
                  {area.openComplaints} open complaints · margin{' '}
                  {percent(area.margin)}
                </p>
              </div>
            ))}
        </Card>

        <Card className="p-4">
          <CardHeading>Adding a manager</CardHeading>
          <Note>
            Creating a manager account and assigning them to an area is a Super
            Admin action, so one person owns the org chart. Ask the owner from
            the People &amp; roles screen, and the new manager appears here
            straight away.
          </Note>
        </Card>
      </div>
    </>
  );
}
