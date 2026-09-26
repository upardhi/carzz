import { notFound } from 'next/navigation';
import Link from 'next/link';
import { IconCamera } from '@/components/shell/icons';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { loadCustomerAccount } from '@/lib/services/accounts';
import { parsePackageServices } from '@/lib/data/types';
import {
  currentCycle,
  cycleLabel,
  formatDateFull,
  formatClock,
  formatTime,
} from '@/lib/util/format';
import { MISS_REASON_LABEL } from '@/lib/util/labels';
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';
import { WashRatingAction } from '../../WashRatingAction';
import { WashProgressTimer } from '@/components/ui/WashProgressTimer';

export const metadata = { title: 'Wash history' };

export default async function CarDetail({
  params,
}: {
  params: Promise<{ carId: string }>;
}) {
  const { carId } = await params;
  const session = await requirePermission('self:cars');
  const store = await getStore();

  const activeCycle = currentCycle();
  const account = await loadCustomerAccount(
    store,
    session.user.customerId!,
    activeCycle,
  );
  // Reading the car through the account, not by id, is what stops a customer
  // opening someone else's car by editing the URL.
  const car = account?.cars.find((c) => c.id === carId);
  if (!account || !car) notFound();

  const inProgressVisit = account.visits.find(
    (v) => v.carId === carId && v.status === 'IN_PROGRESS',
  );

  const settings = await store.getAppSettings();
  const history = account.visits
    .filter((v) => v.carId === carId && v.status !== 'PENDING')
    .slice(0, 20);

  const staffIds = [...new Set(history.map((v) => v.staffId).filter(Boolean))] as string[];
  const staffList = staffIds.length
    ? await store.staff.find({ where: { id: { in: staffIds } } as never })
    : [];
  const staff = new Map(staffList.map((s) => [s.id, s]));

  // Parse package sub-services and compute progress
  const parsedPackageServices = parsePackageServices(
    car.package?.services,
    car.package?.washesPerMonth ?? 8,
  );

  const completedCarVisitsThisCycle = account.visits.filter(
    (v) => v.carId === carId && v.cycle === activeCycle && v.status === 'DONE',
  );

  const serviceStats = parsedPackageServices.map((s) => {
    const timesDone = completedCarVisitsThisCycle.filter(
      (v) =>
        Array.isArray(v.servicesDone) &&
        v.servicesDone.some(
          (doneName) =>
            doneName.trim().toLowerCase() === s.name.trim().toLowerCase() ||
            doneName.trim().toLowerCase().includes(s.name.trim().toLowerCase()),
        ),
    ).length;

    const quota = s.washesPerMonth;
    const remaining = Math.max(0, quota - timesDone);
    const isCompleted = timesDone >= quota;
    const percent = Math.min(100, Math.round((timesDone / (quota || 1)) * 100));

    return {
      name: s.name,
      quota,
      timesDone,
      remaining,
      isCompleted,
      percent,
    };
  });

  return (
    <div className="space-y-4">
      {/* 1. Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#071329] via-[#0d2247] to-[#123164] p-5 md:p-6 text-white shadow-sm">
        <div className="relative z-10">
          <Link
            href="/app/cars"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-200 hover:text-white transition-colors mb-2"
          >
            ← Back to all cars
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              {car.make} {car.model}
            </h1>
            {inProgressVisit && (
              <WashProgressTimer
                startedAt={inProgressVisit.startedAt}
                variant="badge"
                label="Wash In Progress"
                className="bg-blue-500/20 text-blue-200 border-blue-400/40"
              />
            )}
          </div>
          <p className="mt-1 text-xs md:text-sm text-slate-300 font-medium">
            {car.colour} · <span className="font-mono">{car.plate}</span>
          </p>
        </div>
        <div className="absolute right-[-20px] bottom-[-20px] h-32 w-32 rounded-full bg-blue-500/10 pointer-events-none" />
      </div>

      {/* 1.1 Live Wash In Progress Hero Alert (When wash is actively running) */}
      {inProgressVisit && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-blue-400 bg-gradient-to-r from-[#0a234f] via-[#0c2f6d] to-[#113a7c] p-5 text-white shadow-md animate-in fade-in duration-300">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-300" />
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-300">
                  Live Cleaning In Progress
                </span>
              </div>
              <h2 className="text-lg font-bold text-white">
                Vehicle is being washed right now
              </h2>
              <p className="text-xs text-blue-200">
                Started at <span className="font-semibold text-white">{formatClock(inProgressVisit.startedAt)}</span>
                {inProgressVisit.staffId && (
                  <>
                    {' '}· Cleaner:{' '}
                    <span className="font-semibold text-white">
                      {staff.get(inProgressVisit.staffId)?.name ?? 'Assigned Cleaner'}
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <WashProgressTimer
                startedAt={inProgressVisit.startedAt}
                variant="card"
                className="bg-white/10 border-white/20 text-white backdrop-blur-sm"
              />
            </div>
          </div>

          <div className="mt-3.5 pt-3 border-t border-white/15 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-blue-200 font-medium">Service being performed:</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-white/20 px-2 py-0.5 font-bold text-white">
              🚿 {inProgressVisit.plannedService || 'Scheduled Package Wash'}
            </span>
            {inProgressVisit.beforePhotoUrl && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/25 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 font-semibold text-[11px]">
                ✓ Before photo recorded
              </span>
            )}
          </div>
        </div>
      )}

      {/* 2. Top Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 font-bold text-sm">
              ✓
            </div>
            <span className="text-[11.5px] font-bold uppercase tracking-wider text-slate-500">
              Done
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {car.tally.done}
          </div>
          <div className="text-[11.5px] font-medium text-slate-400 mt-0.5">
            washes this month
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold text-sm">
              ⏳
            </div>
            <span className="text-[11.5px] font-bold uppercase tracking-wider text-slate-500">
              Remaining
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {car.tally.remaining}
          </div>
          <div className="text-[11.5px] font-medium text-slate-400 mt-0.5">
            scheduled to come
          </div>
        </div>
      </div>

      {/* 3. Included Package Services & Progress */}
      {serviceStats.length > 0 && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Included Package Services ({car.package?.name ?? 'Plan'})
            </h3>
            <span className="text-xs font-semibold text-slate-500">
              {cycleLabel(activeCycle)}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {serviceStats.map((svc) => (
              <div
                key={svc.name}
                className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2.5 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm text-slate-900 leading-snug">
                    {svc.name}
                  </div>
                  {svc.isCompleted ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/80 border border-emerald-200 px-2 py-0.5 text-[10.5px] font-bold text-emerald-800 shrink-0">
                      ✓ Completed ({svc.timesDone}/{svc.quota})
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10.5px] font-bold text-blue-700 shrink-0">
                      {svc.timesDone} of {svc.quota} done
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        svc.isCompleted ? 'bg-emerald-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${svc.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-medium text-slate-500">
                    <span>
                      {svc.timesDone} completed this month
                    </span>
                    <span className={svc.remaining > 0 ? 'text-blue-600 font-semibold' : 'text-slate-400'}>
                      {svc.remaining > 0 ? `${svc.remaining} left` : 'Quota met'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Package & Schedule Info */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Subscription Package & Timing
        </h3>
        <div className="divide-y divide-slate-100 text-[13px]">
          <div className="flex items-center justify-between py-2">
            <span className="text-slate-500 font-medium">Package Plan</span>
            <span className="font-semibold text-slate-900">{car.package?.name ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-slate-500 font-medium">Monthly Quota</span>
            <span className="font-semibold text-slate-900">{car.package?.washesPerMonth ?? 0} washes</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-slate-500 font-medium">Time Slot</span>
            <span className="font-semibold text-slate-900">{formatTime(car.scheduleTime)}</span>
          </div>
          {car.specialInstructions ? (
            <div className="flex flex-col gap-1 py-2">
              <span className="text-slate-500 font-medium">Cleaner Instructions</span>
              <span className="font-semibold text-slate-900 bg-slate-50 p-2 rounded-lg border border-slate-100">
                {car.specialInstructions}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* 5. Wash History Feed */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Wash History
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            Recent {history.length} washes
          </span>
        </div>

        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-medium text-slate-500">
            No washes recorded yet for this vehicle.
          </div>
        ) : null}

        {history.map((visit) => {
          if (visit.status === 'IN_PROGRESS') {
            const beforeResolved = resolvePublicPhotoUrl(visit.beforePhotoUrl) || visit.beforePhotoUrl;
            const cleanerName = visit.staffId ? staff.get(visit.staffId)?.name : null;

            return (
              <div
                key={visit.id}
                className="rounded-2xl border-2 border-blue-400 bg-gradient-to-b from-blue-50/90 via-sky-50/40 to-white p-4 shadow-xs space-y-3 relative overflow-hidden animate-in fade-in duration-200"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {formatDateFull(visit.scheduledDate)}
                      </span>
                      <span className="text-xs text-blue-400">·</span>
                      <span className="text-xs font-semibold text-blue-700">
                        Started {formatClock(visit.startedAt)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-100/80 border border-blue-200 px-2 py-0.5 text-[11px] font-semibold text-blue-900">
                        🚿 {visit.plannedService || 'Package Wash'}
                      </span>
                      {cleanerName ? (
                        <span className="text-[11px] font-medium text-slate-600">
                          by {cleanerName.split(' ')[0]}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Live Timer & Status in History Header */}
                  <WashProgressTimer
                    startedAt={visit.startedAt}
                    variant="history-header"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Before Photo */}
                  <div className="relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden rounded-xl border border-blue-200 bg-slate-50 text-xs font-semibold text-slate-600 shadow-2xs">
                    {beforeResolved ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={beforeResolved}
                          alt="Before wash photo"
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute inset-x-0 bottom-0 bg-slate-900/80 py-1 text-center text-[10.5px] font-semibold text-white backdrop-blur-xs flex items-center justify-center gap-1">
                          <span className="text-emerald-400">✓</span> Before Photo
                        </span>
                      </>
                    ) : (
                      <>
                        <IconCamera width={22} height={22} className="text-slate-400" />
                        <span className="mt-1 text-slate-500">Before Photo</span>
                        <span className="text-[10px] font-normal text-slate-400">recording...</span>
                      </>
                    )}
                  </div>

                  {/* After Photo Pending */}
                  <div className="relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/40 text-xs font-semibold text-blue-900 p-3 text-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 mb-1 animate-pulse">
                      🚿
                    </div>
                    <span className="font-bold text-[11px] text-blue-950">After Photo Pending</span>
                    <span className="text-[10px] font-normal text-slate-500 mt-0.5">
                      Uploads when wash finishes
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-blue-50/80 border border-blue-200/70 px-3 py-2 text-xs text-blue-900 font-medium flex items-center gap-2">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
                  </span>
                  <span>Vehicle is currently being cleaned. Live duration timer is updating.</span>
                </div>
              </div>
            );
          }

          if (visit.status === 'DONE') {
            return (
              <div key={visit.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {formatDateFull(visit.scheduledDate)} ·{' '}
                    <span className="font-medium text-slate-600">{formatClock(visit.completedAt)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {Array.isArray(visit.servicesDone) && visit.servicesDone.length > 0 ? (
                      visit.servicesDone.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-50/80 border border-blue-200/80 px-2 py-0.5 text-[11px] font-semibold text-blue-800"
                        >
                          ✓ {s}
                        </span>
                      ))
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        Standard Wash
                      </span>
                    )}
                    {visit.staffId ? (
                      <span className="text-[11px] font-medium text-slate-400">
                        by {staff.get(visit.staffId)?.name.split(' ')[0] ?? 'Cleaner'}
                      </span>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 whitespace-nowrap inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 shadow-2xs">
                  ✓ Done
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['Before', visit.beforePhotoUrl],
                    ['After', visit.afterPhotoUrl],
                  ] as const
                ).map(([label, url]) => {
                  const resolved = resolvePublicPhotoUrl(url) || url;
                  return (
                    <div
                      key={label}
                      className="relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 shadow-2xs"
                    >
                      {resolved ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={resolved}
                            alt={`${label} wash photo`}
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute inset-x-0 bottom-0 bg-slate-900/80 py-1 text-center text-[10.5px] font-semibold text-white backdrop-blur-xs">
                            {label} Photo
                          </span>
                        </>
                      ) : (
                        <>
                          <IconCamera width={22} height={22} className="text-slate-400" />
                          <span className="mt-1 text-slate-500">{label}</span>
                          <span className="text-[10px] font-normal text-slate-400">not stored</span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100">
                <WashRatingAction
                  visitId={visit.id}
                  carId={car.id}
                  carLabel={`${car.make} ${car.model}`}
                  dateLabel={formatDateFull(visit.scheduledDate)}
                  staffName={staff.get(visit.staffId || '')?.name}
                  rating={visit.rating}
                  ratingComment={visit.ratingComment}
                  completedAt={visit.completedAt}
                  scheduledDate={visit.scheduledDate}
                />
              </div>
            </div>
          );
        }

        return (
          <div key={visit.id} className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-amber-950">
                  {formatDateFull(visit.scheduledDate)}
                </div>
                <div className="text-xs font-medium text-amber-700 mt-0.5">
                  Reason:{' '}
                  {visit.missReason
                    ? MISS_REASON_LABEL[visit.missReason]
                    : 'Not recorded'}
                </div>
              </div>
              <span className="inline-flex items-center rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                Not done
              </span>
            </div>
            {visit.rescheduledToVisitId ? (
              <div className="text-xs font-medium text-amber-900 bg-amber-100/60 p-2.5 rounded-xl border border-amber-200">
                This wash was <b>skipped and moved to your next scheduled date</b>. You have not lost any paid washes.
              </div>
            ) : null}
            <div className="pt-2 border-t border-amber-200/60">
              <WashRatingAction
                visitId={visit.id}
                carId={car.id}
                carLabel={`${car.make} ${car.model}`}
                dateLabel={formatDateFull(visit.scheduledDate)}
                staffName={staff.get(visit.staffId || '')?.name}
                isMissed={true}
                completedAt={visit.completedAt}
                scheduledDate={visit.scheduledDate}
              />
            </div>
          </div>
        );
      })}

        <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-center text-xs font-medium text-slate-500">
          Wash photos are kept securely for {settings.photoRetentionMonths}{' '}
          {settings.photoRetentionMonths === 1 ? 'month' : 'months'}, then archived.
        </div>
      </div>
    </div>
  );
}
