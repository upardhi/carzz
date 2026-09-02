import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Card,
  CardHeading,
  Kpi,
  KpiGrid,
  Note,
  Row,
  Tag,
} from '@/components/ui/primitives';
import { DataTable } from '@/components/ui/DataTable';
import { ActionButton } from '@/components/console/ActionButton';
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

  const staffById = new Map(staff.map((s) => [s.id, s]));
  const areaById = new Map(areas.map((a) => [a.id, a]));

  const total = payouts.reduce((sum, p) => sum + p.net, 0);
  const pending = payouts.filter((p) => p.status === 'DRAFT');
  const approved = payouts.filter((p) => p.status === 'APPROVED');

  return (
    <>
      <PageHeader
        title="Staff payout"
        description={`${cycleLabel(cycle)} · the system calculates, you approve`}
      />

      <KpiGrid>
        <Kpi label="Staff" value={payouts.length} />
        <Kpi label="Total payable" value={money(total)} />
        <Kpi
          label="Awaiting you"
          value={pending.length}
          tone={pending.length ? 'danger' : 'success'}
        />
        <Kpi label="Approved" value={approved.length} tone="success" />
        <Kpi label="Washes" value={payouts.reduce((s, p) => s + p.washes, 0)} />
        <Kpi
          label="Deductions"
          value={money(payouts.reduce((s, p) => s + p.deductions, 0))}
          tone="gold"
        />
      </KpiGrid>

      <Card
        accent={pending.length ? 'danger' : 'success'}
        className="mt-4 p-4"
      >
        <h3 className="text-sm font-extrabold">
          {pending.length
            ? `${pending.length} payouts waiting for you — ${money(
                pending.reduce((s, p) => s + p.net, 0),
              )}`
            : 'Every payout this month is approved'}
        </h3>
        <p className="mt-1 text-sm text-ink-mute">
          Every line is derived from recorded work — completed washes, ratings,
          attendance and pocket withdrawals — so any figure can be traced back
          to the day it came from. Nothing is paid until you approve it.
        </p>
        {pending.length ? (
          <div className="mt-3">
            <ActionButton
              endpoint="/api/admin/payout"
              size="md"
              payload={{ action: 'approveAll', cycle }}
              confirm={`Approve all ${pending.length} payouts, totalling ${money(
                pending.reduce((s, p) => s + p.net, 0),
              )}?`}
            >
              Approve all — {money(pending.reduce((s, p) => s + p.net, 0))}
            </ActionButton>
          </div>
        ) : null}
      </Card>

      <div className="mt-4">
        <DataTable<(typeof payouts)[number]>
          data={payouts}
          keyExtractor={(payout) => payout.id}
          itemLabel="staff payouts"
          emptyMessage="No staff payouts for this month."
          columns={[
            {
              id: 'staff',
              header: 'STAFF',
              className: 'font-bold text-navy-950',
              render: (payout) => staffById.get(payout.staffId)?.name ?? '—',
            },
            {
              id: 'area',
              header: 'AREA',
              render: (payout) => areaById.get(payout.areaId)?.name ?? '—',
            },
            {
              id: 'washes',
              header: 'WASHES',
              align: 'center',
              render: (payout) => payout.washes,
            },
            {
              id: 'base',
              header: 'BASE',
              render: (payout) => money(payout.base),
            },
            {
              id: 'bonuses',
              header: 'BONUSES',
              render: (payout) =>
                payout.bonuses ? (
                  <span className="font-semibold text-emerald-600">+{money(payout.bonuses)}</span>
                ) : (
                  '—'
                ),
            },
            {
              id: 'referrals',
              header: 'REFERRALS',
              render: (payout) =>
                payout.referrals ? (
                  <span className="font-semibold text-emerald-600">+{money(payout.referrals)}</span>
                ) : (
                  '—'
                ),
            },
            {
              id: 'deductions',
              header: 'DEDUCTIONS',
              render: (payout) =>
                payout.deductions ? (
                  <span className="font-semibold text-rose-600">−{money(payout.deductions)}</span>
                ) : (
                  '—'
                ),
            },
            {
              id: 'pocket',
              header: 'POCKET TAKEN',
              render: (payout) =>
                payout.pocketTaken ? `−${money(payout.pocketTaken)}` : '—',
            },
            {
              id: 'net',
              header: 'NET PAYABLE',
              className: 'font-extrabold text-slate-900',
              render: (payout) => money(payout.net),
            },
            {
              id: 'status',
              header: 'STATUS',
              render: (payout) => (
                <Tag
                  tone={
                    payout.status === 'APPROVED'
                      ? 'ok'
                      : payout.status === 'HELD'
                        ? 'bad'
                        : 'warn'
                  }
                >
                  {payout.status === 'DRAFT' ? 'Awaiting' : payout.status}
                </Tag>
              ),
            },
            {
              id: 'action',
              header: 'ACTION',
              render: (payout) =>
                payout.status === 'DRAFT' ? (
                  <div className="flex gap-1.5">
                    <ActionButton
                      endpoint="/api/admin/payout"
                      payload={{
                        action: 'approveOne',
                        staffId: payout.staffId,
                        cycle,
                      }}
                    >
                      Approve
                    </ActionButton>
                    <ActionButton
                      endpoint="/api/admin/payout"
                      variant="secondary"
                      payload={{ action: 'hold', staffId: payout.staffId, cycle }}
                    >
                      Hold
                    </ActionButton>
                  </div>
                ) : (
                  <span className="text-ink-faint">—</span>
                ),
            },
          ]}
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

        <Card accent="gold" className="p-4">
          <CardHeading>Open question on the base rate</CardHeading>
          <Note>
            The brief left one thing unsettled: whether the ₹300 / ₹350 / ₹400
            figures are a <b>slab by the car&rsquo;s position in the day</b>, or
            whether a flat per-wash rate applies instead. The two differ by
            roughly three times on the same work.
            <br />
            <br />
            This is currently set to{' '}
            <b>
              {rules.baseMode === 'PER_WASH'
                ? `a flat ${money(rules.perWashRate)} per wash`
                : 'the day slab'}
            </b>
            , which reproduces the figures in your prototype. Change it on the
            Settings screen once you decide — every payout recalculates, and no
            code changes.
          </Note>
        </Card>
      </div>
    </>
  );
}
