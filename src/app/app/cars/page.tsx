import { notFound } from 'next/navigation';
import { VehicleCard } from '@/components/ui/VehicleCard';
import { IconCar, IconInfo } from '@/components/shell/icons';
import { AddCarModal } from './AddCarModal';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { loadCustomerAccount } from '@/lib/services/accounts';
import { currentCycle, formatDateFull, formatTime, todayISO } from '@/lib/util/format';

export const metadata = { title: 'My Cars' };

export default async function CustomerCars() {
  const session = await requirePermission('self:cars');
  const store = await getStore();
  const firstName = session.user.name.split(' ')[0] || 'Customer';

  const [account, packages] = await Promise.all([
    loadCustomerAccount(
      store,
      session.user.customerId!,
      currentCycle(),
    ),
    store.packages.find({ where: { active: true } }),
  ]);
  if (!account) notFound();

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
              Manage your registered vehicles, active wash packages and schedules.
            </p>
          </div>

          <div className="hidden md:flex flex-col items-end justify-center text-right shrink-0">
            <p className="font-serif italic text-xs md:text-sm text-slate-300 tracking-wide">
              &ldquo;A cleaner car for a brighter you.&rdquo;
            </p>
            <div className="mt-1.5 h-1 w-12 rounded-full bg-blue-500 shadow-sm" />
          </div>
        </div>

        <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/4 h-32 w-32 rounded-full bg-cyan-400/10 blur-2xl" />
      </div>

      {/* 2. Registered Cars Section */}
      <div className="space-y-4">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
              <IconCar width={20} height={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Your Registered Vehicles</h3>
              <p className="text-xs text-slate-500 mt-0.5">Track monthly wash quota and schedule per vehicle</p>
            </div>
          </div>

          <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 border border-slate-200/60">
            {account.cars.length} {account.cars.length === 1 ? 'vehicle' : 'vehicles'}
          </span>
        </div>

        <div className="space-y-3.5">
          {account.cars.map((car) => {
            const isErtiga =
              car.model?.toLowerCase().includes('ertiga') ||
              car.make?.toLowerCase().includes('maruti');
            const isAltroz =
              car.model?.toLowerCase().includes('altroz') ||
              car.make?.toLowerCase().includes('tata');
            const carImage = isErtiga
              ? '/cars/ertiga.jpg'
              : isAltroz
                ? '/cars/altroz.jpg'
                : undefined;

            const inProgressVisit = account.visits.find(
              (v) => v.carId === car.id && v.status === 'IN_PROGRESS',
            );

            const nextCarVisit = car.serviceStarted
              ? account.visits.find(
                  (v) =>
                    v.carId === car.id &&
                    v.status === 'PENDING' &&
                    v.scheduledDate >= todayISO(),
                )
              : null;

            const nextWashText = inProgressVisit
              ? 'Wash in progress now'
              : nextCarVisit
              ? `${formatDateFull(nextCarVisit.scheduledDate)}, ${formatTime(car.scheduleTime)}`
              : !car.serviceStarted
              ? 'Service pending start'
              : 'No upcoming scheduled wash';

            const doneCount = car.tally.done;
            const totalCount = car.package?.washesPerMonth ?? (doneCount > 0 ? doneCount : 0);

            return (
              <VehicleCard
                key={car.id}
                name={`${car.make} ${car.model}`.trim() || car.plate}
                plate={car.plate}
                package={car.package?.name}
                colour={car.colour || undefined}
                doneWashes={doneCount}
                totalWashes={totalCount}
                nextWash={nextWashText}
                active={car.active}
                inProgress={Boolean(inProgressVisit)}
                inProgressStartedAt={inProgressVisit?.startedAt}
                imageSrc={carImage}
                historyHref={`/app/cars/${car.id}`}
              />
            );
          })}
        </div>

        {/* Shared Account Note */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-xs font-medium text-blue-900 flex items-start gap-2.5 shadow-2xs">
          <IconInfo width={18} height={18} className="shrink-0 text-blue-600 mt-0.5" />
          <div>
            <b>Shared account info:</b> All vehicles share one payment ledger. Each car maintains its own independent wash count, photos and daily schedule.
          </div>
        </div>

        {/* Add another car modal */}
        <AddCarModal
          packages={packages.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            washesPerMonth: p.washesPerMonth,
            billingPeriod: p.billingPeriod,
            washesPerPeriod: p.washesPerPeriod,
          }))}
        />
      </div>
    </div>
  );
}
