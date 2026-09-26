import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { parsePackageServices, type PackageServiceItem } from '@/lib/data/types';
import { nextSlotAfter } from '@/lib/services/schedule';
import { currentCycle, cycleLabel, previousCycle } from '@/lib/util/format';
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';
import { washDurationMinutes, washSpeedFlag } from '@/lib/util/washTiming';
import { WashFlow } from './WashFlow';

export const metadata = { title: 'Wash Service' };

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

  // Query database for all visits for this car to establish full history
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
    <div className="max-w-4xl mx-auto space-y-5 pb-12 antialiased">
      {/* Back Link */}
      <div className="flex items-center justify-between px-1">
        <Link
          href="/staff"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <span>←</span>
          <span>Back to Today&apos;s Schedule</span>
        </Link>
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
          🚗 {visit.startedAt ? 'Wash In Progress' : 'Ready to Start'}
        </span>
      </div>

      {/* 1. Vehicle & Customer Summary Header Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-black tracking-wide bg-slate-900 text-white px-2.5 py-0.5 rounded-lg">
                {car.plate}
              </span>
              <span className="text-xs font-bold text-slate-700">
                {car.make} {car.model} {car.colour ? `· ${car.colour}` : ''}
              </span>
            </div>
            <h1 className="text-lg font-extrabold text-slate-900 mt-2">
              {customer.name}
            </h1>
            {customer.phone && (
              <a
                href={`tel:${customer.phone}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline mt-0.5"
              >
                <span>📞</span>
                <span>+91 {customer.phone}</span>
              </a>
            )}
          </div>

          <div className="text-right shrink-0">
            <span className="text-[11px] font-bold text-slate-500 block">Package Plan</span>
            <span className="text-xs font-extrabold text-blue-700 block mt-0.5">
              {pkg?.name ?? 'Standard'}
            </span>
            <span className="text-[10.5px] font-semibold text-slate-400">
              Wash {totalDoneThisCycle + 1} of {totalPackageWashes}
            </span>
          </div>
        </div>

        {/* Location & Maps */}
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-2 text-xs">
          <div className="flex items-start gap-2 text-slate-700">
            <span className="text-sm shrink-0 mt-0.5">📍</span>
            <div className="min-w-0">
              <p className="font-medium text-slate-800 leading-snug">{customer.address}</p>
              {customer.landmark && (
                <p className="text-slate-500 font-semibold mt-0.5">
                  Landmark: {customer.landmark}
                </p>
              )}
            </div>
          </div>

          <a
            href={mapsHref}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-white border border-slate-200 py-2 text-center text-xs font-bold text-slate-800 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-2xs cursor-pointer"
          >
            <span>🧭</span>
            <span>Open Location in Google Maps</span>
          </a>
        </div>

        {/* Last Completed Wash Summary */}
        {pastHistory.find((v) => v.status === 'DONE') ? (
          (() => {
            const lastWash = pastHistory.find((v) => v.status === 'DONE')!;
            return (
              <div className="rounded-xl bg-blue-50/70 border border-blue-200/70 p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-bold text-blue-950">
                  <span className="flex items-center gap-1.5">
                    <span>⏮️</span>
                    <span>Last Wash: {lastWash.date}</span>
                  </span>
                  <span className="text-[11px] text-blue-700 font-semibold bg-white px-2 py-0.5 rounded-md border border-blue-200">
                    Previous Service History
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[11px] font-semibold text-slate-600">Services done last time:</span>
                  {Array.isArray(lastWash.servicesDone) && lastWash.servicesDone.length > 0 ? (
                    lastWash.servicesDone.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center gap-0.5 rounded-md bg-white border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-blue-900"
                      >
                        ✓ {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] font-medium text-slate-500">Standard exterior cleaning</span>
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-2.5 text-xs text-slate-600">
            ✨ First wash for this vehicle in this cycle. Full package services recommended!
          </div>
        )}

        {/* Special Instructions or Customer Note */}
        {(customer.note || car.specialInstructions) && (
          <div className="rounded-xl bg-amber-50 border border-amber-200/80 p-3 text-xs font-semibold text-amber-900 flex items-start gap-2">
            <span className="text-base shrink-0">⚠️</span>
            <div>
              <span className="font-bold text-amber-950">Instructions / Note: </span>
              <span>{customer.note || car.specialInstructions}</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Interactive Guided Wash Workflow */}
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
