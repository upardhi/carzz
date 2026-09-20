import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Card,
  CardHeading,
  Kpi,
  KpiGrid,
  Row,
} from '@/components/ui/primitives';
import { ActionButton } from '@/components/console/ActionButton';
import { StaffPayoutTable } from '@/components/console/StaffPayoutTable';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { computePayoutRun } from '@/lib/services/payroll';
import { currentCycle, cycleLabel, money } from '@/lib/util/format';

export const metadata = { title: 'Staff payout' };

export default async function AdminPayout({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  await requirePermission('payout:approve');
  const store = await getStore();
  const { cycle: requested } = await searchParams;
  const cycle = requested ?? currentCycle();

  const [payouts, staff, areas, rules] = await Promise.all([
    computePayoutRun(store, cycle, null),
    store.staff.find(),
    store.areas.find(),
    store.getPayoutSettings(),
  ]);

  const total = payouts.reduce((sum, p) => sum + p.net, 0);
  const pending = payouts.filter((p) => p.status === 'DRAFT');
  // A draft payout with nothing earned this cycle isn't waiting on you —
  // there's no money to sign off on, so it shouldn't count as a pending
  // approval or show up in the "N need owner signoff" banner.
  const pendingWithPay = pending.filter((p) => p.net > 0);
  const approved = payouts.filter((p) => p.status === 'APPROVED');

  return (
    <>
      <PageHeader
        title="Staff payout"
        description={`${cycleLabel(cycle)} · the system calculates, you approve`}
      />

      <KpiGrid columns={6}>
        <Kpi
          label="STAFF COUNT"
          value={payouts.length}
          tone="purple"
          subtext="Employees on payroll"
        />
        <Kpi
          label="TOTAL PAYABLE"
          value={money(total)}
          tone="blue"
          subtext="Net payout this cycle"
        />
        <Kpi
          label="AWAITING APPROVAL"
          value={pendingWithPay.length}
          tone={pendingWithPay.length ? 'rose' : 'emerald'}
          subtext={pendingWithPay.length ? `${pendingWithPay.length} need owner signoff` : 'All approved'}
        />
        <Kpi
          label="APPROVED"
          value={approved.length}
          tone="emerald"
          subtext="Ready for disbursement"
        />
        <Kpi
          label="WASHES DONE"
          value={payouts.reduce((s, p) => s + p.washes, 0)}
          tone="sky"
          subtext="Billable wash units"
        />
        <Kpi
          label="DEDUCTIONS"
          value={money(payouts.reduce((s, p) => s + p.deductions, 0))}
          tone="amber"
          subtext="Absence & flags"
        />
      </KpiGrid>

      <Card
        accent={pendingWithPay.length ? 'danger' : 'success'}
        className="mt-4 p-4"
      >
        <h3 className="text-sm font-bold">
          {pendingWithPay.length
            ? `${pendingWithPay.length} payouts waiting for you — ${money(
                pendingWithPay.reduce((s, p) => s + p.net, 0),
              )}`
            : 'Every payout this month is approved'}
        </h3>
        <p className="mt-1 text-sm text-ink-mute">
          Every line is derived from recorded work — completed washes, ratings,
          attendance and pocket withdrawals — so any figure can be traced back
          to the day it came from. Nothing is paid until you approve it.
        </p>
        {pendingWithPay.length ? (
          <div className="mt-3">
            <ActionButton
              endpoint="/api/admin/payout"
              size="md"
              payload={{ action: 'approveAll', cycle }}
              confirm={`Approve all ${pendingWithPay.length} payouts, totalling ${money(
                pendingWithPay.reduce((s, p) => s + p.net, 0),
              )}?`}
            >
              Approve all — {money(pendingWithPay.reduce((s, p) => s + p.net, 0))}
            </ActionButton>
          </div>
        ) : null}
      </Card>

      <div className="mt-4">
        <StaffPayoutTable
          payouts={payouts}
          staff={staff}
          areas={areas}
          cycle={cycle}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <CardHeading>How each payout is worked out</CardHeading>
          <Row
            label="Base pay rule"
            value={
              rules.baseMode === 'PER_WASH'
                ? `Flat ${money(rules.perWashRate)} per wash`
                : `Slab ${rules.slabByCarIndex.map((r) => money(r)).join(' / ')} by car position in the day`
            }
          />
          <Row label="On-time bonus" value={money(rules.onTimeBonus)} />
          <Row
            label={`Good review bonus (${rules.goodReviewMinStars}★+)`}
            value={money(rules.goodReviewBonus)}
          />
          <Row label="New car referral" value={money(rules.carReferralBonus)} />
          <Row label="New staff referral" value={money(rules.staffReferralBonus)} />
          <Row label="Offs allowed" value={`${rules.offsAllowedPerMonth} per month`} />
          <Row
            label="Extra off"
            value={`−${money(rules.extraOffPenalty)}`}
            tone="danger"
          />
          <Row
            label="Leave without informing"
            value={`−${money(rules.uninformedLeavePenalty)}`}
            tone="danger"
          />
        </Card>

      </div>
    </>
  );
}
