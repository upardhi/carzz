import Link from 'next/link';
import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Card,
  Kpi,
  KpiGrid,
  Row,
  Table,
  TableWrap,
  Tag,
  Td,
  Th,
} from '@/components/ui/primitives';
import type { Session } from '@/lib/auth/server';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import { getStore } from '@/lib/data';
import { loadRedAlerts } from '@/lib/services/accounts';
import { areaPerformance } from '@/lib/services/reports';
import {
  currentCycle,
  cycleLabel,
  formatClock,
  money,
  moneyShort,
  todayISO,
} from '@/lib/util/format';

/**
 * The manager's 8 AM screen.
 *
 * It answers only the three questions that actually stop work: who has no wash
 * boy, who has not been washed, and who has not paid. Everything else is a
 * click away rather than competing for attention here.
 */
export async function ConsoleDashboard({
  session,
  base,
}: {
  session: Session;
  base: string;
}) {
  const store = await getStore();
  const cycle = currentCycle();
  const today = todayISO();
  const areaFilter = scopeAreaFilter(session.scope);

  const [visits, alerts, complaints, staff, performance] = await Promise.all([
    store.visits.find({ where: { scheduledDate: today, ...areaFilter } as never }),
    loadRedAlerts(store, session.scope.areaIds),
    store.complaints.find({
      where: { status: { in: ['OPEN', 'ESCALATED'] }, ...areaFilter } as never,
      orderBy: [{ field: 'createdAt' }],
    }),
    store.staff.find({ where: { role: 'EMPLOYEE', ...areaFilter } as never }),
    areaPerformance(store, cycle, session.scope.areaIds),
  ]);

  const attendance = await store.attendance.find({ where: { date: today } });
  const attendanceByStaff = new Map(attendance.map((a) => [a.staffId, a]));

  const unassigned = visits.filter((v) => !v.staffId && v.status === 'PENDING');
  const done = visits.filter((v) => v.status === 'DONE').length;
  const missed = visits.filter((v) => v.status === 'MISSED').length;
  const outstanding = alerts.reduce((sum, a) => sum + a.amount, 0);

  const totals = performance.reduce(
    (acc, area) => ({
      customers: acc.customers + area.customers,
      washesDone: acc.washesDone + area.washesDone,
      washesMissed: acc.washesMissed + area.washesMissed,
      collected: acc.collected + area.collected,
    }),
    { customers: 0, washesDone: 0, washesMissed: 0, collected: 0 },
  );

  const staffToday = staff
    .map((member) => {
      const own = visits.filter((v) => v.staffId === member.id);
      return {
        member,
        attendance: attendanceByStaff.get(member.id),
        assigned: own.length,
        done: own.filter((v) => v.status === 'DONE').length,
      };
    })
    .sort((a, b) => b.assigned - a.assigned);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${cycleLabel(cycle)} · ${session.scope.areaIds?.length ?? 'all'} ${
          session.scope.areaIds?.length === 1 ? 'area' : 'areas'
        }`}
      />

      <KpiGrid>
        <Kpi label="Active customers" value={totals.customers} />
        <Kpi label="Cars today" value={visits.length} />
        <Kpi label="Completed" value={done} tone="teal" />
        <Kpi label="Not done" value={missed} tone={missed ? 'gold' : 'default'} />
        <Kpi
          label="Unassigned"
          value={unassigned.length}
          tone={unassigned.length ? 'danger' : 'default'}
        />
        <Kpi
          label="Outstanding"
          value={moneyShort(outstanding)}
          tone={outstanding ? 'gold' : 'default'}
        />
      </KpiGrid>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-extrabold">Needs you right now</h3>

          {unassigned.length === 0 && alerts.length === 0 && complaints.length === 0 ? (
            <p className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-6 text-center text-sm font-semibold text-teal-700">
              Nothing is blocking work. Every car has a wash boy, every customer
              is paid up.
            </p>
          ) : null}

          {unassigned.length > 0 ? (
            <Link href={`${base}/schedule`} className="mb-2 block">
              <div className="rounded-lg border border-line border-l-4 border-l-danger-500 bg-white p-3 hover:bg-surface-muted">
                <b className="text-sm">
                  {unassigned.length} {unassigned.length === 1 ? 'car has' : 'cars have'} no
                  wash boy today
                </b>
                <p className="mt-0.5 text-xs text-ink-mute">
                  Open the schedule to assign or auto-assign them.
                </p>
              </div>
            </Link>
          ) : null}

          {alerts.length > 0 ? (
            <Link href={`${base}/alerts`} className="mb-2 block">
              <div className="rounded-lg border border-line border-l-4 border-l-gold-500 bg-white p-3 hover:bg-surface-muted">
                <b className="text-sm">
                  {alerts.length} customers to chase — {money(outstanding)}
                </b>
                <p className="mt-0.5 text-xs text-ink-mute">
                  Oldest is {alerts[0].daysOverdue} days overdue.
                </p>
              </div>
            </Link>
          ) : null}

          {complaints.length > 0 ? (
            <Link href={`${base}/complaints`} className="block">
              <div className="rounded-lg border border-line border-l-4 border-l-teal-500 bg-white p-3 hover:bg-surface-muted">
                <b className="text-sm">{complaints.length} open complaints</b>
                <p className="mt-0.5 text-xs text-ink-mute">
                  {complaints.filter((c) => c.status === 'ESCALATED').length} escalated
                  to the owner.
                </p>
              </div>
            </Link>
          ) : null}
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-extrabold">Staff today</h3>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Signed in</Th>
                  <Th>Cars</Th>
                  <Th>Done</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {staffToday.map((row) => {
                  const absent =
                    !row.attendance?.loginAt && row.attendance?.status !== 'PRESENT';
                  return (
                    <tr key={row.member.id}>
                      <Td className="font-bold">{row.member.name}</Td>
                      <Td>
                        {row.attendance?.loginAt
                          ? formatClock(row.attendance.loginAt)
                          : '—'}
                      </Td>
                      <Td>{row.assigned}</Td>
                      <Td>{row.done}</Td>
                      <Td>
                        <Tag tone={absent ? 'bad' : 'ok'}>
                          {absent ? 'Absent' : 'Working'}
                        </Tag>
                      </Td>
                    </tr>
                  );
                })}
                {staffToday.length === 0 ? (
                  <tr>
                    <Td className="text-center text-ink-mute" colSpan={5}>
                      No staff in your area yet.
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-extrabold">
            This month — {cycleLabel(cycle)}
          </h3>
          <Row label="Washes completed" value={totals.washesDone} />
          <Row label="Washes missed" value={totals.washesMissed} tone={totals.washesMissed ? 'gold' : undefined} />
          <Row label="Collection" value={money(totals.collected)} tone="teal" />
          <Row label="Outstanding" value={money(outstanding)} tone={outstanding ? 'danger' : undefined} />
          <Row
            label="Average rating"
            value={
              performance.some((p) => p.averageRating > 0)
                ? `${(
                    performance.reduce((s, p) => s + p.averageRating, 0) /
                    performance.filter((p) => p.averageRating > 0).length
                  ).toFixed(1)} ★`
                : '—'
            }
          />
        </Card>

        {performance.length > 1 ? (
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-extrabold">Your areas</h3>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Area</Th>
                    <Th>Customers</Th>
                    <Th>Collected</Th>
                    <Th>Missed</Th>
                    <Th>Rating</Th>
                  </tr>
                </thead>
                <tbody>
                  {performance.map((area) => (
                    <tr key={area.area.id}>
                      <Td className="font-bold">{area.area.name}</Td>
                      <Td>{area.customers}</Td>
                      <Td>{moneyShort(area.collected)}</Td>
                      <Td className={area.washesMissed > 30 ? 'text-danger-500 font-bold' : ''}>
                        {area.washesMissed}
                      </Td>
                      <Td>{area.averageRating ? area.averageRating.toFixed(1) : '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        ) : null}
      </div>
    </>
  );
}
