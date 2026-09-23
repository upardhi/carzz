import Link from 'next/link';
import {
  IconCalendar,
  IconCar,
  IconCheck,
  IconChevron,
  IconMap,
  IconRupee,
  IconWallet,
} from '@/components/shell/icons';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { computeDailyVisitsEarnings, computePayout } from '@/lib/services/payroll';
import { visitsForDate } from '@/lib/services/schedule';
import {
  currentCycle,
  formatClock,
  formatTime,
  money,
  todayISO,
} from '@/lib/util/format';
import { MISS_REASON_LABEL } from '@/lib/util/labels';

export const metadata = { title: 'Today' };

export default async function StaffToday() {
  const session = await requirePermission('self:jobs');
  const store = await getStore();
  const staffId = session.user.staffId!;
  const today = todayISO();
  const firstName = session.user.name.split(' ')[0] || 'Staff';

  const visits = await visitsForDate(store, today, { staffId });

  const customerIds = [...new Set(visits.map((v) => v.customerId))];
  const carIds = [...new Set(visits.map((v) => v.carId))];
  const [customers, cars, rules] = await Promise.all([
    customerIds.length
      ? store.customers.find({ where: { id: { in: customerIds } } as never })
      : [],
    carIds.length
      ? store.cars.find({ where: { id: { in: carIds } } as never })
      : [],
    store.getPayoutSettings(),
  ]);
  const payout = await computePayout(store, staffId, currentCycle(), rules);

  const customerById = new Map(customers.map((c) => [c.id, c]));
  const carById = new Map(cars.map((c) => [c.id, c]));

  const done = visits.filter((v) => v.status === 'DONE').length;
  const pending = visits.filter(
    (v) => v.status === 'PENDING' || v.status === 'IN_PROGRESS',
  ).length;

  const earnedToday = computeDailyVisitsEarnings(visits, rules);

  return (
    <div className="space-y-5">
      {/* 1. Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#071329] via-[#0d2247] to-[#123164] p-6 text-white shadow-md border border-navy-800/60">
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl text-white flex items-center gap-2">
              Hello, {firstName}! <span className="animate-wiggle">👋</span>
            </h2>
            <p className="mt-1 text-xs md:text-sm text-slate-300 font-medium max-w-xl">
              Manage your cars, bookings and leaves — all in one place.
            </p>
          </div>

          <div className="hidden md:flex flex-col items-end justify-center text-right shrink-0">
            <p className="font-serif italic text-xs md:text-sm text-slate-300 tracking-wide">
              &ldquo;A cleaner car for a brighter you.&rdquo;
            </p>
            <div className="mt-1.5 h-1 w-12 rounded-full bg-blue-500 shadow-sm" />
          </div>
        </div>

        {/* Subtle decorative background water accents */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/4 h-32 w-32 rounded-full bg-cyan-400/10 blur-2xl" />
      </div>

      {/* 2. Stat Cards (3-column grid) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Cars Today */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100/80 bg-blue-50 text-blue-600">
                <IconCar width={22} height={22} />
              </div>
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                  CARS TODAY
                </div>
                <div className="mt-0.5 text-2xl font-black tracking-tight text-slate-900">
                  {done} <span className="text-sm font-semibold text-slate-400">/ {visits.length}</span>
                </div>
              </div>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
              {pending} pending
            </span>
          </div>

          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.round((done / (visits.length || 1)) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Earned Today */}
        <div className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-100/80 bg-emerald-50 text-emerald-600">
              <IconRupee width={22} height={22} />
            </div>
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                EARNED TODAY
              </div>
              <div className="mt-0.5 text-2xl font-black tracking-tight text-emerald-600">
                {money(earnedToday)}
              </div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">
                Updated per completed car
              </div>
            </div>
          </div>
        </div>

        {/* Month Payout */}
        <div className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:col-span-1">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-purple-100/80 bg-purple-50 text-purple-600">
              <IconWallet width={22} height={22} />
            </div>
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                THIS MONTH NET
              </div>
              <div className="mt-0.5 text-2xl font-black tracking-tight text-purple-700">
                {money(payout.net)}
              </div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">
                {payout.washes} washes completed
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Today's Route List Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
              <IconCalendar width={20} height={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Today&apos;s Route & Schedule</h3>
              <p className="text-xs text-slate-500">
                Assigned wash queue in your area. Tap to open wash camera and checklist.
              </p>
            </div>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200/60">
            {visits.length} {visits.length === 1 ? 'car' : 'cars'} assigned
          </span>
        </div>

        {visits.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <IconCar width={24} height={24} />
            </div>
            <h4 className="mt-3 text-sm font-bold text-slate-900">No cars assigned today</h4>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              Your area manager will assign today&apos;s wash route shortly. Check back in a few minutes.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {visits.map((visit) => {
              const customer = customerById.get(visit.customerId);
              const car = carById.get(visit.carId);

              if (visit.status === 'DONE') {
                return (
                  <div
                    key={visit.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-slate-50/70 p-4 transition-all"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                        <IconCheck width={20} height={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 truncate">
                            {customer?.name}
                          </span>
                          <span className="rounded-md bg-slate-200/80 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                            {car?.plate}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {car?.make} {car?.model} · Scheduled {formatTime(visit.scheduledTime)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-100/80 text-emerald-800 px-3 py-1 text-xs font-bold border border-emerald-200">
                        Done at {formatClock(visit.completedAt)}
                      </span>
                    </div>
                  </div>
                );
              }

              if (visit.status === 'MISSED') {
                return (
                  <div
                    key={visit.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {customer?.name}
                        </span>
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-800">
                          {car?.plate}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-amber-700">
                        {visit.missReason ? MISS_REASON_LABEL[visit.missReason] : 'Skipped / Car Not Available'}
                      </div>
                    </div>

                    <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-bold border border-amber-200">
                      Moved to Next Slot
                    </span>
                  </div>
                );
              }

              return (
                <Link
                  key={visit.id}
                  href={`/staff/wash/${visit.id}`}
                  className="group block rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-blue-400 hover:shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {customer?.name}
                        </span>
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700 border border-blue-100">
                          {car?.plate}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          · {car?.make} {car?.model}
                        </span>
                      </div>

                      <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                        <IconMap width={14} height={14} className="shrink-0 text-slate-400 mt-0.5" />
                        <span className="line-clamp-2">
                          {customer?.address}
                          {customer?.landmark ? ` (${customer.landmark})` : ''}
                        </span>
                      </div>

                      {customer?.note && (
                        <div className="mt-2.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 border border-amber-100 inline-block">
                          Note: {customer.note}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
                      <div className="text-left sm:text-right hidden sm:block">
                        <div className="text-xs font-bold text-slate-900">
                          {formatTime(visit.scheduledTime)}
                        </div>
                        <div className="text-[10.5px] text-slate-400 font-medium">Scheduled</div>
                      </div>

                      <div className="flex items-center justify-center gap-2 w-full sm:w-auto rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs group-hover:bg-blue-700 transition-colors">
                        <span>{visit.status === 'IN_PROGRESS' ? 'Continue wash' : 'Start wash'}</span>
                        <IconChevron width={14} height={14} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
