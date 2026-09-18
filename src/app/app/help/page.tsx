import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { loadCustomerAccount } from '@/lib/services/accounts';
import { currentCycle, formatDateFull } from '@/lib/util/format';
import { ComplaintHistory, type ComplaintItemData } from './ComplaintHistory';
import { ComplaintForm, RateWashForm } from './HelpForms';

export const metadata = { title: 'Help & feedback' };

export default async function CustomerHelp() {
  const session = await requirePermission('self:feedback');
  const store = await getStore();
  const account = await loadCustomerAccount(
    store,
    session.user.customerId!,
    currentCycle(),
  );
  if (!account) notFound();

  const customerName = account.customer.name || session.user.name || 'Customer';
  const customerPhone = account.customer.phone || session.user.phone || '';
  const initials =
    customerName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'C';

  // Sort visits descending to ensure the most recent completed wash is selected
  const doneVisits = account.visits
    .filter((v) => v.status === 'DONE')
    .sort(
      (a, b) =>
        new Date(b.completedAt || b.scheduledDate).getTime() -
        new Date(a.completedAt || a.scheduledDate).getTime(),
    );

  const lastWash = doneVisits[0] ?? null;
  const lastCar = lastWash
    ? account.cars.find((c) => c.id === lastWash.carId) || (await store.cars.get(lastWash.carId))
    : null;
  const staff = lastWash?.staffId ? await store.staff.get(lastWash.staffId) : null;
  const rules = await store.getPayoutSettings();

  const complaints = await store.complaints.find({
    where: { customerId: account.customer.id },
    orderBy: [{ field: 'createdAt', dir: 'desc' }],
    limit: 20,
  });

  const displayComplaints: ComplaintItemData[] =
    complaints.length > 0
      ? await Promise.all(
          complaints.map(async (c) => {
            let carName: string | null = null;
            let carPlate: string | null = null;
            let staffName: string | null = null;

            if (c.visitId) {
              const visit =
                account.visits.find((v) => v.id === c.visitId) ||
                (await store.visits.get(c.visitId));
              if (visit) {
                const car =
                  account.cars.find((car) => car.id === visit.carId) ||
                  (await store.cars.get(visit.carId));
                if (car) {
                  carName = `${car.make} ${car.model}`.trim();
                  carPlate = car.plate;
                }
                if (visit.staffId) {
                  const staffObj = await store.staff.get(visit.staffId);
                  if (staffObj) staffName = staffObj.name;
                }
              }
            }

            if (!staffName && c.staffId) {
              const staffObj = await store.staff.get(c.staffId);
              if (staffObj) staffName = staffObj.name;
            }

            return {
              id: c.id,
              type: c.type,
              body: c.body || '',
              status: c.status,
              resolution: c.resolution || null,
              createdAt: c.createdAt,
              resolvedAt: c.resolvedAt || null,
              carName,
              carPlate,
              staffName,
            };
          }),
        )
      : [];

  const registeredCars = account.cars.map((c) => ({
    id: c.id,
    make: c.make,
    model: c.model,
    plate: c.plate,
  }));

  return (
    <div className="space-y-4">
      {/* 1. Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#071329] via-[#0d2247] to-[#123164] p-5 md:p-6 text-white shadow-sm">
        <div className="relative z-10">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">
            Help & Support, {customerName.split(' ')[0]}! 👋
          </h1>
          <p className="mt-1 text-xs md:text-sm text-slate-300 font-medium">
            Rate your recent washes, raise tickets, and get fast manager resolutions.
          </p>
          <div className="mt-3.5 inline-block">
            <span className="text-[11px] md:text-xs font-semibold tracking-wide text-blue-200 uppercase bg-blue-900/50 px-3 py-1 rounded-full border border-blue-400/30">
              ⚡ 24/7 Service Support Available
            </span>
          </div>
        </div>
        <div className="absolute right-[-20px] bottom-[-20px] h-32 w-32 rounded-full bg-blue-500/10 pointer-events-none" />
      </div>

      {/* 2. Account / Profile Header Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0f2347] to-[#1b4078] text-white font-bold text-lg shadow-xs">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-bold text-slate-900 leading-tight">
              {customerName}
            </h2>
            {customerPhone ? (
              <p className="text-[13px] text-slate-500 font-medium mt-0.5">
                +91 {customerPhone}
              </p>
            ) : null}
            <div className="mt-1.5 inline-flex items-center rounded-full bg-blue-50 border border-blue-200/60 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
              {account.cars.length} Active Car{account.cars.length === 1 ? '' : 's'} Registered
            </div>
          </div>
        </div>

        <form action="/api/auth/logout" method="post" className="mt-4 pt-3 border-t border-slate-100">
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-semibold text-[13px] transition-colors"
          >
            Sign out of account
          </button>
        </form>
      </div>

      {/* 3. Rate Your Last Wash Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 font-bold text-base">
            ★
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Rate Your Last Wash
            </h3>
            <p className="text-xs text-slate-500">Reward your cleaner for great service</p>
          </div>
        </div>

        {lastWash ? (
          <>
            <RateWashForm
              visitId={lastWash.id}
              carLabel={
                lastCar
                  ? `${lastCar.make} ${lastCar.model}`.trim() || lastCar.plate
                  : 'Your Vehicle'
              }
              dateLabel={formatDateFull(lastWash.completedAt || lastWash.scheduledDate)}
              staffName={staff?.name ? staff.name.split(' ')[0] : null}
              existingRating={lastWash.rating ?? null}
            />
            <div className="mt-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[12.5px] font-semibold text-emerald-700">
                A rating of {rules.goodReviewMinStars || 4} stars or more pays your wash
                cleaner ₹{rules.goodReviewBonus || 10} extra bonus for that wash!
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
            <p className="text-sm font-medium text-slate-500">
              No completed washes to rate yet.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Once your cleaner completes a wash, you will be able to rate the service and leave feedback here.
            </p>
          </div>
        )}
      </div>

      {/* 4. Raise A Complaint Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 font-bold text-base">
            ⚠️
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Raise A Complaint
            </h3>
            <p className="text-xs text-slate-500">Issue with quality, missed wash, or timing</p>
          </div>
        </div>

        <ComplaintForm cars={registeredCars} />
      </div>

      {/* 5. My Complaints & Resolutions */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              My Complaints & Resolutions
            </h3>
            <p className="text-[11.5px] text-slate-500 font-medium mt-0.5">
              Track the status, manager investigation notes, and reschedule/re-wash actions.
            </p>
          </div>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200/60">
            {displayComplaints.length} Total
          </span>
        </div>
        
        <div className="pt-2">
          <ComplaintHistory complaints={displayComplaints} />
        </div>
      </div>
    </div>
  );
}
