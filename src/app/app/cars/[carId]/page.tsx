import { notFound } from 'next/navigation';
import {
  Card,
  CardHeading,
  Note,
  Row,
  SectionTitle,
  Stat,
  Tag,
} from '@/components/ui/primitives';
import { IconCamera, IconStar } from '@/components/shell/icons';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { loadCustomerAccount } from '@/lib/services/accounts';
import {
  currentCycle,
  formatDateFull,
  formatClock,
  formatTime,
} from '@/lib/util/format';
import { MISS_REASON_LABEL, PATTERN_LABEL } from '@/lib/util/labels';

export const metadata = { title: 'Wash history' };

export default async function CarDetail({
  params,
}: {
  params: Promise<{ carId: string }>;
}) {
  const { carId } = await params;
  const session = await requirePermission('self:cars');
  const store = await getStore();

  const account = await loadCustomerAccount(
    store,
    session.user.customerId!,
    currentCycle(),
  );
  // Reading the car through the account, not by id, is what stops a customer
  // opening someone else's car by editing the URL.
  const car = account?.cars.find((c) => c.id === carId);
  if (!account || !car) notFound();

  const settings = await store.getAppSettings();
  const history = account.visits
    .filter((v) => v.carId === carId && v.status !== 'PENDING')
    .slice(0, 20);

  const staffIds = [...new Set(history.map((v) => v.staffId).filter(Boolean))];
  const staff = new Map(
    (await Promise.all(staffIds.map((id) => store.staff.get(id!))))
      .filter(Boolean)
      .map((s) => [s!.id, s!]),
  );

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <h1 className="text-lg font-extrabold">
          {car.make} {car.model}
        </h1>
        <p className="text-xs text-ink-mute">
          {car.colour} · {car.plate}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3.5">
          <CardHeading>Done</CardHeading>
          <Stat value={car.tally.done} tone="teal" sub="this month" />
        </Card>
        <Card className="p-3.5">
          <CardHeading>Remaining</CardHeading>
          <Stat value={car.tally.remaining} sub="still to come" />
        </Card>
      </div>

      <Card className="p-4">
        <CardHeading>Package</CardHeading>
        <Row label="Type" value={car.package?.name ?? '—'} />
        <Row
          label="Washes per month"
          value={car.package?.washesPerMonth ?? 0}
        />
        <Row label="Wash days" value={PATTERN_LABEL[car.schedulePattern]} />
        <Row label="Time slot" value={formatTime(car.scheduleTime)} />
        {car.specialInstructions ? (
          <Row label="Your note" value={car.specialInstructions} />
        ) : null}
      </Card>

      <SectionTitle>Wash history</SectionTitle>

      {history.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-mute">
          No washes recorded yet for this car.
        </Card>
      ) : null}

      {history.map((visit) =>
        visit.status === 'DONE' ? (
          <Card key={visit.id} className="p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold">
                  {formatDateFull(visit.scheduledDate)} ·{' '}
                  {formatClock(visit.completedAt)}
                </div>
                <div className="truncate text-xs text-ink-mute">
                  {visit.servicesDone.join(' · ') || 'Wash'}
                  {visit.staffId
                    ? ` · ${staff.get(visit.staffId)?.name.split(' ')[0] ?? ''}`
                    : ''}
                </div>
              </div>
              <Tag tone="ok">Done</Tag>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {(
                [
                  ['Before', visit.beforePhotoUrl],
                  ['After', visit.afterPhotoUrl],
                ] as const
              ).map(([label, url]) => (
                <div
                  key={label}
                  className="flex aspect-[4/3] flex-col items-center justify-center rounded-lg border-2 border-teal-500 bg-teal-50 text-xs font-bold text-teal-600"
                >
                  <IconCamera width={22} height={22} />
                  <span className="mt-1">{label}</span>
                  {!url ? (
                    <span className="text-[10px] font-normal">not stored</span>
                  ) : null}
                </div>
              ))}
            </div>

            {visit.rating ? (
              <p className="mt-2.5 flex items-center gap-1 text-xs text-ink-mute">
                You rated
                <span className="inline-flex items-center gap-0.5 font-bold text-gold-600">
                  {visit.rating}
                  <IconStar width={13} height={13} />
                </span>
              </p>
            ) : (
              <p className="mt-2.5 text-xs text-ink-mute">
                Not rated yet — you can rate it from the Help tab.
              </p>
            )}
          </Card>
        ) : (
          <Card key={visit.id} tone="gold" className="p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold">
                  {formatDateFull(visit.scheduledDate)}
                </div>
                <div className="text-xs text-gold-700">
                  Reason:{' '}
                  {visit.missReason
                    ? MISS_REASON_LABEL[visit.missReason]
                    : 'Not recorded'}
                </div>
              </div>
              <Tag tone="warn">Not done</Tag>
            </div>
            {visit.rescheduledToVisitId ? (
              <div className="mt-2.5">
                <Note tone="teal">
                  This wash was <b>returned to your count</b> — you did not lose
                  it. It has been rescheduled.
                </Note>
              </div>
            ) : null}
          </Card>
        ),
      )}

      <Note>
        Wash photos are kept for {settings.photoRetentionMonths}{' '}
        {settings.photoRetentionMonths === 1 ? 'month' : 'months'}, then removed
        automatically.
      </Note>
    </div>
  );
}
