import { PageHeader } from '@/components/shell/ConsoleShell';
import { WidgetTable } from '@/components/ui/WidgetTable';
import type { Complaint } from '@/lib/data/types';
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

  const [complaints, areas, staff] = await Promise.all([
    store.complaints.find({
      where: areaFilter as never,
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
    }),
    store.areas.find(),
    store.staff.find(),
  ]);

  const customerIds = [...new Set(complaints.map((c) => c.customerId))];
  const customers = customerIds.length
    ? await store.customers.find({ where: { id: { in: customerIds } } as never })
    : [];

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
        <WidgetTable<[string, number]>
          title="Complaints by wash boy"
          data={worst}
          keyExtractor={([staffId]) => staffId}
          emptyMessage="No complaints attributed to staff."
          columns={[
            {
              id: 'staff',
              header: 'WASH BOY',
              className: 'font-bold text-navy-950',
              render: ([staffId]) => staffById.get(staffId)?.name ?? '—',
            },
            {
              id: 'count',
              header: 'COMPLAINTS',
              align: 'center',
              render: ([, count]) => (
                <span
                  className={
                    count / complaints.length > 0.25
                      ? 'font-extrabold text-rose-600'
                      : 'font-semibold text-slate-700'
                  }
                >
                  {count}
                </span>
              ),
            },
            {
              id: 'share',
              header: 'SHARE',
              align: 'right',
              render: ([, count]) =>
                complaints.length
                  ? `${Math.round((count / complaints.length) * 100)}%`
                  : '—',
            },
          ]}
        />

        <WidgetTable<Complaint>
          title="Recently resolved"
          data={resolved.slice(0, 8)}
          keyExtractor={(complaint) => complaint.id}
          emptyMessage="Nothing resolved yet."
          columns={[
            {
              id: 'date',
              header: 'DATE',
              className: 'whitespace-nowrap',
              render: (complaint) =>
                formatDateFull(complaint.resolvedAt ?? complaint.createdAt),
            },
            {
              id: 'customer',
              header: 'CUSTOMER',
              className: 'font-medium text-navy-950',
              render: (complaint) =>
                customerById.get(complaint.customerId)?.name ?? '—',
            },
            {
              id: 'issue',
              header: 'ISSUE',
              render: (complaint) => COMPLAINT_TYPE_LABEL[complaint.type],
            },
            {
              id: 'resolution',
              header: 'RESOLUTION',
              className: 'text-slate-500',
              render: (complaint) => complaint.resolution ?? '—',
            },
          ]}
        />
      </div>
    </>
  );
}
