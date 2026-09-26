import Link from 'next/link';
import { PageHeader } from '@/components/shell/ConsoleShell';
import { Card } from '@/components/ui/primitives';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { currentCycle, formatDateFull } from '@/lib/util/format';

export const metadata = { title: 'Team Alerts' };

/**
 * A manager's version of "red alerts" — not money, but the three things a
 * manager is actually judged on: washes done, quality of washes, and
 * whether the team shows up. Complaints and payment-chasing moved to area
 * admin and up; this page needs only permissions a manager already has
 * (visit:view, leave:view), so it stays reachable even without complaint
 * or inventory access.
 */
export default async function ManagerTeamAlerts() {
  const session = await requirePermission('visit:view');
  const store = await getStore();
  const areaFilter = scopeAreaFilter(session.scope);
  const cycle = currentCycle();
  const today = new Date().toISOString().slice(0, 10);

  const [missedToday, lowRatedVisits, staff, uninformedLeaves] = await Promise.all([
    store.visits.find({
      where: { scheduledDate: today, status: 'MISSED', ...areaFilter } as never,
      orderBy: [{ field: 'scheduledTime' }],
    }),
    store.visits.find({
      where: { cycle, rating: { ne: null, lt: 3 }, ...areaFilter } as never,
      orderBy: [{ field: 'completedAt', dir: 'desc' }],
      limit: 50,
    }),
    store.staff.find({ where: { role: 'EMPLOYEE', ...areaFilter } as never }),
    store.leaves.find({
      where: { type: 'UNINFORMED' } as never,
      orderBy: [{ field: 'appliedAt', dir: 'desc' }],
      limit: 50,
    }),
  ]);

  const staffIds = new Set(staff.map((s) => s.id));
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const scopedUninformedLeaves = uninformedLeaves.filter((l) => staffIds.has(l.staffId));

  const customerIds = [
    ...new Set([...missedToday, ...lowRatedVisits].map((v) => v.customerId)),
  ];
  const carIds = [...new Set([...missedToday, ...lowRatedVisits].map((v) => v.carId))];
  const [customers, cars] = await Promise.all([
    customerIds.length
      ? store.customers.find({ where: { id: { in: customerIds } } as never })
      : Promise.resolve([]),
    carIds.length ? store.cars.find({ where: { id: { in: carIds } } as never }) : Promise.resolve([]),
  ]);
  const customerById = new Map(customers.map((c) => [c.id, c]));
  const carById = new Map(cars.map((c) => [c.id, c]));

  return (
    <>
      <PageHeader
        title="Team Alerts"
        description="Washes not done, washes rated poorly, and staff who took leave without informing anyone — the operational picture, not the money one."
      />

      <div className="my-4">
        <StatGrid columns={3}>
          <StatCard
            label="MISSED TODAY"
            value={missedToday.length}
            tone={missedToday.length ? 'rose' : 'emerald'}
            subtext="Washes not done today"
          />
          <StatCard
            label="BELOW 3★ THIS CYCLE"
            value={lowRatedVisits.length}
            tone={lowRatedVisits.length ? 'amber' : 'emerald'}
            subtext="Customer-rated washes"
          />
          <StatCard
            label="UNINFORMED LEAVES"
            value={scopedUninformedLeaves.length}
            tone={scopedUninformedLeaves.length ? 'rose' : 'emerald'}
            subtext="No heads-up before taking leave"
          />
        </StatGrid>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-bold text-navy-950">Missed washes today</h2>
        {missedToday.length === 0 ? (
          <Card className="p-4 text-xs text-slate-500">Nothing missed today.</Card>
        ) : (
          missedToday.map((v) => {
            const customer = customerById.get(v.customerId);
            const car = carById.get(v.carId);
            const washService = v.plannedService;
            return (
              <Card key={v.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900">{customer?.name ?? 'Customer'}</span>
                    {car ? (
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        🚗 {car.make} {car.model} · <span className="font-mono text-slate-900">{car.plate}</span>
                      </span>
                    ) : null}
                    {washService ? (
                      <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        {washService}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs font-semibold text-slate-600">
                    {v.staffId ? staffById.get(v.staffId)?.name ?? 'Unassigned' : 'Unassigned'}
                  </span>
                </div>
                {v.missReason ? (
                  <p className="mt-1.5 text-xs text-rose-600 font-medium">
                    Reason: {v.missReason.replace(/_/g, ' ')}
                    {v.missNote ? ` — ${v.missNote}` : ''}
                  </p>
                ) : null}
                {customer?.address ? (
                  <p className="mt-1 text-[11px] text-slate-400">📍 {customer.address}</p>
                ) : null}
              </Card>
            );
          })
        )}
      </div>

      <div className="mt-6 space-y-3">
        <h2 className="text-sm font-bold text-navy-950">Low-rated washes this cycle</h2>
        {lowRatedVisits.length === 0 ? (
          <Card className="p-4 text-xs text-slate-500">No wash rated below 3★ this cycle.</Card>
        ) : (
          lowRatedVisits.map((v) => {
            const customer = customerById.get(v.customerId);
            const car = carById.get(v.carId);
            const washService =
              v.plannedService ||
              (v.servicesDone && v.servicesDone.length > 0
                ? v.servicesDone.join(', ')
                : 'Standard Wash');

            return (
              <Card key={v.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {v.staffId ? staffById.get(v.staffId)?.name ?? 'Wash boy' : '—'}
                    </span>
                    <span className="text-xs text-slate-500">
                      • {formatDateFull(v.completedAt || v.scheduledDate)}
                      {v.scheduledTime ? ` (${v.scheduledTime})` : ''}
                    </span>
                    {car ? (
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        🚗 {car.make} {car.model} · <span className="font-mono text-slate-900">{car.plate}</span>
                        {car.colour ? <span className="text-slate-500 font-normal">({car.colour})</span> : null}
                      </span>
                    ) : null}
                    {washService ? (
                      <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        {washService}
                      </span>
                    ) : null}
                  </div>
                  <span className="font-bold text-rose-600 text-sm">{'★'.repeat(v.rating ?? 0)}</span>
                </div>
                {v.ratingComment ? (
                  <div className="mt-2 rounded border border-rose-100 bg-rose-50/50 p-2.5 text-xs text-slate-800">
                    <span className="font-semibold text-rose-700">Feedback: </span>
                    <span className="italic">&ldquo;{v.ratingComment}&rdquo;</span>
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                  <span>
                    Customer: <strong className="text-slate-700">{customer?.name ?? '—'}</strong>
                    <span className="text-slate-400 ml-1">(shown to manager only)</span>
                  </span>
                  {customer?.address ? (
                    <span>
                      📍 <span className="text-slate-600">{customer.address}</span>
                    </span>
                  ) : null}
                </div>
              </Card>
            );
          })
        )}
      </div>

      <div className="mt-6 space-y-3">
        <h2 className="text-sm font-bold text-navy-950">Uninformed leaves</h2>
        {scopedUninformedLeaves.length === 0 ? (
          <Card className="p-4 text-xs text-slate-500">No uninformed leaves recorded.</Card>
        ) : (
          scopedUninformedLeaves.map((l) => (
            <Card key={l.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-900">
                    {staffById.get(l.staffId)?.name ?? 'Staff'}
                  </span>
                  <span className="ml-2 text-xs text-slate-500">
                    {formatDateFull(l.startDate)} – {formatDateFull(l.endDate)}
                  </span>
                </div>
                <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10.5px] font-bold text-rose-700">
                  {l.status}
                </span>
              </div>
              {l.reason ? <p className="mt-1 text-xs text-slate-500">{l.reason}</p> : null}
            </Card>
          ))
        )}
      </div>

      <div className="mt-6">
        <Link
          href="/manager/staff/leaves"
          className="text-xs font-semibold text-blue-600 hover:text-blue-800"
        >
          Go to Staff Leave Requests →
        </Link>
      </div>
    </>
  );
}
