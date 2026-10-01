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
import { parsePackageServices, WEEKDAY_NUM } from '@/lib/data/types';
import {
  currentCycle,
  formatClock,
  formatDateFull,
  formatTime,
  money,
  todayISO,
} from '@/lib/util/format';
import {
  LEAD_SOURCE_LABEL,
  MISS_REASON_LABEL,
  PAYMENT_MODE_LABEL,
  summarizeWeeklyDays,
} from '@/lib/util/labels';
import { ActionButton } from './ActionButton';
import { CustomerLoginAction } from './CustomerLoginAction';
import { RecordPaymentForm } from './RecordPaymentForm';
import { StartCarServiceAction } from './StartCarServiceAction';
import { WashTodayAction } from './WashTodayAction';
import { QuickAssignStaff } from './QuickAssignStaff';
import { PendingPaymentsSection } from './PendingPaymentsSection';
import {
  AddCarModalButton,
  CarWashHistoryButton,
  DeleteCarButton,
  EditCarModalButton,
  EditCustomerModalButton,
  InactivateCustomerButton,
  RescheduleVisitButton,
  VisitPhotoPreviewButton,
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

  const activeCars = cars.filter((c) => c.active && (c.serviceStarted ?? true));
  const carsPaymentInfo = activeCars.map((c) => ({
    id: c.id,
    name: `${c.make} ${c.model} (${c.plate})`,
    price: c.payment?.price ?? c.package?.price ?? 0,
    due: c.payment?.due ?? c.package?.price ?? 0,
  }));

  return (
    <>
      <PageHeader
        title={customer.name}
        description={`${area?.name ?? ''} · joined ${formatDateFull(customer.joinedOn)} · ${LEAD_SOURCE_LABEL[customer.source]}`}
        actions={
          <div className="flex items-center gap-2">
            <ButtonLink href={`${base}/customers`} variant="secondary" size="sm">
              ← All customers
            </ButtonLink>
          </div>
        }
      />

      <div className="space-y-8">
        {/* ================================================================
            1. CUSTOMER DETAILS SECTION
           ================================================================ */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Customer Details
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Contact information, service location, account status, and customer app access.
              </p>
            </div>
            <div className="shrink-0 self-start sm:self-auto">
              <EditCustomerModalButton customer={customer} areas={allAreas} />
            </div>
          </div>

          <Card className="p-5 min-w-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
              {/* Column 1: Contact & Status */}
              <div className="lg:col-span-4 space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Contact &amp; Profile
                </div>
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
                <Row label="WhatsApp" value={customer.phone} />
                {customer.altPhone ? (
                  <Row label="Alternate" value={customer.altPhone} />
                ) : null}
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

                {customer.status === 'INACTIVE' && customer.inactivationReason ? (
                  <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                    <span className="font-bold">Inactivation Reason:</span>{' '}
                    <span>{customer.inactivationReason}</span>
                    {customer.inactivatedAt && (
                      <span className="block mt-0.5 text-[10px] text-rose-600">
                        Deactivated on {formatDateFull(customer.inactivatedAt)}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Column 2: Service Address & Map */}
              <div className="lg:col-span-5 pt-4 lg:pt-0 lg:pl-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Service Address &amp; Location
                    </span>
                    {(customer.lat !== null &&
                      customer.lat !== undefined &&
                      customer.lng !== null &&
                      customer.lng !== undefined) ||
                    customer.address ? (
                      <a
                        href={
                          customer.lat !== null &&
                          customer.lat !== undefined &&
                          customer.lng !== null &&
                          customer.lng !== undefined
                            ? `https://www.google.com/maps/search/?api=1&query=${customer.lat},${customer.lng}`
                            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition-colors shrink-0"
                      >
                        <span>📍 Open Map</span>
                        <span>↗</span>
                      </a>
                    ) : null}
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-left">
                    <p className="text-xs font-semibold text-slate-800 leading-relaxed break-words">
                      {customer.address || 'No address provided'}
                    </p>
                    {(customer.landmark || area?.name) && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-200/60 text-[11px]">
                        {area?.name && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-0.5 font-semibold text-slate-600 border border-slate-200">
                            Area: <strong className="text-slate-800">{area.name}</strong>
                          </span>
                        )}
                        {customer.landmark && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-0.5 font-semibold text-slate-600 border border-slate-200">
                            Landmark: <strong className="text-slate-800">{customer.landmark}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Column 3: Account Controls & Quick Actions */}
              <div className="lg:col-span-3 pt-4 lg:pt-0 lg:pl-6 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                    Account Actions &amp; Access
                  </div>
                  <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                    Manage customer portal login credentials or change account service status.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                    <InactivateCustomerButton
                      customerId={customer.id}
                      customerName={customer.name}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* ================================================================
            2. CARS ON THIS ACCOUNT SECTION
           ================================================================ */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Cars on This Account
                </h2>
                <span className="inline-flex items-center justify-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
                  {cars.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Registered vehicles, weekly wash schedules, assigned wash boys, and monthly package progress.
              </p>
            </div>
            <div className="shrink-0 self-start sm:self-auto">
              <AddCarModalButton
                customerId={customer.id}
                packages={allPackages}
                staffList={staff}
              />
            </div>
          </div>

          {cars.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm font-semibold text-slate-600">
                No vehicles registered on this account yet.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Click &ldquo;+ Add Another Car&rdquo; above to add a vehicle and schedule washes.
              </p>
            </Card>
          ) : (
            <div className="space-y-3.5">
              {cars.map((car) => {
                const isStarted = car.serviceStarted ?? true;
                const today = todayISO();
                const todayDate = new Date(`${today}T00:00:00.000Z`);
                const todayDayNum = todayDate.getUTCDay();
                const isScheduledDayToday = (car.weeklyDays && car.weeklyDays.length > 0 ? car.weeklyDays : ['MON', 'THU']).some(
                  (d) => (WEEKDAY_NUM as Record<string, number>)[d] === todayDayNum,
                );
                const carPay = car.payment;
                const todaysVisit = visits.find(
                  (v) => v.carId === car.id && v.scheduledDate === today,
                );
                const upcomingVisit = visits
                  .filter(
                    (v) =>
                      v.carId === car.id &&
                      v.status === 'PENDING' &&
                      v.scheduledDate >= today,
                  )
                  .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0] || null;

                return (
                  <Card key={car.id} className="p-5 min-w-0">
                    {/* Horizontal Car Card Header */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                      <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 text-lg">
                          🚗
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">
                              {car.make} {car.model}
                            </h3>
                            <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                              {car.plate}
                            </span>
                            {car.colour && car.colour !== 'Unspecified' && (
                              <span className="text-xs font-medium text-slate-500">
                                • {car.colour}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {carPay && (
                              carPay.awaitingFirstWash ? (
                                <Tag tone="warn">⏳ Unpaid · Awaiting 1st Wash</Tag>
                              ) : carPay.due === 0 ? (
                                <Tag tone="ok">✓ Paid (₹{carPay.paid.toLocaleString('en-IN')})</Tag>
                              ) : (
                                <Tag tone="bad">Due: ₹{carPay.due.toLocaleString('en-IN')}</Tag>
                              )
                            )}
                            {isStarted ? (
                              car.serviceStartedBeforePayment ? (
                                <Tag tone="warn">Started Before Payment (Override)</Tag>
                              ) : (
                                <Tag tone="ok">Active · Prepaid</Tag>
                              )
                            ) : (
                              <Tag tone="warn">Pending Payment · Not Started</Tag>
                            )}
                            {isStarted &&
                              todaysVisit &&
                              (todaysVisit.status === 'DONE' ? (
                                <Tag tone="ok">✓ Washed Today</Tag>
                              ) : todaysVisit.status === 'IN_PROGRESS' ? (
                                <Tag tone="warn">⚡ In Progress Today</Tag>
                              ) : todaysVisit.status === 'MISSED' ? (
                                <Tag tone="bad">Missed Today</Tag>
                              ) : (
                                <Tag tone="ok">📅 Today&apos;s Booking</Tag>
                              ))}
                          </div>
                          {carPay?.awaitingFirstWash && (
                            <div className="mt-2 text-xs rounded-lg bg-amber-50/80 border border-amber-200/80 p-2 text-amber-900">
                              <span className="font-bold">⏳ Awaiting 1st Wash:</span>{' '}
                              <span>{carPay.advanceMessage || 'Payment will be distributed once the first wash is completed.'}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Actions Toolbar */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {isStarted && !todaysVisit && !isScheduledDayToday && (
                          <WashTodayAction
                            customerId={customer.id}
                            carId={car.id}
                            carName={`${car.make} ${car.model}`}
                            carPlate={car.plate}
                            currentAssignedStaffId={car.assignedStaffId}
                            staffList={staff}
                          />
                        )}
                        <CarWashHistoryButton
                          car={{
                            id: car.id,
                            make: car.make,
                            model: car.model,
                            plate: car.plate,
                            packageName: car.package?.name,
                            washesPerMonth: car.package?.washesPerMonth,
                          }}
                          customer={{
                            id: customer.id,
                            name: customer.name,
                            phone: customer.phone,
                          }}
                          visits={visits}
                          staffList={staff}
                        />
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

                    {/* Horizontal Body: Bordered Car Detail Cards + Service Quota Breakdown */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                      <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {/* 1. Package */}
                        <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3.5 flex flex-col justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Package
                          </span>
                          <div className="mt-1.5 flex items-baseline justify-between gap-1 flex-wrap">
                            <span className="text-sm font-bold text-slate-900 break-words">
                              {car.package?.name ?? '—'}
                            </span>
                            {car.package?.price ? (
                              <span className="text-xs font-bold text-blue-700">
                                ₹{car.package.price.toLocaleString('en-IN')}/{car.package.billingPeriod?.toLowerCase() || 'mo'}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* 2. Washes this month */}
                        <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3.5 flex flex-col justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Washes this month
                          </span>
                          <div className="mt-1.5 text-sm font-bold text-slate-900">
                            {isStarted
                              ? `${car.tally.done} of ${car.package?.washesPerMonth ?? 0}`
                              : 'Washes not started yet'}
                          </div>
                        </div>

                        {/* 3. Weekly slot */}
                        <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3.5 flex flex-col justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Weekly slot
                          </span>
                          <div className="mt-1.5 text-sm font-bold text-slate-900">
                            {summarizeWeeklyDays(car.weeklyDays)} · {formatTime(car.scheduleTime)}
                          </div>
                        </div>

                        {/* 4. Wash boy */}
                        <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3.5 flex flex-col justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Wash boy
                          </span>
                          <div className="mt-1.5 flex items-center justify-between gap-2 min-w-0">
                            <QuickAssignStaff
                              customerId={customer.id}
                              carId={car.id}
                              currentStaffId={car.assignedStaffId}
                              staffList={staff}
                            />
                          </div>
                        </div>

                        {/* 5. Next wash */}
                        <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3.5 flex flex-col justify-between sm:col-span-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Next wash
                          </span>
                          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                            {upcomingVisit ? (
                              <>
                                <span className="text-sm font-bold text-slate-900">
                                  {upcomingVisit.scheduledDate === today
                                    ? `Today (${formatDateFull(upcomingVisit.scheduledDate)})`
                                    : formatDateFull(upcomingVisit.scheduledDate)}{' '}
                                  · {formatTime(upcomingVisit.scheduledTime)}
                                  {upcomingVisit.plannedService
                                    ? ` · ${upcomingVisit.plannedService}`
                                    : ''}
                                </span>
                                <RescheduleVisitButton
                                  customerId={customer.id}
                                  visitId={upcomingVisit.id}
                                  currentDate={upcomingVisit.scheduledDate}
                                  currentTime={upcomingVisit.scheduledTime}
                                  currentStaffId={upcomingVisit.staffId}
                                  staffList={staff}
                                />
                              </>
                            ) : (
                              <span className="text-xs font-medium text-slate-400">
                                No upcoming wash scheduled
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Package Sub-Services Quota & Audit Notices */}
                      <div className="lg:col-span-4 space-y-2.5">
                        {(() => {
                          const parsedServices = parsePackageServices(
                            car.package?.services,
                            car.package?.washesPerMonth ?? 8,
                          );
                          if (parsedServices.length === 0) return null;

                          const completedThisCycle = visits.filter(
                            (v) =>
                              v.carId === car.id &&
                              v.cycle === cycle &&
                              v.status === 'DONE',
                          );

                          return (
                            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-xs">
                              <div className="font-semibold text-slate-700 mb-2 flex items-center justify-between">
                                <span>Package Services ({cycle})</span>
                                <span className="text-[10.5px] text-slate-500 font-normal">
                                  Quota &amp; Done
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                {parsedServices.map((svc) => {
                                  const doneCount = completedThisCycle.filter(
                                    (v) =>
                                      Array.isArray(v.servicesDone) &&
                                      v.servicesDone.some(
                                        (n) =>
                                          n.trim().toLowerCase() ===
                                            svc.name.trim().toLowerCase() ||
                                          n
                                            .trim()
                                            .toLowerCase()
                                            .includes(svc.name.trim().toLowerCase()),
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
                                        className={`font-mono font-semibold px-2 py-0.5 rounded text-[10px] shrink-0 ${
                                          isMet
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                                        }`}
                                      >
                                        {doneCount} / {svc.washesPerMonth}{' '}
                                        {isMet ? '✓' : ''}
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
                          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950">
                            <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                              <span>
                                ⚠️ Service Started Before Payment (Owner Audit Trail)
                              </span>
                            </div>
                            <div className="mt-1.5 text-[11px] text-amber-900 space-y-1">
                              <div>
                                <span className="font-medium text-amber-950">
                                  Authorized by:
                                </span>{' '}
                                {car.serviceStartedByUser
                                  ? `${car.serviceStartedByUser.name} (${car.serviceStartedByUser.role})`
                                  : 'Staff / Manager'}
                              </div>
                              {car.serviceStartedAt && (
                                <div>
                                  <span className="font-medium text-amber-950">
                                    Started on:
                                  </span>{' '}
                                  {formatDateFull(car.serviceStartedAt)}
                                </div>
                              )}
                              {car.serviceStartNote && (
                                <div>
                                  <span className="font-medium text-amber-950">
                                    Reason / Note:
                                  </span>{' '}
                                  {car.serviceStartNote}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Manual Start Service Action for Pending Cars */}
                    {!isStarted && (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                        <span className="text-xs text-slate-500">
                          Prepaid package pending. Washes will auto-start on payment or can be started manually by a manager.
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
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* ================================================================
            3. PAYMENTS & HISTORY SECTION
           ================================================================ */}
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Payments &amp; History
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Whole-account billing summary, advance balance, payment recording, and receipt history.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left: Payment — Whole Account */}
            <Card className="lg:col-span-5 xl:col-span-4 p-5 min-w-0">
              <CardHeading>Payment — whole account</CardHeading>
              <div className="mt-2">
                <Row label="Monthly package" value={money(account.monthly)} />
                <Row
                  label="Advance deposited"
                  value={money(account.advanceDeposited)}
                />
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
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100">
                <RecordPaymentForm
                  customerId={customerId}
                  suggested={account.outstanding || account.monthly}
                  outstanding={account.outstanding}
                  monthly={account.monthly}
                  invoices={invoices}
                  cars={carsPaymentInfo}
                />
              </div>
            </Card>

            {/* Right: Payment History */}
            <div className="lg:col-span-7 xl:col-span-8 min-w-0 space-y-3">
              <WidgetTable<(typeof payments)[number]>
                title="Payment history"
                data={payments.slice(0, 10)}
                keyExtractor={(payment) => payment.id}
                emptyMessage="No payments recorded."
                columns={[
                  {
                    id: 'receipt',
                    header: 'RECEIPT #',
                    className: 'whitespace-nowrap',
                    render: (payment) => (
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-900 block">
                          #RCP-{payment.id.slice(-6).toUpperCase()}
                        </span>
                        <span className="text-[10.5px] text-slate-400">
                          {formatDateFull(payment.createdAt)}
                        </span>
                      </div>
                    ),
                  },
                  {
                    id: 'amount',
                    header: 'AMOUNT',
                    className: 'font-bold text-slate-900',
                    render: (payment) => (
                      <div>
                        <div>{money(payment.amount)}</div>
                        <span className="text-[10px] text-slate-500 font-normal">
                          {PAYMENT_MODE_LABEL[payment.mode]}
                        </span>
                      </div>
                    ),
                  },
                  {
                    id: 'reference',
                    header: 'REF / NOTE',
                    render: (payment) => (
                      <div className="text-xs max-w-[240px]">
                        <span
                          className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 block truncate select-all"
                          title={payment.reference || payment.id}
                        >
                          {payment.reference ? `ID: ${payment.reference}` : `ID: ${payment.id}`}
                        </span>
                        {payment.note ? (
                          <span className="text-[11px] text-slate-500 italic block truncate mt-0.5" title={payment.note}>
                            {payment.note}
                          </span>
                        ) : null}
                      </div>
                    ),
                  },
                  {
                    id: 'type',
                    header: 'TYPE',
                    render: (payment) => (
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          payment.kind === 'ADVANCE'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {payment.kind === 'ADVANCE' ? 'Advance' : 'Invoice'}
                      </span>
                    ),
                  },
                  {
                    id: 'status',
                    header: 'STATUS',
                    align: 'right',
                    render: (payment) => (
                      <Tag tone={payment.status === 'CONFIRMED' ? 'ok' : 'warn'}>
                        {payment.status === 'CONFIRMED' ? 'Paid' : 'To confirm'}
                      </Tag>
                    ),
                  },
                ]}
              />

              <PendingPaymentsSection payments={payments} />
            </div>
          </div>
        </section>

        {/* ================================================================
            4. RECENT WASHES SECTION
           ================================================================ */}
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Recent Washes
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Completed and missed wash visits, service checklists, proof photos, and ratings.
            </p>
          </div>

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
                  if (
                    !Array.isArray(visit.servicesDone) ||
                    visit.servicesDone.length === 0
                  ) {
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
                render: (visit) => {
                  const car = cars.find((c) => c.id === visit.carId);
                  return (
                    <VisitPhotoPreviewButton
                      beforePhotoUrl={visit.beforePhotoUrl}
                      afterPhotoUrl={visit.afterPhotoUrl}
                      title={`${car?.model ?? 'Car'} (${formatDateFull(visit.scheduledDate)})`}
                    />
                  );
                },
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
            <div>
              <Note tone="success">
                Missed washes on this account were returned to the customer’s
                count and rescheduled — they were not lost.
              </Note>
            </div>
          ) : null}
        </section>

        {/* ================================================================
            5. INVOICES SECTION
           ================================================================ */}
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Invoices
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Generated billing statements, due dates, and payment status for this account.
            </p>
          </div>

          <WidgetTable<(typeof invoices)[number]>
            title="Invoices"
            data={invoices.slice(0, 6)}
            keyExtractor={(invoice) => invoice.id}
            emptyMessage="No invoices generated for this account yet."
            columns={[
              {
                id: 'cycle',
                header: 'BILLING CYCLE',
                render: (invoice) => (
                  <span className="font-semibold text-slate-900">{invoice.cycle}</span>
                ),
              },
              {
                id: 'due',
                header: 'DUE DATE',
                render: (invoice) => (
                  <span className="text-slate-600">{formatDateFull(invoice.dueOn)}</span>
                ),
              },
              {
                id: 'amount',
                header: 'AMOUNT',
                className: 'font-bold text-slate-900',
                render: (invoice) => money(invoice.amount),
              },
              {
                id: 'status',
                header: 'STATUS',
                align: 'right',
                render: (invoice) => (
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
                ),
              },
            ]}
          />
        </section>
      </div>
    </>
  );
}
