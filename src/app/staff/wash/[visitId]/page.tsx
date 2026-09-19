import { notFound, redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { parsePackageServices, type PackageServiceItem } from '@/lib/data/types';
import { nextSlotAfter } from '@/lib/services/schedule';
import { currentCycle, cycleLabel, previousCycle } from '@/lib/util/format';
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';
import { washDurationMinutes, washSpeedFlag } from '@/lib/util/washTiming';
import { WashFlow } from './WashFlow';

export const metadata = { title: 'Wash' };

export interface ServiceUsageStat {
  name: string;
  quotaPerMonth: number;
  timesDoneThisCycle: number;
  timesDoneLastCycle: number;
  lastDoneDate: string | null;
  isQuotaMet: boolean;
  shouldDefaultSkip: boolean;
}

export interface PastWashRecord {
  id: string;
  cycle: string;
  date: string;
  time: string;
  status: string;
  servicesDone: string[];
  beforePhotoUrl: string | null;
  afterPhotoUrl: string | null;
  rating: number | null;
  ratingComment: string | null;
  missReason: string | null;
  missNote: string | null;
  durationMinutes: number | null;
  speedFlag: 'fast' | 'slow' | null;
  managerRating: number | null;
  managerRatingComment: string | null;
}

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

  // 1. Properly query database for all visits for this car to establish full history for this active package running
  const allCarVisits = await store.visits.find({
    where: { carId: car.id },
    orderBy: [{ field: 'scheduledDate', dir: 'desc' }],
    limit: 60,
  });

  const activeCycle = visit.cycle || currentCycle();
  const lastCycle = previousCycle(activeCycle);

  // Parse package services and quotas
  const parsedPackageServices: PackageServiceItem[] = parsePackageServices(
    pkg?.services,
    pkg?.washesPerMonth ?? 8,
  );

  // Compute service usage stats for this cycle and last month cycle
  const serviceStats: ServiceUsageStat[] = parsedPackageServices.map((s) => {
    const matchingCompletedVisits = allCarVisits.filter(
      (v) =>
        v.status === 'DONE' &&
        v.id !== visit.id &&
        Array.isArray(v.servicesDone) &&
        v.servicesDone.some(
          (doneName) =>
            doneName.trim().toLowerCase() === s.name.trim().toLowerCase() ||
            doneName.trim().toLowerCase().includes(s.name.trim().toLowerCase()),
        ),
    );

    const timesDoneThisCycle = matchingCompletedVisits.filter(
      (v) => v.cycle === activeCycle,
    ).length;

    const timesDoneLastCycle = matchingCompletedVisits.filter(
      (v) => v.cycle === lastCycle,
    ).length;

    const lastDoneVisit = matchingCompletedVisits[0];
    const lastDoneDate = lastDoneVisit ? lastDoneVisit.scheduledDate : null;

    const isQuotaMet = timesDoneThisCycle >= s.washesPerMonth;
    const shouldDefaultSkip = isQuotaMet;

    return {
      name: s.name,
      quotaPerMonth: s.washesPerMonth,
      timesDoneThisCycle,
      timesDoneLastCycle,
      lastDoneDate,
      isQuotaMet,
      shouldDefaultSkip,
    };
  });

  // Calculate total package washes done vs quota
  const completedVisitsThisCycle = allCarVisits.filter(
    (v) => v.status === 'DONE' && v.cycle === activeCycle && v.id !== visit.id,
  );
  const totalDoneThisCycle = completedVisitsThisCycle.length;
  const totalPackageWashes = pkg?.washesPerMonth ?? 8;

  const completedVisitsLastCycle = allCarVisits.filter(
    (v) => v.status === 'DONE' && v.cycle === lastCycle,
  );
  const totalDoneLastCycle = completedVisitsLastCycle.length;

  // Format past visits with photos for wash history view
  const pastHistory: PastWashRecord[] = allCarVisits
    .filter((v) => v.id !== visit.id && (v.status === 'DONE' || v.status === 'MISSED'))
    .map((v) => ({
      id: v.id,
      cycle: v.cycle,
      date: v.scheduledDate,
      time: v.scheduledTime,
      status: v.status,
      servicesDone: v.servicesDone || [],
      beforePhotoUrl: resolvePublicPhotoUrl(v.beforePhotoUrl),
      afterPhotoUrl: resolvePublicPhotoUrl(v.afterPhotoUrl),
      rating: v.rating ?? null,
      ratingComment: v.ratingComment ?? null,
      missReason: v.missReason ?? null,
      missNote: v.missNote ?? null,
      durationMinutes: washDurationMinutes(v),
      speedFlag: washSpeedFlag(washDurationMinutes(v), settings),
      managerRating: v.managerRating ?? null,
      managerRatingComment: v.managerRatingComment ?? null,
    }));

  const mapsHref =
    customer.lat && customer.lng
      ? `https://www.google.com/maps/search/?api=1&query=${customer.lat},${customer.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`;

  return (
    <div className="space-y-4">
      {/* 1. Vehicle & Customer Summary Header */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200/60 px-2.5 py-0.5 text-[11.5px] font-semibold text-blue-700 mb-2">
              🚗 Wash in Progress
            </div>
            <h1 className="text-lg font-bold text-slate-900">{customer.name}</h1>
            <p className="text-sm font-semibold text-slate-700 mt-0.5">
              {car.make} {car.model} · <span className="font-mono text-blue-900">{car.plate}</span> · {car.colour}
            </p>
          </div>
        </div>

        <div className="mt-3 text-xs font-medium text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-start gap-2">
          <span className="text-sm">📍</span>
          <div>
            <span>{customer.address}</span>
            {customer.landmark ? (
              <span className="block text-slate-500 font-semibold mt-0.5">
                Landmark: {customer.landmark}
              </span>
            ) : null}
          </div>
        </div>

        {customer.note || car.specialInstructions ? (
          <div className="mt-2.5 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs font-semibold text-amber-900">
            ⚠️ Note: {customer.note ?? car.specialInstructions}
          </div>
        ) : null}

        <a
          href={mapsHref}
          target="_blank"
          rel="noreferrer"
          className="mt-3.5 flex items-center justify-center gap-1.5 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-center text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors shadow-2xs"
        >
          <span>🧭</span>
          <span>Open in Google Maps</span>
        </a>
      </div>

      <WashFlow
        visitId={visit.id}
        services={parsedPackageServices.map((s) => s.name)}
        packageName={pkg?.name ?? 'Standard Package'}
        totalPackageWashes={totalPackageWashes}
        totalDoneThisCycle={totalDoneThisCycle}
        totalDoneLastCycle={totalDoneLastCycle}
        currentCycleLabel={cycleLabel(activeCycle)}
        lastCycleLabel={cycleLabel(lastCycle)}
        serviceStats={serviceStats}
        pastHistory={pastHistory}
        initialBefore={resolvePublicPhotoUrl(visit.beforePhotoUrl)}
        initialAfter={resolvePublicPhotoUrl(visit.afterPhotoUrl)}
        requireBothPhotos={settings.requireBothPhotos}
        nextSlotDate={nextSlotAfter(car, visit.scheduledDate)}
        startedAt={visit.startedAt}
      />
    </div>
  );
}
