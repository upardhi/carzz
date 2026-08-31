import {
  BarChart,
  Card,
  CardHeading,
  Note,
  Row,
  SectionTitle,
  Stat,
  Tag,
} from '@/components/ui/primitives';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { computePayout } from '@/lib/services/payroll';
import { currentCycle, cycleLabel, money, percent } from '@/lib/util/format';

export const metadata = { title: 'My earnings' };

export default async function StaffEarnings() {
  const session = await requirePermission('self:earnings');
  const store = await getStore();
  const staffId = session.user.staffId!;
  const cycle = currentCycle();

  // Six months of history so the trend is visible, not just this month's total.
  const cycles = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - (5 - i));
    return d.toISOString().slice(0, 7);
  });

  const [payouts, rules, attendance] = await Promise.all([
    Promise.all(cycles.map((c) => computePayout(store, staffId, c))),
    store.getPayoutSettings(),
    store.attendance.find({ where: { staffId } }),
  ]);

  const current = payouts[payouts.length - 1];
  const monthAttendance = attendance.filter((a) => a.date.startsWith(cycle));
  const offs = monthAttendance.filter((a) => a.status === 'OFF').length;
  const uninformed = monthAttendance.filter(
    (a) => a.status === 'OFF_UNINFORMED',
  ).length;

  const visits = await store.visits.find({
    where: { staffId, cycle, status: 'DONE' },
  });
  const rated = visits.filter((v) => v.rating !== null);
  const onTime = visits.filter((v) => v.onTime).length;

  const earnings = current.lines.filter((l) => l.kind === 'EARNING');
  const deductions = current.lines.filter((l) => l.kind === 'DEDUCTION');

  return (
    <div className="space-y-3">
      <Card tone="brand" className="p-4">
        <CardHeading>Earned this month</CardHeading>
        <Stat
          value={money(current.net)}
          tone="success"
          sub={`${cycleLabel(cycle)} · net payable`}
        />
        <div className="mt-3">
          <BarChart
            data={payouts.map((p, i) => ({
              label: cycleLabel(cycles[i]).slice(0, 3),
              value: p.net,
            }))}
          />
        </div>
      </Card>

      <Card className="p-4">
        <CardHeading>How it adds up</CardHeading>
        {earnings.map((line) => (
          <Row
            key={line.label}
            label={
              <>
                {line.label}
                {line.qty ? (
                  <span className="ml-1 text-ink-faint">× {line.qty}</span>
                ) : null}
              </>
            }
            value={line.amount > 0 ? `+${money(line.amount)}` : money(0)}
            tone={line.amount > 0 ? 'success' : undefined}
          />
        ))}

        {deductions.length ? (
          <>
            <div className="mt-3 border-t border-line pt-2" />
            {deductions.map((line) => (
              <Row
                key={line.label}
                label={
                  <>
                    {line.label}
                    {line.detail ? (
                      <span className="block text-[11px] text-ink-faint">
                        {line.detail}
                      </span>
                    ) : null}
                  </>
                }
                value={`−${money(line.amount)}`}
                tone="danger"
              />
            ))}
          </>
        ) : null}

        <div className="mt-3 flex items-baseline justify-between border-t-2 border-navy-850 pt-2.5">
          <span className="font-extrabold">Net payable</span>
          <span className="text-lg font-extrabold">{money(current.net)}</span>
        </div>
      </Card>

      <Card tone="success" className="p-4">
        <CardHeading>Refer and earn</CardHeading>
        <Row
          label="A new car on your reference"
          value={money(rules.carReferralBonus)}
          tone="success"
        />
        <Row
          label="A new wash boy on your reference"
          value={money(rules.staffReferralBonus)}
          tone="success"
        />
        <div className="mt-2">
          <Note tone="brand">
            Tell your manager who you referred when they join — the bonus is
            added to that month’s pay automatically.
          </Note>
        </div>
      </Card>

      <SectionTitle>My performance</SectionTitle>
      <Card className="p-4">
        <Row label="Washes this month" value={visits.length} />
        <Row
          label="On-time rate"
          value={percent(visits.length ? onTime / visits.length : 0)}
          tone={
            visits.length && onTime / visits.length >= 0.85 ? 'success' : 'gold'
          }
        />
        <Row
          label="Average rating"
          value={
            rated.length
              ? `${(rated.reduce((s, v) => s + (v.rating ?? 0), 0) / rated.length).toFixed(1)} ★`
              : 'Not rated yet'
          }
        />
      </Card>

      <Card tone={offs > rules.offsAllowedPerMonth ? 'gold' : 'default'} className="p-4">
        <CardHeading>Off status</CardHeading>
        <Row label="Offs allowed" value={`${rules.offsAllowedPerMonth} per month`} />
        <Row
          label="Offs taken"
          value={
            <span className="inline-flex items-center gap-2">
              {offs}
              {offs > rules.offsAllowedPerMonth ? (
                <Tag tone="warn">Over</Tag>
              ) : null}
            </span>
          }
          tone={offs > rules.offsAllowedPerMonth ? 'gold' : undefined}
        />
        <Row
          label="Extra off"
          value={`−${money(rules.extraOffPenalty)} each`}
        />
        <Row
          label="Leave without informing"
          value={`−${money(rules.uninformedLeavePenalty)}`}
          tone={uninformed > 0 ? 'danger' : undefined}
        />
      </Card>
    </div>
  );
}
