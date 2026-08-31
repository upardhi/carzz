import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Card,
  Kpi,
  KpiGrid,
  Note,
  Table,
  TableWrap,
  Tag,
  Td,
  Th,
} from '@/components/ui/primitives';
import { scopeAreaFilter } from '@/lib/auth/rbac';
import type { Session } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { formatClock, formatDateFull, formatTime, todayISO } from '@/lib/util/format';
import { MISS_REASON_LABEL } from '@/lib/util/labels';
import { ActionButton } from './ActionButton';
import { AssignSelect } from './AssignSelect';
import { Filters } from './Filters';

/**
 * The live picture of one day's work, and the place an absence gets covered.
 */
export async function ConsoleSchedule({
  session,
  searchParams,
}: {
  session: Session;
  searchParams: Record<string, string | undefined>;
}) {
  const store = await getStore();
  const date = searchParams.date ?? todayISO();
  const areaFilter = scopeAreaFilter(session.scope);

  const [visits, staff, areas] = await Promise.all([
    store.visits.find({
      where: { scheduledDate: date, ...areaFilter } as never,
      orderBy: [{ field: 'scheduledTime' }],
    }),
    store.staff.find({
      where: { role: 'EMPLOYEE', active: true, ...areaFilter } as never,
    }),
    store.areas.find(),
  ]);

  const filtered = visits.filter((v) => {
    if (searchParams.staff && v.staffId !== searchParams.staff) return false;
    if (searchParams.status && v.status !== searchParams.status) return false;
    if (searchParams.area && v.areaId !== searchParams.area) return false;
    return true;
  });

  const customerIds = [...new Set(filtered.map((v) => v.customerId))];
  const carIds = [...new Set(filtered.map((v) => v.carId))];
  const [customers, cars] = await Promise.all([
    Promise.all(customerIds.map((id) => store.customers.get(id))),
    Promise.all(carIds.map((id) => store.cars.get(id))),
  ]);
  const customerById = new Map(customers.filter(Boolean).map((c) => [c!.id, c!]));
  const carById = new Map(cars.filter(Boolean).map((c) => [c!.id, c!]));
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const areaById = new Map(areas.map((a) => [a.id, a]));

  const unassigned = visits.filter((v) => !v.staffId && v.status === 'PENDING');
  const attendance = await store.attendance.find({ where: { date } });
  const absent = staff.filter((s) => {
    const record = attendance.find((a) => a.staffId === s.id);
    return !record?.loginAt && record?.status !== 'PRESENT';
  });

  // Auto-assign works per area, so offer it for whichever area has the gap.
  const areaWithGaps = unassigned[0]?.areaId ?? null;

  return (
    <>
      <PageHeader
        title="Schedule"
        description={`${formatDateFull(date)} · ${visits.length} cars`}
      />

      <KpiGrid>
        <Kpi label="Cars" value={visits.length} />
        <Kpi
          label="Completed"
          value={visits.filter((v) => v.status === 'DONE').length}
          tone="success"
        />
        <Kpi
          label="In progress"
          value={visits.filter((v) => v.status === 'IN_PROGRESS').length}
        />
        <Kpi
          label="Not done"
          value={visits.filter((v) => v.status === 'MISSED').length}
          tone="gold"
        />
        <Kpi
          label="Unassigned"
          value={unassigned.length}
          tone={unassigned.length ? 'danger' : 'default'}
        />
        <Kpi label="Absent staff" value={absent.length} tone={absent.length ? 'gold' : 'default'} />
      </KpiGrid>

      {unassigned.length > 0 && areaWithGaps ? (
        <Card tone="danger" accent="danger" className="mt-4 p-4">
          <h3 className="text-sm font-extrabold">
            {unassigned.length} {unassigned.length === 1 ? 'car has' : 'cars have'} no wash boy
          </h3>
          <p className="mt-1 text-sm text-ink-mute">
            {absent.length > 0
              ? `${absent.map((s) => s.name.split(' ')[0]).join(', ')} ${absent.length === 1 ? 'is' : 'are'} absent today. `
              : ''}
            Auto-assign gives each car to whoever has the lightest round so far.
          </p>
          <div className="mt-3">
            <ActionButton
              endpoint="/api/ops/visits"
              size="md"
              payload={{ action: 'autoAssign', date, areaId: areaWithGaps }}
            >
              Auto-assign in {areaById.get(areaWithGaps)?.name ?? 'this area'}
            </ActionButton>
          </div>
        </Card>
      ) : null}

      <div className="mt-4">
        <Filters
          filters={[
            {
              name: 'status',
              label: 'Status — all',
              options: [
                { value: 'PENDING', label: 'Pending' },
                { value: 'IN_PROGRESS', label: 'In progress' },
                { value: 'DONE', label: 'Done' },
                { value: 'MISSED', label: 'Not done' },
              ],
            },
            {
              name: 'staff',
              label: 'Staff — all',
              options: staff.map((s) => ({ value: s.id, label: s.name })),
            },
            ...(session.scope.areaIds && session.scope.areaIds.length > 1
              ? [
                  {
                    name: 'area',
                    label: 'Area — all',
                    options: areas
                      .filter((a) => session.scope.areaIds!.includes(a.id))
                      .map((a) => ({ value: a.id, label: a.name })),
                  },
                ]
              : []),
          ]}
        />
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>Time</Th>
              <Th>Customer</Th>
              <Th>Car</Th>
              <Th>Area</Th>
              <Th>Wash boy</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((visit) => {
              const customer = customerById.get(visit.customerId);
              const car = carById.get(visit.carId);
              return (
                <tr key={visit.id}>
                  <Td className="whitespace-nowrap font-bold">
                    {formatTime(visit.scheduledTime)}
                  </Td>
                  <Td>{customer?.name ?? '—'}</Td>
                  <Td className="whitespace-nowrap">
                    {car ? `${car.model} · ${car.plate}` : '—'}
                  </Td>
                  <Td>{areaById.get(visit.areaId)?.name ?? '—'}</Td>
                  <Td>
                    {visit.status === 'DONE' || visit.status === 'MISSED' ? (
                      (visit.staffId && staffById.get(visit.staffId)?.name) || '—'
                    ) : (
                      <AssignSelect
                        visitId={visit.id}
                        current={visit.staffId}
                        staff={staff
                          .filter((s) => s.areaId === visit.areaId)
                          .map((s) => ({ id: s.id, name: s.name }))}
                      />
                    )}
                  </Td>
                  <Td>
                    {visit.status === 'DONE' ? (
                      <Tag tone="ok">Done {formatClock(visit.completedAt)}</Tag>
                    ) : visit.status === 'MISSED' ? (
                      <Tag tone="warn">
                        {visit.missReason
                          ? MISS_REASON_LABEL[visit.missReason]
                          : 'Not done'}
                      </Tag>
                    ) : visit.status === 'IN_PROGRESS' ? (
                      <Tag tone="info">In progress</Tag>
                    ) : visit.staffId ? (
                      <Tag tone="neutral">Pending</Tag>
                    ) : (
                      <Tag tone="bad">No staff</Tag>
                    )}
                  </Td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <Td className="py-8 text-center text-ink-mute" colSpan={6}>
                  No cars match these filters on {formatDateFull(date)}.
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </TableWrap>

      <div className="mt-3">
        <Note tone="brand">
          A wash boy can only be given cars in his own area. Reassigning tells
          both the customer and the staff member.
        </Note>
      </div>
    </>
  );
}
