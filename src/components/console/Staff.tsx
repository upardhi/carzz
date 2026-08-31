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
import { scopeAreaFilter } from '@/lib/auth/rbac';
import type { Session } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { computePayout, pocketAllowance } from '@/lib/services/payroll';
import { staffPerformance } from '@/lib/services/reports';
import {
  currentCycle,
  formatClock,
  formatDateFull,
  money,
  percent,
  todayISO,
} from '@/lib/util/format';
import { ActionButton } from './ActionButton';
import { AddStaffForm } from './AddStaffForm';

export async function ConsoleStaff({ session }: { session: Session }) {
  const store = await getStore();
  const cycle = currentCycle();
  const today = todayISO();
  const areaFilter = scopeAreaFilter(session.scope);

  const [staff, areas, rules, performance] = await Promise.all([
    store.staff.find({
      where: { role: 'EMPLOYEE', ...areaFilter } as never,
      orderBy: [{ field: 'name' }],
    }),
    store.areas.find(),
    store.getPayoutSettings(),
    staffPerformance(store, cycle, session.scope.areaIds),
  ]);

  const staffIds = new Set(staff.map((s) => s.id));
  const [attendanceToday, todayVisits, allPocket] = await Promise.all([
    store.attendance.find({ where: { date: today } }),
    store.visits.find({ where: { scheduledDate: today, ...areaFilter } as never }),
    store.pocketRequests.find({
      where: { status: 'PENDING' },
      orderBy: [{ field: 'requestedAt' }],
    }),
  ]);

  const pending = allPocket.filter((r) => staffIds.has(r.staffId));
  const allowances = new Map(
    await Promise.all(
      pending.map(
        async (r) =>
          [r.id, await pocketAllowance(store, r.staffId, cycle)] as const,
      ),
    ),
  );
  const payouts = new Map(
    await Promise.all(
      staff.map(async (s) => [s.id, await computePayout(store, s.id, cycle)] as const),
    ),
  );

  const attendanceByStaff = new Map(attendanceToday.map((a) => [a.staffId, a]));
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const performanceById = new Map(performance.map((p) => [p.staffId, p]));
  const staffById = new Map(staff.map((s) => [s.id, s]));

  // Anyone over the monthly off allowance is a discipline conversation waiting
  // to happen, so surface them rather than burying it in the payout.
  const monthAttendance = await store.attendance.find({
    where: { date: { gte: `${cycle}-01`, lte: `${cycle}-31` } } as never,
  });
  const flags = staff
    .map((member) => {
      const own = monthAttendance.filter((a) => a.staffId === member.id);
      return {
        member,
        offs: own.filter((a) => a.status === 'OFF').length,
        uninformed: own.filter((a) => a.status === 'OFF_UNINFORMED').length,
      };
    })
    .filter((f) => f.offs > rules.offsAllowedPerMonth || f.uninformed > 0);

  const absentToday = staff.filter((s) => {
    const record = attendanceByStaff.get(s.id);
    return !record?.loginAt && record?.status !== 'PRESENT';
  });

  return (
    <>
      <PageHeader title="Staff" description={`${staff.length} wash boys`} />

      <KpiGrid>
        <Kpi label="Wash boys" value={staff.length} />
        <Kpi
          label="Working today"
          value={staff.length - absentToday.length}
          tone="teal"
        />
        <Kpi
          label="Absent today"
          value={absentToday.length}
          tone={absentToday.length ? 'danger' : 'default'}
        />
        <Kpi
          label="Pocket requests"
          value={pending.length}
          tone={pending.length ? 'gold' : 'default'}
        />
        <Kpi
          label="Discipline flags"
          value={flags.length}
          tone={flags.length ? 'gold' : 'default'}
        />
        <Kpi
          label="Payout this month"
          value={money(
            [...payouts.values()].reduce((sum, p) => sum + p.net, 0),
          )}
        />
      </KpiGrid>

      <div className="mt-4">
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Area</Th>
                <Th>Signed in</Th>
                <Th>Cars today</Th>
                <Th>Washes</Th>
                <Th>On-time</Th>
                <Th>Rating</Th>
                <Th>Earned</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => {
                const record = attendanceByStaff.get(member.id);
                const absent = !record?.loginAt && record?.status !== 'PRESENT';
                const stats = performanceById.get(member.id);
                const own = todayVisits.filter((v) => v.staffId === member.id);

                return (
                  <tr key={member.id}>
                    <Td className="font-bold">{member.name}</Td>
                    <Td>{areaById.get(member.areaId)?.name ?? '—'}</Td>
                    <Td className={absent ? 'font-bold text-danger-500' : ''}>
                      {record?.loginAt ? formatClock(record.loginAt) : 'Absent'}
                    </Td>
                    <Td>
                      {own.filter((v) => v.status === 'DONE').length}/{own.length}
                    </Td>
                    <Td>{stats?.washes ?? 0}</Td>
                    <Td
                      className={
                        stats && stats.onTimeRate < 0.7
                          ? 'font-bold text-danger-500'
                          : ''
                      }
                    >
                      {percent(stats?.onTimeRate ?? 0)}
                    </Td>
                    <Td>
                      {stats?.averageRating
                        ? `${stats.averageRating.toFixed(1)} ★`
                        : '—'}
                    </Td>
                    <Td className="font-bold">
                      {money(payouts.get(member.id)?.net ?? 0)}
                    </Td>
                    <Td>
                      <ActionButton
                        endpoint="/api/ops/staff"
                        variant={member.active ? 'secondary' : 'primary'}
                        payload={{
                          action: 'setActive',
                          staffId: member.id,
                          active: !member.active,
                        }}
                        confirm={
                          member.active
                            ? `Deactivate ${member.name}? Their upcoming cars become unassigned and their login stops working.`
                            : undefined
                        }
                      >
                        {member.active ? 'Deactivate' : 'Reactivate'}
                      </ActionButton>
                    </Td>
                  </tr>
                );
              })}
              {staff.length === 0 ? (
                <tr>
                  <Td className="py-8 text-center text-ink-mute" colSpan={9}>
                    No wash boys added yet.
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </TableWrap>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="p-4">
          <CardHeading>Pocket money requests</CardHeading>
          {pending.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-mute">
              Nothing waiting for you.
            </p>
          ) : null}

          {pending.map((request) => {
            const member = staffById.get(request.staffId);
            const allowance = allowances.get(request.id);
            const overCap = allowance ? request.amount > allowance.available : false;

            return (
              <div
                key={request.id}
                className="mb-2 rounded-lg border border-line bg-white p-3 last:mb-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <b className="text-sm">
                    {member?.name} — {money(request.amount)}
                  </b>
                  <Tag tone={overCap ? 'bad' : 'neutral'}>
                    {overCap ? 'Over limit' : 'Within limit'}
                  </Tag>
                </div>
                <p className="mt-1 text-xs text-ink-mute">
                  Limit {money(allowance?.available ?? 0)} · {money(allowance?.inAccount ?? 0)} in
                  account · asked {formatDateFull(request.requestedAt)}
                </p>
                {overCap ? (
                  <p className="mt-1 text-xs font-semibold text-danger-500">
                    Exceeds the {rules.pocketWeeklyCapPercent}% weekly cap by{' '}
                    {money(request.amount - (allowance?.available ?? 0))}
                  </p>
                ) : null}

                <div className="mt-2 flex gap-2">
                  <ActionButton
                    endpoint="/api/ops/pocket"
                    payload={{ requestId: request.id, decision: 'APPROVED' }}
                    variant={overCap ? 'secondary' : 'primary'}
                    confirm={
                      overCap
                        ? 'This is above the weekly cap. Approve it anyway?'
                        : undefined
                    }
                  >
                    {overCap ? 'Approve anyway' : 'Approve'}
                  </ActionButton>
                  <ActionButton
                    endpoint="/api/ops/pocket"
                    variant="secondary"
                    payload={{ requestId: request.id, decision: 'REJECTED' }}
                  >
                    Reject
                  </ActionButton>
                </div>
              </div>
            );
          })}
        </Card>

        <Card className="p-4">
          <CardHeading>Discipline flags this month</CardHeading>
          {flags.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-mute">
              Nobody is over their off allowance.
            </p>
          ) : (
            flags.map((flag) => (
              <div key={flag.member.id}>
                {flag.offs > rules.offsAllowedPerMonth ? (
                  <Row
                    label={`${flag.member.name} — ${flag.offs} offs taken`}
                    value={
                      flag.offs === rules.offsAllowedPerMonth + 1
                        ? 'Warning'
                        : `−${money((flag.offs - rules.offsAllowedPerMonth - 1) * rules.extraOffPenalty)}`
                    }
                    tone={
                      flag.offs === rules.offsAllowedPerMonth + 1 ? 'gold' : 'danger'
                    }
                  />
                ) : null}
                {flag.uninformed > 0 ? (
                  <Row
                    label={`${flag.member.name} — absent without informing × ${flag.uninformed}`}
                    value={`−${money(flag.uninformed * rules.uninformedLeavePenalty)}`}
                    tone="danger"
                  />
                ) : null}
              </div>
            ))
          )}

          <div className="mt-3">
            <Note>
              Deductions are calculated automatically from attendance, but
              nothing is taken until the owner approves the month’s payout.
            </Note>
          </div>
        </Card>

        <Card className="p-4">
          <CardHeading>Add a wash boy</CardHeading>
          <AddStaffForm
            areas={areas
              .filter(
                (a) =>
                  session.scope.areaIds === null ||
                  session.scope.areaIds.includes(a.id),
              )
              .map((a) => ({ id: a.id, name: a.name }))}
            staff={staff.map((s) => ({ id: s.id, name: s.name }))}
            referralBonus={rules.staffReferralBonus}
          />
        </Card>
      </div>
    </>
  );
}
