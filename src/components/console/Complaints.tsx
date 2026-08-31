import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Card,
  CardHeading,
  EmptyState,
  Kpi,
  KpiGrid,
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
import { formatDateFull, relativeDays } from '@/lib/util/format';
import { COMPLAINT_TYPE_LABEL } from '@/lib/util/labels';
import { ResolveComplaintForm } from './ResolveComplaintForm';

export async function ConsoleComplaints({
  session,
  canEscalate = true,
}: {
  session: Session;
  canEscalate?: boolean;
}) {
  const store = await getStore();
  const areaFilter = scopeAreaFilter(session.scope);

  const [complaints, areas, staff, customers] = await Promise.all([
    store.complaints.find({
      where: areaFilter as never,
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
    }),
    store.areas.find(),
    store.staff.find(),
    store.customers.find({ where: areaFilter as never }),
  ]);

  const areaById = new Map(areas.map((a) => [a.id, a]));
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const customerById = new Map(customers.map((c) => [c.id, c]));

  const open = complaints.filter((c) => c.status !== 'RESOLVED');
  const resolved = complaints.filter((c) => c.status === 'RESOLVED');

  const resolutionDays = resolved
    .filter((c) => c.resolvedAt)
    .map(
      (c) =>
        (new Date(c.resolvedAt!).getTime() - new Date(c.createdAt).getTime()) /
        86400000,
    );

  // A wash boy generating a disproportionate share of complaints is the single
  // most useful thing on this page, so compute it rather than making the
  // manager notice it by reading rows.
  const byStaff = new Map<string, number>();
  for (const complaint of complaints) {
    if (!complaint.staffId) continue;
    byStaff.set(complaint.staffId, (byStaff.get(complaint.staffId) ?? 0) + 1);
  }
  const worst = [...byStaff.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <>
      <PageHeader
        title="Complaints"
        description={`${open.length} open · ${resolved.length} resolved`}
      />

      <KpiGrid>
        <Kpi label="Open" value={open.length} tone={open.length ? 'danger' : 'teal'} />
        <Kpi
          label="Escalated"
          value={open.filter((c) => c.status === 'ESCALATED').length}
          tone="gold"
        />
        <Kpi label="Resolved" value={resolved.length} />
        <Kpi
          label="Avg resolution"
          value={
            resolutionDays.length
              ? `${(resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length).toFixed(1)}d`
              : '—'
          }
        />
        <Kpi
          label="Oldest open"
          value={open.length ? relativeDays(open[open.length - 1].createdAt) : '—'}
          tone={open.length ? 'gold' : 'default'}
        />
      </KpiGrid>

      {open.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No open complaints" hint="Nothing needs your reply." />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {open.slice(0, 12).map((complaint) => (
            <Card
              key={complaint.id}
              accent={complaint.status === 'ESCALATED' ? 'danger' : 'gold'}
              className="p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-extrabold">
                  {COMPLAINT_TYPE_LABEL[complaint.type]}
                </h3>
                <Tag tone={complaint.status === 'ESCALATED' ? 'bad' : 'warn'}>
                  {complaint.status === 'ESCALATED' ? 'Escalated' : 'Open'}
                </Tag>
              </div>

              <Row
                label="Customer"
                value={customerById.get(complaint.customerId)?.name ?? '—'}
              />
              <Row label="Area" value={areaById.get(complaint.areaId)?.name ?? '—'} />
              <Row
                label="Wash boy"
                value={
                  complaint.staffId
                    ? (staffById.get(complaint.staffId)?.name ?? '—')
                    : '—'
                }
              />
              <Row
                label="Raised"
                value={`${formatDateFull(complaint.createdAt)} · ${relativeDays(complaint.createdAt)}`}
              />

              <p className="my-3 rounded-lg bg-surface-muted p-3 text-sm italic text-ink-mute">
                “{complaint.body}”
              </p>

              <ResolveComplaintForm
                complaintId={complaint.id}
                canEscalate={canEscalate && complaint.status !== 'ESCALATED'}
              />
            </Card>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <CardHeading>Complaints by wash boy</CardHeading>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Wash boy</Th>
                  <Th>Complaints</Th>
                  <Th>Share</Th>
                </tr>
              </thead>
              <tbody>
                {worst.map(([staffId, count]) => (
                  <tr key={staffId}>
                    <Td className="font-bold">
                      {staffById.get(staffId)?.name ?? '—'}
                    </Td>
                    <Td
                      className={
                        count / complaints.length > 0.25
                          ? 'font-extrabold text-danger-500'
                          : ''
                      }
                    >
                      {count}
                    </Td>
                    <Td>
                      {complaints.length
                        ? `${Math.round((count / complaints.length) * 100)}%`
                        : '—'}
                    </Td>
                  </tr>
                ))}
                {worst.length === 0 ? (
                  <tr>
                    <Td className="py-6 text-center text-ink-mute" colSpan={3}>
                      No complaints attributed to staff.
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card className="p-4">
          <CardHeading>Recently resolved</CardHeading>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Customer</Th>
                  <Th>Issue</Th>
                  <Th>Resolution</Th>
                </tr>
              </thead>
              <tbody>
                {resolved.slice(0, 8).map((complaint) => (
                  <tr key={complaint.id}>
                    <Td className="whitespace-nowrap">
                      {formatDateFull(complaint.resolvedAt ?? complaint.createdAt)}
                    </Td>
                    <Td>{customerById.get(complaint.customerId)?.name ?? '—'}</Td>
                    <Td>{COMPLAINT_TYPE_LABEL[complaint.type]}</Td>
                    <Td className="text-ink-mute">{complaint.resolution ?? '—'}</Td>
                  </tr>
                ))}
                {resolved.length === 0 ? (
                  <tr>
                    <Td className="py-6 text-center text-ink-mute" colSpan={4}>
                      Nothing resolved yet.
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </div>
    </>
  );
}
