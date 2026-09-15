import { PageHeader } from '@/components/shell/ConsoleShell';
import { EnquiriesClient } from '@/components/console/EnquiriesClient';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { scopeAreaFilter } from '@/lib/auth/rbac';

export const metadata = { title: 'Customer Enquiries' };

export default async function ManagerEnquiries() {
  const session = await requirePermission('enquiry:view');
  const store = await getStore();
  const areaFilter = scopeAreaFilter(session.scope);

  const [
    initialEnquiries,
    totalMatching,
    countNew,
    countContacted,
    countConverted,
    countLost,
    countAll,
    areas,
    packages,
  ] = await Promise.all([
    store.enquiries.find({
      where: areaFilter as never,
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
      limit: 10,
      offset: 0,
    }),
    store.enquiries.count(areaFilter as never),
    store.enquiries.count({ status: 'NEW', ...areaFilter } as never),
    store.enquiries.count({ status: 'CONTACTED', ...areaFilter } as never),
    store.enquiries.count({ status: 'CONVERTED', ...areaFilter } as never),
    store.enquiries.count({ status: 'LOST', ...areaFilter } as never),
    store.enquiries.count(areaFilter as never),
    store.areas.find({ orderBy: [{ field: 'name' }] }),
    store.packages.find(),
  ]);

  const scopedAreas = areas.filter(
    (a) => session.scope.areaIds === null || session.scope.areaIds.includes(a.id),
  );

  const phones = initialEnquiries.map((i) => i.phone);
  const existingCustomers = phones.length
    ? await store.customers.find({
        where: { phone: { in: phones }, ...areaFilter } as never,
      })
    : [];

  const phoneMap: Record<string, { id: string; name: string; areaId: string }> = {};
  for (const c of existingCustomers) {
    phoneMap[c.phone] = { id: c.id, name: c.name, areaId: c.areaId };
  }

  return (
    <>
      <PageHeader
        title="Customer Enquiries"
        description="Booking requests and enquiries submitted for your service area"
      />

      <EnquiriesClient
        basePath="/manager"
        initialEnquiries={initialEnquiries}
        initialAreas={scopedAreas}
        initialPackages={packages}
        initialKpis={{
          all: countAll,
          new: countNew,
          contacted: countContacted,
          converted: countConverted,
          lost: countLost,
        }}
        initialTotalItems={totalMatching}
        existingCustomerPhoneMap={phoneMap}
      />
    </>
  );
}
