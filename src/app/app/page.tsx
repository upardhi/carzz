import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  IconCalendar,
  IconCar,
  IconCreditCard,
  IconDroplet,
  IconWallet,
  IconClock,
  IconHelp,
} from '@/components/shell/icons';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { loadCustomerAccount } from '@/lib/services/accounts';
import { WashActionControls } from './WashActionControls';
import { CustomerSpecialRequestsModal } from './CustomerSpecialRequestsModal';
import { WashRatingAction } from './WashRatingAction';
import {
  currentCycle,
  formatDate,
  formatDateFull,
  formatTime,
  money,
  relativeDays,
} from '@/lib/util/format';

export const metadata = { title: 'Customer Dashboard' };

export default async function CustomerHome() {
  const session = await requirePermission('self:cars');
  const store = await getStore();
  const [account, packages] = await Promise.all([
    loadCustomerAccount(
      store,
      session.user.customerId!,
      currentCycle(),
    ),
    store.packages.find({ where: { active: true } }),
  ]);
  if (!account) notFound();

  const staff = account.nextVisit?.staffId
    ? await store.staff.get(account.nextVisit.staffId)
    : null;
  const nextCar = account.nextVisit
    ? account.cars.find((c) => c.id === account.nextVisit!.carId)
    : account.cars[0] ?? null;

  const washesLeft = account.cars.reduce((sum, c) => sum + c.tally.remaining, 0);
  const washesTotal = account.cars.reduce(
    (sum, c) => sum + (c.package?.washesPerMonth ?? (c.tally.done + c.tally.remaining || 0)),
    0,
  );

  const washPercentage =
    washesTotal > 0
      ? Math.min(100, Math.round(((washesTotal - washesLeft) / washesTotal) * 100))
      : 0;

  // Compile real recent bookings list with exact wash details
  const recentBookings = account.visits.slice(0, 6).map((visit) => {
    const d = new Date(visit.scheduledDate);
    const day = isNaN(d.getTime()) ? '' : String(d.getDate()).padStart(2, '0');
    const yearOrMonth = isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    const car = account.cars.find((c) => c.id === visit.carId);

    let subtitle = car ? `${car.make} ${car.model}` : 'Routine Wash';
    if (visit.missReason) {
      subtitle = `Missed: ${visit.missReason.replace(/_/g, ' ')}`;
    } else if (visit.missNote?.includes('[Free Compensatory Wash]')) {
      subtitle = `${car ? `${car.make} ${car.model} · ` : ''}🎁 Free Compensatory Wash`;
    }

    return {
      id: visit.id,
      carId: visit.carId,
      carLabel: car ? `${car.make} ${car.model}` : 'Vehicle',
      dateLabel: formatDateFull(visit.scheduledDate),
      day,
      yearOrMonth,
      title: formatDateFull(visit.scheduledDate),
      subtitle,
      rating: visit.rating,
      ratingComment: visit.ratingComment,
      isDone: visit.status === 'DONE',
      status:
        visit.status === 'DONE'
          ? 'Done'
          : visit.status === 'MISSED'
          ? visit.rescheduledToVisitId
            ? 'Rescheduled'
            : 'Cancelled'
          : 'Pending',
    };
  });

  const firstName = session.user.name.split(' ')[0] || 'Customer';

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. HERO WELCOME BANNER (Matches Image 1)                                   */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#071329] via-[#0d2247] to-[#123164] p-6 text-white shadow-md border border-navy-800/60 min-h-[136px] flex items-center justify-between">
        {/* Left Welcome Copy */}
        <div className="relative z-10 max-w-lg">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
            Hello, {firstName}! <span>👋</span>
          </h1>
          <p className="mt-1.5 text-xs md:text-sm text-slate-300 font-normal">
            Manage your cars, bookings, wash proofs and payments — all in one place.
          </p>
          <div className="mt-4">
            <CustomerSpecialRequestsModal cars={account.cars} packages={packages} />
          </div>
        </div>

        {/* Center/Right Car Image Blend */}
        <div className="absolute right-0 top-0 bottom-0 w-3/5 pointer-events-none overflow-hidden hidden sm:flex items-center justify-end">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero-car-wash.jpg"
            alt="Car Wash Service"
            className="h-full w-full object-cover object-left opacity-90 [mask-image:linear-gradient(to_right,transparent,black_45%,black)]"
          />
        </div>

        {/* Right Quote */}
        <div className="relative z-10 hidden lg:flex flex-col items-end justify-center text-right shrink-0 pr-2">
          <p className="font-serif italic text-xs md:text-sm text-slate-200 tracking-wide">
            &ldquo;A cleaner car for a brighter you.&rdquo;
          </p>
          <div className="mt-2 h-0.5 w-16 rounded-full bg-blue-400 shadow-sm" />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TOP 3 STAT CARDS (Matches Image Exactly)                               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
        {/* Card 1: NEXT WASH */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-start gap-3.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#e0f2fe] text-[#0284c7]">
                <IconCalendar width={26} height={26} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  NEXT WASH
                </h2>
                <div className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
                  {account.nextVisit
                    ? formatDateFull(account.nextVisit.scheduledDate)
                    : account.cars.length === 0
                    ? 'No Cars Added'
                    : account.cars.some((c) => !c.serviceStarted)
                    ? 'Service Not Started'
                    : 'No Upcoming Wash'}
                </div>
              </div>
            </div>

            {account.nextVisit ? (
              <div className="mt-3">
                <div className="text-[15px] font-bold text-slate-900">
                  {formatTime(account.nextVisit.scheduledTime)}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <span>
                    {nextCar?.model || 'Vehicle'} · {nextCar?.plate || '—'}
                    {staff ? ` · ${staff.name.split(' ')[0]}` : ''} ·
                  </span>
                  <span className="inline-flex items-center rounded-full bg-[#dbeafe] px-2.5 py-0.5 text-[11px] font-semibold text-[#2563eb]">
                    {relativeDays(account.nextVisit.scheduledDate)}
                  </span>
                  {account.nextVisit.missNote?.includes('[Free Compensatory Wash]') && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10.5px] font-bold text-emerald-800">
                      🎁 Free Compensatory Wash
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-3 text-xs text-slate-500">
                {account.cars.length === 0
                  ? 'Add your vehicle to start scheduling regular car washes.'
                  : account.cars.some((c) => !c.serviceStarted)
                  ? 'Your vehicle is registered. Washes will be scheduled once subscription is started by manager.'
                  : 'No remaining pending washes scheduled for this billing cycle.'}
              </div>
            )}
          </div>

          <div className="mt-4">
            {account.nextVisit ? (
              <WashActionControls
                visitId={account.nextVisit.id}
                scheduledDate={formatDateFull(account.nextVisit.scheduledDate)}
                scheduledTime={formatTime(account.nextVisit.scheduledTime)}
                carModel={nextCar?.model || 'Vehicle'}
                carPlate={nextCar?.plate || ''}
                isHold={account.customer.status === 'HOLD'}
                holdUntil={account.customer.holdUntil ? formatDate(account.customer.holdUntil) : null}
                totalCars={account.cars.length}
              />
            ) : (
              <Link
                href="/app/cars"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 py-2 px-3 text-xs font-bold text-slate-700 shadow-2xs transition-colors"
              >
                <span>{account.cars.length === 0 ? '+ Add Vehicle' : 'Manage Vehicles'}</span>
                <span>→</span>
              </Link>
            )}
          </div>
        </div>

        {/* Card 2: WASHES LEFT */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-start gap-3.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#dcfce7] text-[#10b981]">
                <IconDroplet width={26} height={26} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  WASHES LEFT
                </h2>
                <div className="text-3xl font-extrabold tracking-tight text-slate-900 mt-0.5">
                  {washesLeft}
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-slate-500 font-medium">
              across <strong className="text-slate-900 font-bold">{account.cars.length}</strong>{' '}
              {account.cars.length === 1 ? 'car' : 'cars'}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="flex-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#00c975] transition-all duration-500"
                style={{ width: `${washPercentage}%` }}
              />
            </div>
            <span className="text-xs text-slate-400 font-medium">{washPercentage}%</span>
          </div>
        </div>

        {/* Card 3: BALANCE */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-start gap-3.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f3e8ff] text-[#9333ea]">
                <IconWallet width={26} height={26} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  BALANCE
                </h2>
                <div className="text-3xl font-extrabold tracking-tight text-slate-900 mt-0.5">
                  {money(Math.abs(account.balance ?? 0))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-400 font-medium">
            {(account.balance ?? 0) >= 0 ? 'advance balance' : 'payment due'}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. YOUR CARS (2-COLUMN GRID) (Matches Image 1)                            */}
      {/* ========================================================================= */}
      <section aria-labelledby="your-cars-heading">
        <div className="flex items-center justify-between mb-3.5">
          <h2 id="your-cars-heading" className="text-base font-bold tracking-tight text-slate-900">
            Your Cars
          </h2>
          <Link
            href="/app/cars"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
          >
            View all cars <span>→</span>
          </Link>
        </div>

        {account.cars.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
            No cars registered yet.{' '}
            <Link href="/app/cars" className="font-bold text-blue-600 hover:underline">
              Add your first vehicle
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {account.cars.map((car) => {
              const isAltroz =
                car.model?.toLowerCase().includes('altroz') ||
                car.make?.toLowerCase().includes('tata');
              const carImgSrc = isAltroz ? '/cars/altroz.jpg' : '/cars/ertiga.jpg';
              const packageTotal = car.package?.washesPerMonth ?? 0;

              return (
                <Link key={car.id} href={`/app/cars/${car.id}`} className="block group">
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-all group-hover:border-blue-300 group-hover:shadow-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-100/80 overflow-hidden p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={carImgSrc}
                          alt={`${car.make} ${car.model}`}
                          className="h-full w-full object-contain mix-blend-multiply"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {car.make} {car.model}
                        </div>
                        <div className="text-[11px] font-mono uppercase text-slate-400 font-medium mt-0.5">
                          {car.plate}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!car.serviceStarted ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                          Pending Start
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                          {car.tally.done} of {packageTotal || (car.tally.done + car.tally.remaining)}
                        </span>
                      )}
                      <span className="text-slate-400 font-bold text-base">›</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 4. BOTTOM 2-COLUMN GRID: Recent Bookings + Quick Actions (Matches Image 1)*/}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 pt-1">
        {/* Left Column: Recent Bookings */}
        <section aria-labelledby="bookings-heading">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <IconClock width={14} height={14} />
              </div>
              <h3 id="bookings-heading" className="text-sm font-bold text-slate-900">
                Recent Bookings
              </h3>
            </div>
            <Link
              href="/app/cars"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              View all →
            </Link>
          </div>

          {recentBookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
              No wash history yet. Your completed and scheduled washes will appear here.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs divide-y divide-slate-100">
              {recentBookings.map((b) => (
                <div key={b.id} className="py-2.5 px-1.5 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex min-w-[3.5rem] shrink-0 flex-col items-center justify-center rounded-xl bg-sky-50 border border-sky-100/80 px-1 py-1.5 text-sky-900">
                        <span className="text-xs font-bold leading-tight">{b.day}</span>
                        <span className="text-[9px] font-bold text-sky-600 uppercase leading-tight text-center whitespace-nowrap">
                          {b.yearOrMonth}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{b.title}</span>
                          {b.carId && (
                            <Link
                              href={`/app/cars/${b.carId}`}
                              className="text-[11px] font-normal text-blue-600 hover:underline"
                            >
                              (View Car History →)
                            </Link>
                          )}
                        </div>
                        <div className="truncate text-[11px] text-slate-500 font-medium mt-0.5">
                          {b.subtitle}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                          b.status === 'Cancelled'
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : b.status === 'Rescheduled'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : b.status === 'Pending'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {b.status}
                      </span>
                      {(b.isDone || b.status === 'Cancelled' || b.status === 'Rescheduled') && (
                        <WashRatingAction
                          visitId={b.id}
                          carId={b.carId}
                          carLabel={b.carLabel}
                          dateLabel={b.dateLabel}
                          rating={b.rating}
                          ratingComment={b.ratingComment}
                          isMissed={!b.isDone}
                          variant="compact"
                        />
                      )}
                    </div>
                  </div>
                  {b.ratingComment && (
                    <p className="text-[11px] italic text-slate-500 pl-14">
                      Review: &ldquo;{b.ratingComment}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Quick Actions (2x2 Grid) */}
        <section aria-labelledby="quick-actions-heading">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              ⚡
            </div>
            <h3 id="quick-actions-heading" className="text-sm font-bold text-slate-900">
              Quick Actions
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Action 1: Book a Wash */}
            <Link
              href="/app/cars"
              className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-all hover:border-blue-300 hover:shadow-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <IconCalendar width={18} height={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    Book a Wash
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                    Schedule a new wash
                  </div>
                </div>
              </div>
              <span className="text-slate-400 font-bold text-base shrink-0">›</span>
            </Link>

            {/* Action 2: Manage Cars */}
            <Link
              href="/app/cars"
              className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-all hover:border-blue-300 hover:shadow-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <IconCar width={18} height={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    Manage Cars
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                    Add or update your cars
                  </div>
                </div>
              </div>
              <span className="text-slate-400 font-bold text-base shrink-0">›</span>
            </Link>

            {/* Action 3: View Payments */}
            <Link
              href="/app/payments"
              className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-all hover:border-blue-300 hover:shadow-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <IconCreditCard width={18} height={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    View Payments
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                    Check transactions
                  </div>
                </div>
              </div>
              <span className="text-slate-400 font-bold text-base shrink-0">›</span>
            </Link>

            {/* Action 4: Help & Support */}
            <Link
              href="/app/help"
              className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-all hover:border-blue-300 hover:shadow-xs flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <IconHelp width={18} height={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    Help & Support
                  </div>
                  <div className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                    Get assistance
                  </div>
                </div>
              </div>
              <span className="text-slate-400 font-bold text-base shrink-0">›</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
