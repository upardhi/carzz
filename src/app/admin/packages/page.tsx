import { PageHeader } from '@/components/shell/ConsoleShell';
import { Card, Row, Tag } from '@/components/ui/primitives';
import { IconCheck } from '@/components/shell/icons';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { parsePackageServices } from '@/lib/data/types';
import { money } from '@/lib/util/format';
import { CreatePackageForm, EditPackageForm } from './PackageForms';

export const metadata = { title: 'Packages' };

export default async function AdminPackages() {
  await requirePermission('package:manage');
  const store = await getStore();

  const packages = await store.packages.find();
  const counts = await Promise.all(
    packages.map(async (pkg) => [
      pkg.id,
      await store.cars.count({ packageId: pkg.id, active: true } as never),
    ] as const),
  );
  const countByPackage = new Map<string, number>(counts);

  return (
    <>
      <PageHeader
        title="Packages"
        description="Change your own rates, services & frequencies — no developer needed"
        actions={
          <CreatePackageForm existingNames={packages.map((pkg) => pkg.name)} />
        }
      />

      {packages.length === 0 ? (
        <Card className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 border border-slate-200/80 shadow-2xs">
            <svg
              className="h-8 w-8 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.6}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            No Packages Created Yet
          </h3>
          <p className="mt-1.5 max-w-md text-xs text-slate-500 leading-relaxed">
            Set up your first wash package with custom pricing, billing cycles, and included services to start subscribing customer vehicles.
          </p>
          <div className="mt-5">
            <CreatePackageForm existingNames={[]} />
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {packages.map((pkg) => {
          const cars = countByPackage.get(pkg.id) ?? 0;
          const parsedServices = parsePackageServices(pkg.services, pkg.washesPerMonth);

          return (
            <Card key={pkg.id} className="p-5 flex flex-col justify-between">
              <div>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{pkg.name}</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {pkg.washesPerPeriod} wash{pkg.washesPerPeriod === 1 ? '' : 'es'} /{' '}
                      {pkg.billingPeriod === 'WEEKLY' ? 'week' : pkg.billingPeriod === 'YEARLY' ? 'year' : 'month'}
                      {pkg.billingPeriod !== 'MONTHLY' ? ` · ≈${pkg.washesPerMonth}/month` : ' total'}
                    </p>
                  </div>
                  <Tag tone={pkg.active ? 'ok' : 'neutral'}>
                    {pkg.active ? 'Active' : 'Disabled'}
                  </Tag>
                </div>

                <div className="space-y-1.5 py-2 border-t border-b border-slate-100">
                  <Row label="Price / month" value={money(pkg.price)} />
                  <Row
                    label="Rate per wash"
                    value={money(Math.round(pkg.price / Math.max(1, pkg.washesPerMonth)))}
                  />
                  <Row label="Active cars subscribed" value={cars} />
                  <Row label="Cost to deliver" value={money(pkg.costToDeliver)} />
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Services Included ({parsedServices.length})
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                      Frequency
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {parsedServices.map((s) => (
                      <div
                        key={s.name}
                        className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-1.5 text-xs transition-colors hover:bg-slate-100/60"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <IconCheck width={10} height={10} strokeWidth={3} />
                          </span>
                          <span className="font-semibold text-slate-800 truncate">{s.name}</span>
                        </div>
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700 shadow-xs">
                          <span className="text-blue-600">{s.washesPerMonth}</span>
                          <span className="font-normal text-slate-400 text-[10px]">/ mo</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <EditPackageForm
                packageId={pkg.id}
                packageName={pkg.name}
                price={pkg.price}
                washesPerMonth={pkg.washesPerMonth}
                billingPeriod={pkg.billingPeriod}
                washesPerPeriod={pkg.washesPerPeriod}
                costToDeliver={pkg.costToDeliver}
                services={pkg.services}
                active={pkg.active}
              />
            </Card>
          );
        })}
        </div>
      )}
    </>
  );
}
