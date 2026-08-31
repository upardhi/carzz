import { PageHeader } from '@/components/shell/ConsoleShell';
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
import { currentCycle, cycleLabel, money, percent } from '@/lib/util/format';
import { EXPENSE_HEAD_LABEL } from '@/lib/util/labels';
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

  const [summary, expenses, payments, areas] = await Promise.all([
    businessSummary(store, cycle, null),
    store.expenses.find({ where: { cycle } }),
    store.payments.find({ where: { cycle, status: 'CONFIRMED' } }),
    store.areas.find({ orderBy: [{ field: 'name' }] }),
  ]);

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
  // What the margin would be if every rupee already billed were collected.
  const potentialMargin =
    summary.collected + summary.outstanding > 0
      ? (summary.profit + summary.outstanding) /
        (summary.collected + summary.outstanding)
      : 0;

  return (
    <>
      <PageHeader title="Accounting" description={cycleLabel(cycle)} />

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
            <span className="font-extrabold">Total</span>
            <span className="font-extrabold">{money(totalCost)}</span>
          </div>
        </Card>

        <Card accent="brand" className="p-4">
          <CardHeading>Result</CardHeading>
          <Stat
            value={money(summary.profit)}
            tone={summary.profit > 0 ? 'success' : 'danger'}
            sub={`Net profit · ${cycleLabel(cycle)}`}
          />
          <div className="mt-3">
            <Row label="Margin" value={percent(summary.margin)} />
            <Row label="Cost per wash" value={money(summary.costPerWash)} />
            <Row label="Revenue per car" value={money(summary.revenuePerCar)} />
          </div>

          {summary.outstanding > 0 ? (
            <div className="mt-3">
              <Note>
                If the {money(summary.outstanding)} outstanding were collected,
                margin would be {percent(potentialMargin)} instead of{' '}
                {percent(summary.margin)}. Collection is the biggest single
                lever you have.
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
