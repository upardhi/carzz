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

  const [complaints, _totalMatching, countOpen, countResolved, areas, staff, regions] = await Promise.all([
    store.complaints.find({
      where: areaFilter as never,
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
      limit: 6,
      offset: 0,
    }),
    store.complaints.count(areaFilter as never),
    store.complaints.count({ ...(areaFilter as object), status: 'OPEN' } as never),
    store.complaints.count({ ...(areaFilter as object), status: 'RESOLVED' } as never),
    store.areas.find(),
    store.staff.find(),
    store.regions.find({ orderBy: [{ field: 'name' }] }),
  ]);

  const customerIds = [...new Set(complaints.map((c) => c.customerId))];
  const visitIds = [...new Set(complaints.map((c) => c.visitId).filter(Boolean))] as string[];
  
  const [customers, visits] = await Promise.all([
    customerIds.length
      ? store.customers.find({ where: { id: { in: customerIds } } as never })
      : [],
    visitIds.length
      ? store.visits.find({ where: { id: { in: visitIds } } as never })
      : [],
  ]);

  const staffById = new Map(staff.map((s) => [s.id, s]));
  const customerById = new Map(customers.map((c) => [c.id, c]));

  // Wash boy complaint attribution from recent database sample. A complaint
  // tied to a visit missed for an external, no-fault reason (bad weather, no
  // water/access, an unreachable or car-not-available customer) shouldn't
  // count against the wash boy the way a quality or behaviour complaint
  // does — otherwise this leaderboard blames staff for the weather.
  const NO_FAULT_MISS_REASONS = new Set([
    'WEATHER',
    'NO_WATER_OR_ACCESS',
    'CUSTOMER_UNREACHABLE',
    'CUSTOMER_SKIPPED',
    'CAR_NOT_AVAILABLE',
  ]);
  const recentAttributionSample = await store.complaints.find({
    where: areaFilter as never,
    limit: 100,
  });
  const attributionVisitIds = [
    ...new Set(recentAttributionSample.map((c) => c.visitId).filter(Boolean)),
  ] as string[];
  const attributionVisits = attributionVisitIds.length
    ? await store.visits.find({ where: { id: { in: attributionVisitIds } } as never })
    : [];
  const missReasonByVisitId = new Map(attributionVisits.map((v) => [v.id, v.missReason]));

  const byStaff = new Map<string, number>();
  for (const complaint of recentAttributionSample) {
    if (!complaint.staffId) continue;
    const missReason = complaint.visitId ? missReasonByVisitId.get(complaint.visitId) : null;
    if (missReason && NO_FAULT_MISS_REASONS.has(missReason)) continue;
    byStaff.set(complaint.staffId, (byStaff.get(complaint.staffId) ?? 0) + 1);
  }
  const worst = [...byStaff.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const totalAttributed = [...byStaff.values()].reduce((sum, n) => sum + n, 0);

  const resolved = await store.complaints.find({
    where: { ...(areaFilter as object), status: 'RESOLVED' } as never,
    orderBy: [{ field: 'resolvedAt', dir: 'desc' }],
    limit: 8,
  });

  return (
    <>
      <PageHeader
        title="Complaints"
        description={`${countOpen} open · ${countResolved} resolved`}
      />

      <ComplaintsClient
        complaints={complaints}
        areas={areas}
        regions={regions}
        staff={staff}
        customers={customers}
        visits={visits}
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
                    count / totalAttributed > 0.25
                      ? 'font-bold text-rose-600'
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
                totalAttributed
                  ? `${Math.round((count / totalAttributed) * 100)}%`
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
