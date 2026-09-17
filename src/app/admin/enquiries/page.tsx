import { PageHeader } from '@/components/shell/ConsoleShell';
import { EnquiriesClient } from '@/components/console/EnquiriesClient';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';

export const metadata = { title: 'Customer Enquiries' };

export default async function AdminEnquiries() {
  await requirePermission('enquiry:view');
  const store = await getStore();

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
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
      limit: 10,
      offset: 0,
    }),
    store.enquiries.count(),
    store.enquiries.count({ status: 'NEW' } as never),
    store.enquiries.count({ status: 'CONTACTED' } as never),
    store.enquiries.count({ status: 'CONVERTED' } as never),
    store.enquiries.count({ status: 'LOST' } as never),
    store.enquiries.count(),
    store.areas.find({ orderBy: [{ field: 'name' }] }),
    store.packages.find(),
  ]);

  const phones = initialEnquiries.map((i) => i.phone);
  const existingCustomers = phones.length
    ? await store.customers.find({
        where: { phone: { in: phones } } as never,
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
        description="Booking and service enquiries received from the public website"
      />

      <EnquiriesClient
        basePath="/admin"
        initialEnquiries={initialEnquiries}
        initialAreas={areas}
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
