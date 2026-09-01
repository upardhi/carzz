import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Card,
  CardHeading,
  Table,
  TableWrap,
  Td,
  Th,
} from '@/components/ui/primitives';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import type { Session } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { formatDateFull } from '@/lib/util/format';
import { COMPLAINT_TYPE_LABEL } from '@/lib/util/labels';
import { ComplaintsClient } from './ComplaintsClient';

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

  const staffById = new Map(staff.map((s) => [s.id, s]));
  const customerById = new Map(customers.map((c) => [c.id, c]));

  const open = complaints.filter((c) => c.status !== 'RESOLVED');
  const resolved = complaints.filter((c) => c.status === 'RESOLVED');

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

      <ComplaintsClient
        complaints={complaints}
        areas={areas}
        staff={staff}
        customers={customers}
        canEscalate={canEscalate}
      />

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
