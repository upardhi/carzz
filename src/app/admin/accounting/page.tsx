import Link from 'next/link';
import { PageHeader } from '@/components/shell/ConsoleShell';
import { ActionButton } from '@/components/console/ActionButton';
import {
  Card,
  CardHeading,
  Note,
  Row,
  Stat,
} from '@/components/ui/primitives';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { businessSummary } from '@/lib/services/reports';
import { currentCycle, cycleLabel, money } from '@/lib/util/format';
import { EXPENSE_HEAD_LABEL, PAYMENT_MODE_LABEL } from '@/lib/util/labels';
import { ExpenseForm } from './ExpenseForm';

export const metadata = { title: 'Accounting' };

export default async function AdminAccounting({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  await requirePermission('accounting:view');
  const store = await getStore();
  const { cycle: requested } = await searchParams;
  const cycle = requested ?? currentCycle();

  const [summary, expenses, payments, areas, pendingPayments] = await Promise.all([
    businessSummary(store, cycle, null),
    store.expenses.find({ where: { cycle } }),
    store.payments.find({ where: { cycle, status: 'CONFIRMED' } }),
    store.areas.find({ orderBy: [{ field: 'name' }] }),
    store.payments.find({
      where: { status: 'PENDING' },
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
    }),
  ]);

  const pendingCustomerIds = [...new Set(pendingPayments.map((p) => p.customerId))];
  const pendingCustomers = pendingCustomerIds.length
    ? await store.customers.find({ where: { id: { in: pendingCustomerIds } } as never })
    : [];
  const customerMap = new Map(pendingCustomers.map((c) => [c.id, c]));

  const byHead = new Map<string, number>();
  for (const expense of expenses) {
    if (expense.head === 'STAFF_PAYOUT') continue;
    byHead.set(expense.head, (byHead.get(expense.head) ?? 0) + expense.amount);
  }

  const advances = payments
    .filter((p) => p.kind === 'ADVANCE')
    .reduce((s, p) => s + p.amount, 0);
  const packages = payments
    .filter((p) => p.kind === 'PACKAGE')
    .reduce((s, p) => s + p.amount, 0);

  const totalCost = summary.payoutCost + summary.expenses;

  return (
    <>
      <PageHeader title="Accounting" description={cycleLabel(cycle)} />

      {pendingPayments.length > 0 && (
        <Card accent="gold" className="p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <CardHeading>Pending Payment Approvals</CardHeading>
              <p className="text-xs text-slate-500 mt-0.5">
                Online gateway and customer-declared payments awaiting admin or manager approval before being credited.
              </p>
            </div>
            <span className="rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-extrabold px-2.5 py-0.5 text-xs">
              {pendingPayments.length} pending
            </span>
          </div>

          <div className="space-y-2.5">
            {pendingPayments.map((p) => {
              const customer = customerMap.get(p.customerId);
              return (
                <div
                  key={p.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3.5"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-extrabold text-slate-900">
                        {money(p.amount)}
                      </span>
                      <Link
                        href={`/admin/customers/${p.customerId}`}
                        className="text-xs font-bold text-blue-700 hover:underline truncate max-w-[200px]"
                      >
                        {customer?.name || 'Customer'}
                      </Link>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10.5px] font-bold ${
                          p.mode === 'GATEWAY'
                            ? 'bg-blue-100 text-blue-800'
                            : p.mode === 'MANUAL_UPI'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {p.mode === 'GATEWAY' ? '⚡ Razorpay' : PAYMENT_MODE_LABEL[p.mode]}
                      </span>
                    </div>

                    {p.reference && (
                      <p className="text-xs font-mono text-slate-600">
                        Txn ID: <strong>{p.reference}</strong>
                      </p>
                    )}
                    {p.note && (
                      <p className="text-xs text-slate-500 italic truncate max-w-md">
                        {p.note}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <ActionButton
                      endpoint="/api/ops/payments"
                      payload={{ action: 'reject', paymentId: p.id }}
                      variant="danger"
                      confirm={`Are you sure you want to reject this ${money(p.amount)} payment from ${customer?.name || 'this customer'}?`}
                      confirmTitle="Reject Payment"
                      confirmTone="danger"
                    >
                      Reject
                    </ActionButton>

                    <ActionButton
                      endpoint="/api/ops/payments"
                      payload={{ action: 'confirm', paymentId: p.id }}
                      variant="primary"
                      confirm={`Confirm and approve ${money(p.amount)} for ${customer?.name || 'this customer'}? This will settle their invoices and credit their balance.`}
                      confirmTitle="Approve Payment"
                      confirmTone="primary"
                    >
                      Approve & Credit
                    </ActionButton>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="p-4">
          <CardHeading>Income</CardHeading>
          <Row label="Package collections" value={money(packages)} />
          <Row label="Advance deposits" value={money(advances)} />
          <Row
            label="Total received"
            value={money(packages + advances)}
            tone="success"
          />
          <Row
            label="Billed but not collected"
            value={money(summary.outstanding)}
            tone="danger"
          />
        </Card>

        <Card className="p-4">
          <CardHeading>Expenses</CardHeading>
          <Row label="Staff payments" value={money(summary.payoutCost)} />
          {[...byHead.entries()].map(([head, amount]) => (
            <Row
              key={head}
              label={EXPENSE_HEAD_LABEL[head as keyof typeof EXPENSE_HEAD_LABEL]}
              value={money(amount)}
            />
          ))}
          <div className="mt-2 flex items-baseline justify-between border-t-2 border-navy-850 pt-2">
            <span className="font-bold">Total</span>
            <span className="font-bold">{money(totalCost)}</span>
          </div>
        </Card>

        <Card accent="brand" className="p-4">
          <CardHeading>Result</CardHeading>
          <Stat
            value={money(summary.revenuePerCar)}
            tone="brand"
            sub={`Revenue per car · ${cycleLabel(cycle)}`}
          />

          {summary.outstanding > 0 ? (
            <div className="mt-3">
              <Note>
                If the {money(summary.outstanding)} outstanding were collected,
                that adds {money(summary.outstanding)} straight to collections.
                Collection is the biggest single lever you have.
              </Note>
            </div>
          ) : null}
        </Card>

        <Card className="p-4">
          <CardHeading>Record an expense</CardHeading>
          <ExpenseForm
            cycle={cycle}
            areas={areas.map((a) => ({ id: a.id, name: a.name }))}
          />
        </Card>

        <Card className="p-4 lg:col-span-2">
          <CardHeading>Recorded this month</CardHeading>
          {expenses.filter((e) => e.head !== 'STAFF_PAYOUT').length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-mute">
              No expenses recorded yet for {cycleLabel(cycle)}.
            </p>
          ) : (
            expenses
              .filter((e) => e.head !== 'STAFF_PAYOUT')
              .map((expense) => (
                <Row
                  key={expense.id}
                  label={
                    <>
                      {EXPENSE_HEAD_LABEL[expense.head]}
                      {expense.note ? (
                        <span className="ml-1 text-ink-faint">· {expense.note}</span>
                      ) : null}
                    </>
                  }
                  value={money(expense.amount)}
                />
              ))
          )}
        </Card>
      </div>
    </>
  );
}
