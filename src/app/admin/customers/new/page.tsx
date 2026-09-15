import { PageHeader } from '@/components/shell/ConsoleShell';
import { AddCustomerForm } from '@/components/console/AddCustomerForm';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';

export const metadata = { title: 'Add customer' };

export default async function AdminAddCustomer({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission('customer:create');
  const store = await getStore();
  const resolvedParams = searchParams ? await searchParams : {};
  const enquiryId = resolvedParams.enquiryId;

  const [areas, packages, staff, enquiry] = await Promise.all([
    store.areas.find({ orderBy: [{ field: 'name' }] }),
    store.packages.find({ where: { active: true } }),
    store.staff.find({
      where: { role: 'EMPLOYEE', active: true } as never,
      orderBy: [{ field: 'name' }],
    }),
    enquiryId ? store.enquiries.get(enquiryId) : null,
  ]);

  const initialEnquiry = enquiry
    ? {
        enquiryId: enquiry.id,
        name: enquiry.name,
        phone: enquiry.phone,
        email: enquiry.email || undefined,
        areaId: enquiry.areaId || undefined,
        locality: enquiry.locality || undefined,
        carCount: enquiry.carCount,
        packageId: enquiry.packageId || undefined,
        message: enquiry.message || undefined,
      }
    : undefined;

  return (
    <>
      <PageHeader
        title="Add customer"
        description="Saving creates this month's wash visits straight away."
      />
      <AddCustomerForm
        onSavedHref="/admin/customers"
        initialEnquiry={initialEnquiry}
        options={{
          areas: areas.map((a) => ({ id: a.id, name: a.name })),
          packages: packages.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            washesPerMonth: p.washesPerMonth,
            services: p.services,
          })),
          staff: staff.map((s) => ({ id: s.id, name: s.name, areaId: s.areaId })),
          defaultAreaId: initialEnquiry?.areaId ?? areas[0]?.id ?? '',
        }}
      />
    </>
  );
}
