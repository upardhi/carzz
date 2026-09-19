import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  ButtonLink,
  Card,
  CardHeading,
  Note,
  Row,
  Tag,
} from '@/components/ui/primitives';
import { WidgetTable } from '@/components/ui/WidgetTable';
import { canSeeArea } from '@/lib/auth/rbac';
import type { Session } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { loadCustomerAccount } from '@/lib/services/accounts';
import { parsePackageServices } from '@/lib/data/types';
import {
  currentCycle,
  formatClock,
  formatDateFull,
  formatTime,
  money,
} from '@/lib/util/format';
import {
  LEAD_SOURCE_LABEL,
  MISS_REASON_LABEL,
  PATTERN_LABEL,
  PAYMENT_MODE_LABEL,
} from '@/lib/util/labels';
import { ActionButton } from './ActionButton';
import { CustomerLoginAction } from './CustomerLoginAction';
import { RecordPaymentForm } from './RecordPaymentForm';
import { StartCarServiceAction } from './StartCarServiceAction';
import { WashTodayAction } from './WashTodayAction';
import { QuickAssignStaff } from './QuickAssignStaff';
import {
  AddCarModalButton,
  DeleteCarButton,
  EditCarModalButton,
  EditCustomerModalButton,
} from './EditCustomerActions';

export async function ConsoleCustomerDetail({
  session,
  base,
  customerId,
}: {
  session: Session;
  base: string;
  customerId: string;
}) {
  const store = await getStore();
  const cycle = currentCycle();
  const account = await loadCustomerAccount(store, customerId, cycle);
  // Scope is checked on the loaded record, not on the URL, so another area's
  // customer is a 404 rather than a redirect that confirms they exist.
  if (!account || !canSeeArea(session.scope, account.customer.areaId)) notFound();

  const { customer, cars, visits, payments, invoices } = account;
  const [area, staff, user, allAreas, allPackages] = await Promise.all([
    store.areas.get(customer.areaId),
    store.staff.find({ where: { areaId: customer.areaId, role: 'EMPLOYEE' } }),
    customer.userId ? store.users.get(customer.userId) : Promise.resolve(null),
    store.areas.find(),
    store.packages.find(),
  ]);
  const staffById = new Map(staff.map((s) => [s.id, s]));

  const history = visits
    .filter((v) => v.status !== 'PENDING')
    .slice(0, 12);

  return (
    <>
      <PageHeader
        title={customer.name}
        description={`${area?.name ?? ''} · joined ${formatDateFull(customer.joinedOn)} · ${LEAD_SOURCE_LABEL[customer.source]}`}
        actions={
          <div className="flex items-center gap-2">
            <EditCustomerModalButton customer={customer} areas={allAreas} />
            <ButtonLink href={`${base}/customers`} variant="secondary" size="sm">
              ← All customers
            </ButtonLink>
          </div>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="p-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <CardHeading>Details</CardHeading>
            <EditCustomerModalButton customer={customer} areas={allAreas} />
          </div>
          <Row label="WhatsApp" value={customer.phone} />
          {customer.altPhone ? (
            <Row label="Alternate" value={customer.altPhone} />
          ) : null}
          <Row
            label="Address"
            value={
              customer.lat !== null && customer.lat !== undefined && customer.lng !== null && customer.lng !== undefined ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${customer.lat},${customer.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold text-slate-900"
                >
                  <span>{customer.address}</span>
                  <span className="text-[10px] text-blue-600 font-bold">📍 ↗</span>
                </a>
              ) : (
                customer.address
              )
            }
          />
          {customer.landmark ? (
            <Row label="Landmark" value={customer.landmark} />
          ) : null}
          <Row
            label="Status"
            value={
              <Tag
                tone={
                  customer.status === 'ACTIVE'
                    ? 'ok'
                    : customer.status === 'HOLD'
                      ? 'warn'
                      : 'neutral'
                }
              >
                {customer.status}
              </Tag>
            }
          />
          <Row
            label="App Login"
            value={
              user ? (
                <span className="font-mono text-xs font-semibold text-blue-600">
                  {user.email}
                </span>
              ) : (
                <Tag tone="neutral">No app login</Tag>
              )
            }
          />
          {customer.note ? <Row label="Note" value={customer.note} /> : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <CustomerLoginAction
              customerId={customer.id}
              customerName={customer.name}
              hasLogin={Boolean(customer.userId)}
              userEmail={user?.email}
            />
            {customer.status !== 'ACTIVE' ? (
              <ActionButton
                endpoint="/api/ops/customers"
                payload={{ action: 'setStatus', customerId, status: 'ACTIVE' }}
              >
                Reactivate
              </ActionButton>
            ) : (
              <ActionButton
                endpoint="/api/ops/customers"
                variant="secondary"
                payload={{ action: 'setStatus', customerId, status: 'HOLD' }}
                confirm="Put this customer on hold? Their upcoming washes will be unassigned."
              >
                Put on hold
              </ActionButton>
            )}
            {customer.status !== 'INACTIVE' ? (
              <ActionButton
                endpoint="/api/ops/customers"
                variant="danger"
                payload={{ action: 'setStatus', customerId, status: 'INACTIVE' }}
                confirm="Make this customer inactive? Their upcoming washes will be unassigned."
              >
                Set inactive
              </ActionButton>
            ) : null}
          </div>
        </Card>

        <Card className="p-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <CardHeading>Cars on this account ({cars.length})</CardHeading>
            <AddCarModalButton
              customerId={customer.id}
              packages={allPackages}
              staffList={staff}
            />
          </div>
          {cars.map((car) => {
            const isStarted = car.serviceStarted ?? true;
            return (
              <div
                key={car.id}
                className="mb-3 rounded-lg border border-line bg-white p-3.5 last:mb-0 shadow-xs"
              >
                <div className="flex flex-col gap-3 border-b border-line/60 pb-3 mb-3 min-w-0">
                  <b className="text-base font-bold text-ink min-w-0 break-words">
                    {car.make} {car.model} — {car.plate}
                  </b>
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    {isStarted ? (
                      car.serviceStartedBeforePayment ? (
                        <Tag tone="warn">Started Before Payment (Override)</Tag>
                      ) : (
                        <Tag tone="ok">Active · Prepaid</Tag>
                      )
                    ) : (
                      <Tag tone="warn">Pending Payment · Not Started</Tag>
                    )}
                    {isStarted && (
                      <WashTodayAction
                        customerId={customer.id}
                        carId={car.id}
                        carName={`${car.make} ${car.model}`}
                        carPlate={car.plate}
                        currentAssignedStaffId={car.assignedStaffId}
                        staffList={staff}
                      />
                    )}
                    <EditCarModalButton
                      customerId={customer.id}
                      car={car}
                      packages={allPackages}
                      staffList={staff}
                    />
                    <DeleteCarButton
                      customerId={customer.id}
                      carId={car.id}
                      carName={`${car.make} ${car.model}`}
                    />
                  </div>
                </div>

                <Row label="Package" value={car.package?.name ?? '—'} />
                <Row
                  label="Washes this month"
                  value={
                    isStarted
                      ? `${car.tally.done} of ${car.package?.washesPerMonth ?? 0}`
                      : 'Washes not started yet'
                  }
                />
                <Row
                  label="Slot"
                  value={`${PATTERN_LABEL[car.schedulePattern]} · ${formatTime(car.scheduleTime)}`}
                />
                <Row
                  label="Wash boy"
                  value={
                    <div className="flex flex-wrap items-center gap-2 justify-end min-w-0">
                      <QuickAssignStaff
                        customerId={customer.id}
                        carId={car.id}
                        currentStaffId={car.assignedStaffId}
                        staffList={staff}
                      />
                    </div>
                  }
                />

                {/* Package Sub-Services Breakdown */}
                {(() => {
                  const parsedServices = parsePackageServices(
                    car.package?.services,
                    car.package?.washesPerMonth ?? 8,
                  );
                  if (parsedServices.length === 0) return null;

                  const completedThisCycle = visits.filter(
                    (v) => v.carId === car.id && v.cycle === cycle && v.status === 'DONE',
                  );

                  return (
                    <div className="mt-2.5 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-xs">
                      <div className="font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                        <span>Package Services ({cycle})</span>
                        <span className="text-[10.5px] text-slate-500 font-normal">Quota & Done</span>
                      </div>
                      <div className="space-y-1.5">
                        {parsedServices.map((svc) => {
                          const doneCount = completedThisCycle.filter(
                            (v) =>
                              Array.isArray(v.servicesDone) &&
                              v.servicesDone.some(
                                (n) =>
                                  n.trim().toLowerCase() === svc.name.trim().toLowerCase() ||
                                  n.trim().toLowerCase().includes(svc.name.trim().toLowerCase()),
                              ),
                          ).length;
                          const isMet = doneCount >= svc.washesPerMonth;

                          return (
                            <div
                              key={svc.name}
                              className="flex items-center justify-between gap-2 text-[11px]"
                            >
                              <span className="font-medium text-slate-700 truncate">
                                {svc.name}
                              </span>
                              <span
                                className={`font-mono font-semibold px-1.5 py-0.5 rounded text-[10px] shrink-0 ${
                                  isMet
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}
                              >
                                {doneCount} / {svc.washesPerMonth} {isMet ? '✓' : ''}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Audit Trail Info for Started Before Payment */}
                {isStarted && car.serviceStartedBeforePayment && (
                  <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50/80 p-2.5 text-xs text-amber-950">
                    <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                      <span>⚠️ Service Started Before Payment (Owner Audit Trail)</span>
                    </div>
                    <div className="mt-1.5 text-[11px] text-amber-900 space-y-1">
                      <div>
                        <span className="font-medium text-amber-950">Authorized by:</span>{' '}
                        {car.serviceStartedByUser
                          ? `${car.serviceStartedByUser.name} (${car.serviceStartedByUser.role})`
                          : 'Staff / Manager'}
                      </div>
                      {car.serviceStartedAt && (
                        <div>
                          <span className="font-medium text-amber-950">Started on:</span>{' '}
                          {formatDateFull(car.serviceStartedAt)}
                        </div>
                      )}
                      {car.serviceStartNote && (
                        <div>
                          <span className="font-medium text-amber-950">Reason / Note:</span>{' '}
                          {car.serviceStartNote}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Manual Start Service Action for Pending Cars */}
                {!isStarted && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-2.5">
                    <span className="text-[11px] text-slate-500 max-w-xs">
                      Prepaid package pending. Washes will auto-start on payment or can be started manually by manager.
                    </span>
                    <StartCarServiceAction
                      customerId={customer.id}
                      carId={car.id}
                      carName={`${car.make} ${car.model}`}
                      carPlate={car.plate}
                      currentAssignedStaffId={car.assignedStaffId}
                      staffList={staff}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </Card>

        <Card className="p-4 min-w-0">
          <CardHeading>Payment — whole account</CardHeading>
          <Row label="Monthly package" value={money(account.monthly)} />
          <Row label="Advance deposited" value={money(account.advanceDeposited)} />
          <Row label="Total paid" value={money(account.totalPaid)} />
          <Row
            label="Balance"
            value={money(Math.max(0, account.balance))}
            tone="success"
          />
          <Row
            label="Outstanding"
            value={money(account.outstanding)}
            tone={account.outstanding > 0 ? 'danger' : undefined}
          />
          {account.nextDue ? (
            <Row
              label="Next due"
              value={`${formatDateFull(account.nextDue.dueOn)} · ${money(
                account.nextDue.amount - account.nextDue.paidAmount,
              )}`}
            />
          ) : null}

          <div className="mt-3">
            <RecordPaymentForm
              customerId={customerId}
              suggested={account.outstanding || account.monthly}
            />
          </div>
        </Card>

        <div className="flex flex-col justify-between lg:col-span-2 min-w-0">
          <WidgetTable<(typeof history)[number]>
            title="Recent washes"
            data={history}
            keyExtractor={(visit) => visit.id}
            emptyMessage="No washes recorded yet."
            columns={[
              {
                id: 'date',
                header: 'DATE',
                render: (visit) => (
                  <span className="whitespace-nowrap text-slate-700">
                    {formatDateFull(visit.scheduledDate)}
                    {visit.completedAt ? (
                      <span className="ml-1 text-slate-400">
                        {formatClock(visit.completedAt)}
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                id: 'car',
                header: 'CAR',
                render: (visit) => {
                  const car = cars.find((c) => c.id === visit.carId);
                  return car?.model ?? '—';
                },
              },
              {
                id: 'washBoy',
                header: 'WASH BOY',
                render: (visit) =>
                  visit.staffId ? (staffById.get(visit.staffId)?.name ?? '—') : '—',
              },
              {
                id: 'services',
                header: 'SERVICES DONE',
                render: (visit) => {
                  if (visit.status !== 'DONE') {
                    return <span className="text-slate-400">—</span>;
                  }
                  if (!Array.isArray(visit.servicesDone) || visit.servicesDone.length === 0) {
                    return <span className="text-xs text-slate-500">Wash</span>;
                  }
                  return (
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {visit.servicesDone.map((svc) => (
                        <span
                          key={svc}
                          className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                        >
                          ✓ {svc}
                        </span>
                      ))}
                    </div>
                  );
                },
              },
              {
                id: 'photos',
                header: 'PHOTOS',
                align: 'center',
                render: (visit) =>
                  visit.beforePhotoUrl && visit.afterPhotoUrl ? (
                    <Tag tone="ok">Both</Tag>
                  ) : (
                    <span className="text-slate-400">—</span>
                  ),
              },
              {
                id: 'rating',
                header: 'RATING',
                align: 'center',
                render: (visit) => (visit.rating ? `${visit.rating} ★` : '—'),
              },
              {
                id: 'status',
                header: 'STATUS',
                align: 'right',
                render: (visit) =>
                  visit.status === 'DONE' ? (
                    <Tag tone="ok">Done</Tag>
                  ) : (
                    <Tag tone="warn">
                      {visit.missReason
                        ? MISS_REASON_LABEL[visit.missReason]
                        : 'Not done'}
                    </Tag>
                  ),
              },
            ]}
          />
          {visits.some((v) => v.rescheduledToVisitId) ? (
            <div className="mt-2">
              <Note tone="success">
                Missed washes on this account were returned to the customer’s
                count and rescheduled — they were not lost.
              </Note>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col justify-between min-w-0">
          <WidgetTable<(typeof payments)[number]>
            title="Payment history"
            data={payments.slice(0, 10)}
            keyExtractor={(payment) => payment.id}
            emptyMessage="No payments recorded."
            columns={[
              {
                id: 'date',
                header: 'DATE',
                className: 'whitespace-nowrap text-slate-700',
                render: (payment) => formatDateFull(payment.createdAt),
              },
              {
                id: 'amount',
                header: 'AMOUNT',
                className: 'font-bold text-slate-900',
                render: (payment) => money(payment.amount),
              },
              {
                id: 'mode',
                header: 'MODE',
                render: (payment) => PAYMENT_MODE_LABEL[payment.mode],
              },
              {
                id: 'status',
                header: 'STATUS',
                align: 'right',
                render: (payment) => (
                  <Tag tone={payment.status === 'CONFIRMED' ? 'ok' : 'warn'}>
                    {payment.kind === 'ADVANCE'
                      ? 'Advance'
                      : payment.status === 'CONFIRMED'
                        ? 'Paid'
                        : 'To confirm'}
                  </Tag>
                ),
              },
            ]}
          />

          {payments.some((p) => p.status === 'PENDING') ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-bold text-gold-700">
                Declared by the customer, waiting for you to confirm the money
                arrived:
              </p>
              {payments
                .filter((p) => p.status === 'PENDING')
                .map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gold-200 bg-gold-50 p-2.5"
                  >
                    <span className="text-sm font-bold">
                      {money(payment.amount)} · {PAYMENT_MODE_LABEL[payment.mode]}
                    </span>
                    <ActionButton
                      endpoint="/api/ops/payments"
                      payload={{ action: 'confirm', paymentId: payment.id }}
                    >
                      Confirm received
                    </ActionButton>
                  </div>
                ))}
            </div>
          ) : null}
        </div>

        <Card className="p-4 min-w-0">
          <CardHeading>Invoices</CardHeading>
          {invoices.slice(0, 6).map((invoice) => (
            <Row
              key={invoice.id}
              label={`${invoice.cycle} · due ${formatDateFull(invoice.dueOn)}`}
              value={
                <span className="inline-flex items-center gap-2">
                  {money(invoice.amount)}
                  <Tag
                    tone={
                      invoice.status === 'PAID'
                        ? 'ok'
                        : invoice.status === 'PARTIAL'
                          ? 'warn'
                          : 'bad'
                    }
                  >
                    {invoice.status}
                  </Tag>
                </span>
              }
            />
          ))}
        </Card>
      </div>
    </>
  );
}
