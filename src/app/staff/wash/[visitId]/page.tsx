import { notFound, redirect } from 'next/navigation';
import { Card } from '@/components/ui/primitives';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { nextSlotAfter } from '@/lib/services/schedule';
import { WashFlow } from './WashFlow';

export const metadata = { title: 'Wash' };

export default async function WashPage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await params;
  const session = await requirePermission('visit:complete');
  const store = await getStore();

  const visit = await store.visits.get(visitId);
  if (!visit) notFound();

  // A wash boy may only open his own car. A manager covering an absence can
  // open anything inside their area.
  const isAssigned = visit.staffId === session.user.staffId;
  const inScope =
    session.scope.areaIds === null ||
    session.scope.areaIds.includes(visit.areaId);
  if (!isAssigned && !(session.user.role !== 'EMPLOYEE' && inScope)) notFound();

  if (visit.status === 'DONE' || visit.status === 'MISSED') {
    redirect('/staff');
  }

  const [car, customer, settings] = await Promise.all([
    store.cars.get(visit.carId),
    store.customers.get(visit.customerId),
    store.getAppSettings(),
  ]);
  if (!car || !customer) notFound();

  const pkg = await store.packages.get(car.packageId);
  const mapsHref =
    customer.lat && customer.lng
      ? `https://www.google.com/maps/search/?api=1&query=${customer.lat},${customer.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`;

  return (
    <div className="space-y-3">
      {/* Only what he needs standing at the car: who, which car, where. */}
      <Card className="p-4">
        <h1 className="text-base font-extrabold">{customer.name}</h1>
        <p className="mt-0.5 text-sm text-ink-mute">
          {car.make} {car.model} · {car.colour} · {car.plate}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {customer.address}
          {customer.landmark ? ` · ${customer.landmark}` : ''}
        </p>

        {customer.note || car.specialInstructions ? (
          <p className="mt-2 rounded-lg bg-gold-50 px-3 py-2 text-sm font-semibold text-gold-700">
            {customer.note ?? car.specialInstructions}
          </p>
        ) : null}

        <a
          href={mapsHref}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block rounded-lg border border-line-strong bg-white py-2.5 text-center text-sm font-bold text-navy-800"
        >
          Open in Maps
        </a>
      </Card>

      <WashFlow
        visitId={visit.id}
        services={pkg?.services ?? ['Exterior wash', 'Interior vacuum']}
        initialBefore={visit.beforePhotoUrl}
        initialAfter={visit.afterPhotoUrl}
        requireBothPhotos={settings.requireBothPhotos}
        nextSlotDate={nextSlotAfter(car, visit.scheduledDate)}
      />
    </div>
  );
}
