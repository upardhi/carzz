import Link from 'next/link';
import { PageHeader } from '@/components/shell/ConsoleShell';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { ROLES, type Role } from '@/lib/data/types';
import { UsersClient } from './UsersClient';

export const metadata = { title: 'Company People' };

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const session = await requirePermission('user:manage');
  const store = await getStore();
  const { role } = await searchParams;
  const initialRoleFilter: 'ALL' | Role =
    role && ROLES.includes(role as Role) ? (role as Role) : 'ALL';
  const initialWhere =
    initialRoleFilter === 'ALL'
      ? { role: { ne: 'CUSTOMER' } as never }
      : { role: initialRoleFilter };

  const [
    initialStaffUsers,
    totalStaffMatching,
    countSuperAdmin,
    countAreaAdmin,
    countManager,
    countEmployee,
    countCustomer,
    countAllStaff,
    countActiveStaff,
    countDisabledStaff,
    areas,
    regions,
  ] = await Promise.all([
    store.users.find({
      where: initialWhere,
      orderBy: [{ field: 'name', dir: 'asc' }],
      limit: 10,
      offset: 0,
    }),
    store.users.count(initialWhere),
    store.users.count({ role: 'SUPER_ADMIN' }),
    store.users.count({ role: 'AREA_ADMIN' }),
    store.users.count({ role: 'MANAGER' }),
    store.users.count({ role: 'EMPLOYEE' }),
    store.users.count({ role: 'CUSTOMER' }),
    store.users.count({ role: { ne: 'CUSTOMER' } as never }),
    store.users.count({ role: { ne: 'CUSTOMER' } as never, active: true }),
    store.users.count({ role: { ne: 'CUSTOMER' } as never, active: false }),
    store.areas.find({ orderBy: [{ field: 'name' }] }),
    store.regions.find({ orderBy: [{ field: 'name' }] }),
  ]);

  const initialKpiCounts: Record<Role, number> = {
    SUPER_ADMIN: countSuperAdmin,
    AREA_ADMIN: countAreaAdmin,
    MANAGER: countManager,
    EMPLOYEE: countEmployee,
    CUSTOMER: countCustomer,
  };

  const initialStatusCounts = {
    all: countAllStaff,
    active: countActiveStaff,
    disabled: countDisabledStaff,
  };

  const titleByRole: Record<'ALL' | Role, string> = {
    ALL: 'Company People',
    SUPER_ADMIN: 'Super Admins',
    AREA_ADMIN: 'Area Admins',
    MANAGER: 'Area Managers',
    EMPLOYEE: 'Boys',
    CUSTOMER: 'Customers',
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={titleByRole[initialRoleFilter]}
        description="Who exists, and what each of them can reach"
        actions={
          <Link
            href="/admin/users/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 cursor-pointer"
          >
            <span>+</span> Add Person
          </Link>
        }
      />

      <UsersClient
        initialUsers={initialStaffUsers}
        initialAreas={areas}
        initialRegions={regions}
        initialKpiCounts={initialKpiCounts}
        initialStatusCounts={initialStatusCounts}
        initialTotalItems={totalStaffMatching}
        initialRoleFilter={initialRoleFilter}
        currentUserId={session.user.id}
      />
    </div>
  );
}

