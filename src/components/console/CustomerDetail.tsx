import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  ButtonLink,
  Card,
  CardHeading,
  Note,
  Row,
  Table,
  TableWrap,
  Tag,
  Td,
  Th,
} from '@/components/ui/primitives';
import { canSeeArea } from '@/lib/auth/rbac';
import type { Session } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { loadCustomerAccount } from '@/lib/services/accounts';
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
import { RecordPaymentForm } from './RecordPaymentForm';

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
  const [area, staff] = await Promise.all([
    store.areas.get(customer.areaId),
    store.staff.find({ where: { areaId: customer.areaId, role: 'EMPLOYEE' } }),
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
          <ButtonLink href={`${base}/customers`} variant="secondary" size="sm">
            ← All customers
          </ButtonLink>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="p-4">
          <CardHeading>Details</CardHeading>
          <Row label="WhatsApp" value={customer.phone} />
          {customer.altPhone ? (
            <Row label="Alternate" value={customer.altPhone} />
          ) : null}
          <Row label="Address" value={customer.address} />
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
          {customer.note ? <Row label="Note" value={customer.note} /> : null}

          <div className="mt-3 flex flex-wrap gap-2">
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

        <Card className="p-4">
          <CardHeading>Cars on this account ({cars.length})</CardHeading>
          {cars.map((car) => (
            <div
              key={car.id}
              className="mb-2 rounded-lg border border-line bg-white p-3 last:mb-0"
            >
              <b className="text-sm">
                {car.make} {car.model} — {car.plate}
              </b>
              <Row label="Package" value={car.package?.name ?? '—'} />
              <Row
                label="Washes this month"
                value={`${car.tally.done} of ${car.package?.washesPerMonth ?? 0}`}
              />
              <Row
                label="Slot"
                value={`${PATTERN_LABEL[car.schedulePattern]} · ${formatTime(car.scheduleTime)}`}
              />
              <Row
                label="Wash boy"
                value={
                  car.assignedStaffId
                    ? (staffById.get(car.assignedStaffId)?.name ?? '—')
                    : 'Unassigned'
                }
                tone={car.assignedStaffId ? undefined : 'danger'}
              />
            </div>
          ))}
        </Card>

        <Card className="p-4">
          <CardHeading>Payment — whole account</CardHeading>
          <Row label="Monthly package" value={money(account.monthly)} />
          <Row label="Advance deposited" value={money(account.advanceDeposited)} />
          <Row label="Total paid" value={money(account.totalPaid)} />
          <Row
            label="Balance"
            value={money(Math.max(0, account.balance))}
            tone="teal"
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

        <Card className="p-4 lg:col-span-2">
          <CardHeading>Recent washes</CardHeading>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Car</Th>
                  <Th>Wash boy</Th>
                  <Th>Photos</Th>
                  <Th>Rating</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {history.map((visit) => {
                  const car = cars.find((c) => c.id === visit.carId);
                  return (
                    <tr key={visit.id}>
                      <Td className="whitespace-nowrap">
                        {formatDateFull(visit.scheduledDate)}
                        {visit.completedAt ? (
                          <span className="ml-1 text-ink-faint">
                            {formatClock(visit.completedAt)}
                          </span>
                        ) : null}
                      </Td>
                      <Td>{car?.model ?? '—'}</Td>
                      <Td>
                        {visit.staffId
                          ? (staffById.get(visit.staffId)?.name ?? '—')
                          : '—'}
                      </Td>
                      <Td>
                        {visit.beforePhotoUrl && visit.afterPhotoUrl ? (
                          <Tag tone="ok">Both</Tag>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </Td>
                      <Td>{visit.rating ? `${visit.rating} ★` : '—'}</Td>
                      <Td>
                        {visit.status === 'DONE' ? (
                          <Tag tone="ok">Done</Tag>
                        ) : (
                          <Tag tone="warn">
                            {visit.missReason
                              ? MISS_REASON_LABEL[visit.missReason]
                              : 'Not done'}
                          </Tag>
                        )}
                      </Td>
                    </tr>
                  );
                })}
                {history.length === 0 ? (
                  <tr>
                    <Td className="py-6 text-center text-ink-mute" colSpan={6}>
                      No washes recorded yet.
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </TableWrap>

          {visits.some((v) => v.rescheduledToVisitId) ? (
            <div className="mt-3">
              <Note tone="teal">
                Missed washes on this account were returned to the customer’s
                count and rescheduled — they were not lost.
              </Note>
            </div>
          ) : null}
        </Card>

        <Card className="p-4">
          <CardHeading>Payment history</CardHeading>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Amount</Th>
                  <Th>Mode</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 10).map((payment) => (
                  <tr key={payment.id}>
                    <Td className="whitespace-nowrap">
                      {formatDateFull(payment.createdAt)}
                    </Td>
                    <Td className="font-bold">{money(payment.amount)}</Td>
                    <Td>{PAYMENT_MODE_LABEL[payment.mode]}</Td>
                    <Td>
                      <Tag tone={payment.status === 'CONFIRMED' ? 'ok' : 'warn'}>
                        {payment.kind === 'ADVANCE'
                          ? 'Advance'
                          : payment.status === 'CONFIRMED'
                            ? 'Paid'
                            : 'To confirm'}
                      </Tag>
                    </Td>
                  </tr>
                ))}
                {payments.length === 0 ? (
                  <tr>
                    <Td className="py-6 text-center text-ink-mute" colSpan={4}>
                      No payments recorded.
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </TableWrap>

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
        </Card>

        <Card className="p-4">
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
