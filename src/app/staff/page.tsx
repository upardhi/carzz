import {
  IconCalendar,
  IconCar,
  IconRupee,
  IconWallet,
} from '@/components/shell/icons';
import { StaffWashQueue, type WashQueueItem } from '@/components/staff/StaffWashQueue';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { computeDailyVisitsEarnings, computePayout } from '@/lib/services/payroll';
import { visitsForDate } from '@/lib/services/schedule';
import {
  currentCycle,
  money,
  todayISO,
} from '@/lib/util/format';
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';

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

  const queueItems: WashQueueItem[] = visits.map((visit) => {
    const customer = customerById.get(visit.customerId);
    const car = carById.get(visit.carId);
    return {
      id: visit.id,
      customerId: visit.customerId,
      carId: visit.carId,
      customerName: customer?.name || 'Customer',
      customerAddress: customer?.address || '',
      customerLandmark: customer?.landmark || null,
      customerNote: customer?.note || null,
      carPlate: car?.plate || '—',
      carMake: car?.make || '',
      carModel: car?.model || '',
      scheduledDate: visit.scheduledDate,
      scheduledTime: visit.scheduledTime,
      isCarriedOver: visit.scheduledDate < today,
      status: visit.status,
      startedAt: visit.startedAt,
      completedAt: visit.completedAt,
      beforePhotoUrl: resolvePublicPhotoUrl(visit.beforePhotoUrl),
      afterPhotoUrl: resolvePublicPhotoUrl(visit.afterPhotoUrl),
      plannedService: visit.plannedService,
      servicesDone: visit.servicesDone || [],
      missReason: visit.missReason,
      missNote: visit.missNote,
    };
  });

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
                Assigned wash queue in your area with live cleaning timer and quick finish.
              </p>
            </div>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200/60">
            {visits.length} {visits.length === 1 ? 'car' : 'cars'} assigned
          </span>
        </div>

        <StaffWashQueue initialVisits={queueItems} />
      </div>
    </div>
  );
}

