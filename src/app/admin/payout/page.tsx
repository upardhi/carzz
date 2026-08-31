import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Card,
  CardHeading,
  Kpi,
  KpiGrid,
  Note,
  Row,
  Table,
  TableWrap,
  Tag,
  Td,
  Th,
} from '@/components/ui/primitives';
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
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Staff</Th>
                <Th>Area</Th>
                <Th>Washes</Th>
                <Th>Base</Th>
                <Th>Bonuses</Th>
                <Th>Referrals</Th>
                <Th>Deductions</Th>
                <Th>Pocket taken</Th>
                <Th>Net payable</Th>
                <Th>Status</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => {
                const member = staffById.get(payout.staffId);
                return (
                  <tr key={payout.id}>
                    <Td className="font-bold">{member?.name ?? '—'}</Td>
                    <Td>{areaById.get(payout.areaId)?.name ?? '—'}</Td>
                    <Td>{payout.washes}</Td>
                    <Td>{money(payout.base)}</Td>
                    <Td className="text-success-600">
                      {payout.bonuses ? `+${money(payout.bonuses)}` : '—'}
                    </Td>
                    <Td className="text-success-600">
                      {payout.referrals ? `+${money(payout.referrals)}` : '—'}
                    </Td>
                    <Td className="text-danger-500">
                      {payout.deductions ? `−${money(payout.deductions)}` : '—'}
                    </Td>
                    <Td>
                      {payout.pocketTaken ? `−${money(payout.pocketTaken)}` : '—'}
                    </Td>
                    <Td className="font-extrabold">{money(payout.net)}</Td>
                    <Td>
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
                    </Td>
                    <Td>
                      {payout.status === 'DRAFT' ? (
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
                      )}
                    </Td>
                  </tr>
                );
              })}
              {payouts.length ? (
                <tr>
                  <Td className="text-right font-extrabold" colSpan={8}>
                    Total — {payouts.length} staff
                  </Td>
                  <Td className="text-base font-extrabold">{money(total)}</Td>
                  <Td colSpan={2} />
                </tr>
              ) : (
                <tr>
                  <Td className="py-8 text-center text-ink-mute" colSpan={11}>
                    No staff payouts for this month.
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </TableWrap>
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
