import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Card,
  CardHeading,
  Kpi,
  KpiGrid,
  Note,
  Tag,
} from '@/components/ui/primitives';
import { DataTable } from '@/components/ui/DataTable';
import { ActionButton } from '@/components/console/ActionButton';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { ROLES } from '@/lib/data/types';
import { formatDateFull } from '@/lib/util/format';
import { ROLE_BLURB, ROLE_LABEL } from '@/lib/util/labels';
import { AddUserForm } from './AddUserForm';

export const metadata = { title: 'People & roles' };

export default async function AdminUsers() {
  const session = await requirePermission('user:manage');
  const store = await getStore();

  const [users, areas, regions] = await Promise.all([
    store.users.find({ orderBy: [{ field: 'name' }] }),
    store.areas.find({ orderBy: [{ field: 'name' }] }),
    store.regions.find(),
  ]);

  const areaById = new Map(areas.map((a) => [a.id, a]));
  const regionById = new Map(regions.map((r) => [r.id, r]));

  // Customers are listed under Customers, not here — this screen is the staff
  // org chart and who can reach what.
  const staffUsers = users.filter((u) => u.role !== 'CUSTOMER');
  const countByRole = new Map(
    ROLES.map((role) => [role, users.filter((u) => u.role === role).length]),
  );

  return (
    <>
      <PageHeader
        title="People & roles"
        description="Who exists, and what each of them can reach"
      />

      <KpiGrid columns={5}>
        {ROLES.map((role) => (
          <Kpi
            key={role}
            label={ROLE_LABEL[role].toUpperCase()}
            value={countByRole.get(role) ?? 0}
            tone={
              role === 'SUPER_ADMIN'
                ? 'purple'
                : role === 'AREA_ADMIN'
                  ? 'blue'
                  : role === 'MANAGER'
                    ? 'sky'
                    : role === 'EMPLOYEE'
                      ? 'emerald'
                      : 'slate'
            }
            subtext={role === 'CUSTOMER' ? 'Mobile app logins' : `${ROLE_LABEL[role]} accounts`}
          />
        ))}
      </KpiGrid>

      <div className="mt-4 grid gap-3 xl:grid-cols-[2fr_1fr]">
        <div>
          <DataTable<(typeof staffUsers)[number]>
            data={staffUsers}
            keyExtractor={(user) => user.id}
            itemLabel="staff users"
            emptyMessage="No staff users found."
            columns={[
              {
                id: 'name',
                header: 'NAME',
                className: 'font-bold text-navy-950',
                render: (user) => user.name,
              },
              {
                id: 'role',
                header: 'ROLE',
                render: (user) => (
                  <Tag tone={user.role === 'SUPER_ADMIN' ? 'info' : 'neutral'}>
                    {ROLE_LABEL[user.role]}
                  </Tag>
                ),
              },
              {
                id: 'reaches',
                header: 'REACHES',
                className: 'text-xs text-slate-500',
                render: (user) =>
                  user.role === 'SUPER_ADMIN'
                    ? 'Every area'
                    : user.regionId
                      ? `${regionById.get(user.regionId)?.name ?? '—'} region`
                      : user.areaId
                        ? (areaById.get(user.areaId)?.name ?? '—')
                        : '—',
              },
              {
                id: 'email',
                header: 'EMAIL',
                className: 'text-xs text-slate-500',
                render: (user) => user.email,
              },
              {
                id: 'mobile',
                header: 'MOBILE',
                className: 'text-xs text-slate-500',
                render: (user) => user.phone,
              },
              {
                id: 'added',
                header: 'ADDED',
                className: 'whitespace-nowrap text-xs text-slate-500',
                render: (user) => formatDateFull(user.createdAt),
              },
              {
                id: 'status',
                header: 'STATUS',
                render: (user) => (
                  <Tag tone={user.active ? 'ok' : 'bad'}>
                    {user.active ? 'Active' : 'Disabled'}
                  </Tag>
                ),
              },
              {
                id: 'action',
                header: 'ACTION',
                render: (user) =>
                  user.id === session.user.id ? (
                    <span className="text-xs text-slate-400">You</span>
                  ) : (
                    <ActionButton
                      endpoint="/api/admin/users"
                      variant={user.active ? 'secondary' : 'primary'}
                      payload={{
                        action: 'setActive',
                        userId: user.id,
                        active: !user.active,
                      }}
                      confirm={
                        user.active
                          ? `Deactivate ${user.name}? Their login stops working immediately.`
                          : undefined
                      }
                    >
                      {user.active ? 'Deactivate' : 'Reactivate'}
                    </ActionButton>
                  ),
              },
            ]}
          />

          <Card className="mt-3 p-4">
            <CardHeading>What each role can reach</CardHeading>
            {ROLES.map((role) => (
              <div
                key={role}
                className="flex items-baseline justify-between gap-3 border-b border-dashed border-line-soft py-1.5 text-sm last:border-0"
              >
                <span className="font-bold">{ROLE_LABEL[role]}</span>
                <span className="text-right text-ink-mute">{ROLE_BLURB[role]}</span>
              </div>
            ))}
            <div className="mt-3">
              <Note>
                Scope is enforced on every read and write, not just hidden in
                the menu — a manager cannot reach another area&rsquo;s records
                even by editing the address bar.
              </Note>
            </div>
          </Card>
        </div>

        <Card className="p-4">
          <CardHeading>Add someone</CardHeading>
          <AddUserForm
            regions={regions.map((r) => ({ id: r.id, name: r.name }))}
            areas={areas.map((a) => ({ id: a.id, name: a.name }))}
          />
        </Card>
      </div>
    </>
  );
}
