import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, Progress, Row, Tag } from '@/components/ui/primitives';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { loadCustomerAccount } from '@/lib/services/accounts';
import { currentCycle, formatTime, money } from '@/lib/util/format';
import { PATTERN_SHORT } from '@/lib/util/labels';

export const metadata = { title: 'My cars' };

export default async function CustomerCars() {
  const session = await requirePermission('self:cars');
  const store = await getStore();
  const account = await loadCustomerAccount(
    store,
    session.user.customerId!,
    currentCycle(),
  );
  if (!account) notFound();

  return (
    <div className="space-y-3">
      {account.cars.map((car) => (
        <Card key={car.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-extrabold">
                {car.make} {car.model}
              </h2>
              <p className="text-xs text-ink-mute">
                {car.colour} · {car.plate}
              </p>
            </div>
            <Tag tone={car.active ? 'ok' : 'neutral'}>
              {car.active ? 'Active' : 'Paused'}
            </Tag>
          </div>

          <div className="mt-3">
            <Row label="Package" value={car.package?.name ?? '—'} />
            <Row
              label="Washes this month"
              value={`${car.tally.done} of ${car.package?.washesPerMonth ?? 0}`}
            />
            <Row
              label="Schedule"
              value={`${PATTERN_SHORT[car.schedulePattern]} · ${formatTime(car.scheduleTime)}`}
            />
            <Row label="Package price" value={money(car.package?.price ?? 0)} />
          </div>

          <div className="mt-3">
            <Progress
              value={car.tally.done}
              max={car.package?.washesPerMonth ?? 1}
            />
          </div>

          <Link
            href={`/app/cars/${car.id}`}
            className="mt-3 block rounded-lg border border-line-strong bg-white py-2.5 text-center text-sm font-bold text-ink hover:bg-surface-muted"
          >
            View wash history
          </Link>
        </Card>
      ))}

    </div>
  );
}
