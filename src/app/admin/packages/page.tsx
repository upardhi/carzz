import { PageHeader } from '@/components/shell/ConsoleShell';
import { Card, CardHeading, Note, Row, Tag } from '@/components/ui/primitives';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { money, percent } from '@/lib/util/format';
import { CreatePackageForm, EditPackageForm } from './PackageForms';

export const metadata = { title: 'Packages' };

export default async function AdminPackages() {
  await requirePermission('package:manage');
  const store = await getStore();

  const [packages, cars] = await Promise.all([
    store.packages.find(),
    store.cars.find({ where: { active: true } }),
  ]);

  const countByPackage = new Map<string, number>();
  for (const car of cars) {
    countByPackage.set(car.packageId, (countByPackage.get(car.packageId) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="Packages"
        description="Change your own rates — no developer needed"
      />

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {packages.map((pkg) => {
          const margin = pkg.price > 0 ? (pkg.price - pkg.costToDeliver) / pkg.price : 0;
          const cars = countByPackage.get(pkg.id) ?? 0;

          return (
            <Card key={pkg.id} className="p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-sm font-extrabold">{pkg.name}</h3>
                <Tag tone={pkg.active ? 'ok' : 'neutral'}>
                  {pkg.active ? 'Active' : 'Retired'}
                </Tag>
              </div>

              <Row label="Washes per month" value={pkg.washesPerMonth} />
              <Row label="Price" value={money(pkg.price)} />
              <Row
                label="Per wash"
                value={money(Math.round(pkg.price / Math.max(1, pkg.washesPerMonth)))}
              />
              <Row label="Cars on it" value={cars} />
              <Row label="Cost to deliver" value={money(pkg.costToDeliver)} />
              <Row
                label="Margin"
                value={percent(margin)}
                tone={margin > 0.4 ? 'success' : margin > 0 ? 'gold' : 'danger'}
              />

              <p className="mt-2 text-xs text-ink-mute">
                {pkg.services.join(' · ')}
              </p>

              <EditPackageForm
                packageId={pkg.id}
                price={pkg.price}
                washesPerMonth={pkg.washesPerMonth}
                costToDeliver={pkg.costToDeliver}
              />
            </Card>
          );
        })}

        <Card accent="brand" className="p-4">
          <CardHeading>Create a package</CardHeading>
          <CreatePackageForm />
          <div className="mt-3">
            <Note>
              A price change applies to customers added afterwards. Invoices
              already raised are left as they are, so nobody is re-billed for a
              month they have already paid.
            </Note>
          </div>
        </Card>
      </div>
    </>
  );
}
