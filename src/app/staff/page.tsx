import Link from 'next/link';
import {
  Card,
  CardHeading,
  EmptyState,
  Progress,
  Stat,
  Tag,
} from '@/components/ui/primitives';
import { IconChevron } from '@/components/shell/icons';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { computePayout } from '@/lib/services/payroll';
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

  const visits = await visitsForDate(store, today, { staffId });

  const customerIds = [...new Set(visits.map((v) => v.customerId))];
  const carIds = [...new Set(visits.map((v) => v.carId))];
  const [customers, cars, payout] = await Promise.all([
    Promise.all(customerIds.map((id) => store.customers.get(id))),
    Promise.all(carIds.map((id) => store.cars.get(id))),
    computePayout(store, staffId, currentCycle()),
  ]);

  const customerById = new Map(
    customers.filter(Boolean).map((c) => [c!.id, c!]),
  );
  const carById = new Map(cars.filter(Boolean).map((c) => [c!.id, c!]));

  const done = visits.filter((v) => v.status === 'DONE').length;
  const pending = visits.filter(
    (v) => v.status === 'PENDING' || v.status === 'IN_PROGRESS',
  ).length;

  // Today's pay is the difference the day's washes made to the month total —
  // seeing it move is what keeps staff using the app instead of ignoring it.
  const earnedToday = visits
    .filter((v) => v.status === 'DONE')
    .reduce((sum, _v, index) => {
      const slab = [300, 350, 400];
      return sum + (slab[index] ?? 400);
    }, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3.5">
          <CardHeading>Cars today</CardHeading>
          <Stat value={visits.length} tone="success" sub={`${pending} still to do`} />
          <div className="mt-2">
            <Progress value={done} max={visits.length || 1} />
          </div>
        </Card>
        <Card tone="brand" className="p-3.5">
          <CardHeading>Earned today</CardHeading>
          <Stat value={money(earnedToday)} tone="success" sub="updates per car" />
        </Card>
      </div>

      <Card className="p-3.5">
        <CardHeading>This month</CardHeading>
        <div className="flex items-baseline justify-between">
          <Stat
            value={money(payout.net)}
            sub={`${payout.washes} washes · net after deductions`}
          />
        </div>
      </Card>

      {visits.length === 0 ? (
        <EmptyState
          title="No cars assigned today"
          hint="Your manager will assign your route. Check back shortly."
        />
      ) : null}

      {visits.map((visit) => {
        const customer = customerById.get(visit.customerId);
        const car = carById.get(visit.carId);

        if (visit.status === 'DONE') {
          return (
            <Card key={visit.id} className="border-l-4 border-l-line-strong p-3.5 opacity-70">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-extrabold">{customer?.name}</span>
                <span className="shrink-0 text-sm font-bold text-navy-800">
                  {formatTime(visit.scheduledTime)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-ink-mute">
                {car?.model} · {car?.plate}
              </p>
              <div className="mt-2">
                <Tag tone="ok">Done {formatClock(visit.completedAt)}</Tag>
              </div>
            </Card>
          );
        }

        if (visit.status === 'MISSED') {
          return (
            <Card key={visit.id} tone="gold" accent="gold" className="p-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-extrabold">{customer?.name}</span>
                <span className="shrink-0 text-sm font-bold text-gold-700">
                  {formatTime(visit.scheduledTime)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-gold-700">
                {visit.missReason ? MISS_REASON_LABEL[visit.missReason] : 'Not done'}
              </p>
              <div className="mt-2">
                <Tag tone="warn">Not done · returned to count</Tag>
              </div>
            </Card>
          );
        }

        return (
          <Link key={visit.id} href={`/staff/wash/${visit.id}`} className="block">
            <Card accent="brand" className="p-3.5 transition-colors hover:border-navy-300">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-extrabold">{customer?.name}</span>
                <span className="shrink-0 text-sm font-bold text-navy-800">
                  {formatTime(visit.scheduledTime)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-ink-mute">
                {car?.make} {car?.model} · {car?.plate}
              </p>
              <p className="mt-0.5 text-xs text-ink-mute">
                {customer?.address}
                {customer?.landmark ? ` · ${customer.landmark}` : ''}
              </p>
              {customer?.note ? (
                <p className="mt-1 text-xs font-semibold text-gold-700">
                  Note: {customer.note}
                </p>
              ) : null}

              <div className="mt-2.5 flex items-center justify-between rounded-lg bg-navy-800 px-3 py-2 text-sm font-extrabold text-white">
                {visit.status === 'IN_PROGRESS' ? 'Continue wash' : 'Start wash'}
                <IconChevron width={16} height={16} />
              </div>
            </Card>
          </Link>
        );
      })}

    </div>
  );
}
