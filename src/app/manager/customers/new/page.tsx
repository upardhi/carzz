import { PageHeader } from '@/components/shell/ConsoleShell';
import { AddCustomerWizard } from '@/components/console/AddCustomerWizard';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { scopeAreaFilter } from '@/lib/auth/rbac';

export const metadata = { title: 'Add customer' };

export default async function ManagerAddCustomer() {
  const session = await requirePermission('customer:create');
  const store = await getStore();
  const areaFilter = scopeAreaFilter(session.scope);

  const [areas, packages, staff] = await Promise.all([
    store.areas.find({ orderBy: [{ field: 'name' }] }),
    store.packages.find({ where: { active: true } }),
    store.staff.find({
      where: { role: 'EMPLOYEE', active: true, ...areaFilter } as never,
      orderBy: [{ field: 'name' }],
    }),
  ]);

  const scopedAreas = areas.filter(
    (a) => session.scope.areaIds === null || session.scope.areaIds.includes(a.id),
  );

  return (
    <>
      <PageHeader
        title="Add customer"
        description="Five steps. Saving creates this month's wash visits straight away."
      />
      <AddCustomerWizard
        onSavedHref="/manager/customers"
        options={{
          areas: scopedAreas.map((a) => ({ id: a.id, name: a.name })),
          packages: packages.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            washesPerMonth: p.washesPerMonth,
          })),
          staff: staff.map((s) => ({ id: s.id, name: s.name, areaId: s.areaId })),
          defaultAreaId: scopedAreas[0]?.id ?? '',
        }}
      />
    </>
  );
}
