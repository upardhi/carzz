import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ButtonLink,
  Card,
  CardHeading,
  Note,
  Progress,
  Row,
  Stat,
  Tag,
} from '@/components/ui/primitives';
import { IconChevron } from '@/components/shell/icons';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { loadCustomerAccount } from '@/lib/services/accounts';
import {
  currentCycle,
  formatDateFull,
  formatTime,
  money,
  relativeDays,
} from '@/lib/util/format';

export const metadata = { title: 'Home' };

export default async function CustomerHome() {
  const session = await requirePermission('self:cars');
  const store = await getStore();
  const account = await loadCustomerAccount(
    store,
    session.user.customerId!,
    currentCycle(),
  );
  if (!account) notFound();

  const staff = account.nextVisit?.staffId
    ? await store.staff.get(account.nextVisit.staffId)
    : null;
  const nextCar = account.nextVisit
    ? account.cars.find((c) => c.id === account.nextVisit!.carId)
    : null;

  const washesLeft = account.cars.reduce((sum, c) => sum + c.tally.remaining, 0);
  const washesTotal = account.cars.reduce(
    (sum, c) => sum + (c.package?.washesPerMonth ?? 0),
    0,
  );

  return (
    <div className="space-y-3">
      {account.nextVisit && nextCar ? (
        <Card tone="brand" className="p-4">
          <CardHeading>Next wash</CardHeading>
          <div className="text-2xl font-extrabold tracking-tight text-navy-800">
            {formatDateFull(account.nextVisit.scheduledDate)}
          </div>
          <div className="mt-0.5 text-lg font-bold text-navy-800">
            {formatTime(account.nextVisit.scheduledTime)}
          </div>
          <p className="mt-1.5 text-[13px] text-ink-mute">
            {nextCar.model} · {nextCar.plate}
            {staff ? ` · ${staff.name.split(' ')[0]}` : ''} ·{' '}
            {relativeDays(account.nextVisit.scheduledDate)}
          </p>
        </Card>
      ) : (
        <Card tone="gold" className="p-4">
          <CardHeading>Next wash</CardHeading>
          <p className="text-sm font-semibold text-gold-700">
            No wash scheduled yet this month. Your area manager will confirm the
            slots shortly.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3.5">
          <CardHeading>Washes left</CardHeading>
          <Stat
            value={washesLeft}
            tone="success"
            sub={`across ${account.cars.length} ${account.cars.length === 1 ? 'car' : 'cars'}`}
          />
          <div className="mt-2">
            <Progress value={washesTotal - washesLeft} max={washesTotal || 1} />
          </div>
        </Card>

        <Card className="p-3.5">
          <CardHeading>Balance</CardHeading>
          <Stat
            value={money(Math.max(0, account.balance))}
            tone={account.balance >= 0 ? 'default' : 'danger'}
            sub={account.balance >= 0 ? 'advance left' : 'to be paid'}
          />
        </Card>
      </div>

      {account.cars.map((car) => (
        <Link key={car.id} href={`/app/cars/${car.id}`} className="block">
          <Card className="p-3.5 transition-colors hover:border-navy-300">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-extrabold">
                  {car.make} {car.model}
                </div>
                <div className="text-xs text-ink-mute">{car.plate}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Tag tone="ok">
                  {car.tally.done} of {car.package?.washesPerMonth ?? 0}
                </Tag>
                <IconChevron width={16} height={16} className="text-ink-faint" />
              </div>
            </div>
            <div className="mt-2">
              <Progress
                value={car.tally.done}
                max={car.package?.washesPerMonth ?? 1}
              />
            </div>
          </Card>
        </Link>
      ))}

      {account.nextDue && account.outstanding > 0 ? (
        <Card tone="gold" className="p-4">
          <CardHeading>Payment due</CardHeading>
          <Stat
            value={money(account.outstanding)}
            tone="gold"
            sub={`Due ${formatDateFull(account.nextDue.dueOn)} · ${relativeDays(account.nextDue.dueOn)}`}
          />
          <ButtonLink
            href="/app/payments"
            variant="gold"
            block
            className="mt-3"
          >
            Pay now
          </ButtonLink>
        </Card>
      ) : (
        <Card tone="success" className="p-4">
          <Row label="Account" value={<Tag tone="ok">All paid up</Tag>} />
          <Row label="Monthly package" value={money(account.monthly)} />
        </Card>
      )}

      <Note tone="brand">
        Every wash is photographed before and after. Open a car to see the proof
        for each visit, and how any missed wash was returned to your count.
      </Note>
    </div>
  );
}
