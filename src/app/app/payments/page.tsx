import { notFound } from 'next/navigation';
import {
  Card,
  CardHeading,
  Row,
  SectionTitle,
  Stat,
  Tag,
} from '@/components/ui/primitives';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { loadCustomerAccount } from '@/lib/services/accounts';
import {
  currentCycle,
  cycleLabel,
  formatDateFull,
  money,
  relativeDays,
} from '@/lib/util/format';
import { PAYMENT_MODE_LABEL } from '@/lib/util/labels';
import { PayActions } from './PayActions';

export const metadata = { title: 'Payments' };

export default async function CustomerPayments() {
  const session = await requirePermission('self:payments');
  const store = await getStore();
  const [account, settings] = await Promise.all([
    loadCustomerAccount(store, session.user.customerId!, currentCycle()),
    store.getAppSettings(),
  ]);
  if (!account) notFound();

  return (
    <div className="space-y-3">
      {account.outstanding > 0 && account.nextDue ? (
        <Card tone="gold" className="p-4">
          <CardHeading>Amount due</CardHeading>
          <Stat
            value={money(account.outstanding)}
            tone="gold"
            sub={`${cycleLabel(account.nextDue.cycle)} · due ${formatDateFull(account.nextDue.dueOn)} · ${relativeDays(account.nextDue.dueOn)}`}
          />
        </Card>
      ) : (
        <Card tone="success" className="p-4">
          <CardHeading>Amount due</CardHeading>
          <Stat value={money(0)} tone="success" sub="You are fully paid up" />
        </Card>
      )}

      <Card className="p-4">
        <CardHeading>Your account</CardHeading>
        <Row label="Monthly package" value={money(account.monthly)} />
        <Row label="Advance deposited" value={money(account.advanceDeposited)} />
        <Row label="Total paid" value={money(account.totalPaid)} />
        <Row label="Total billed" value={money(account.totalBilled)} />
        <Row
          label="Balance"
          value={money(Math.max(0, account.balance))}
          tone={account.balance >= 0 ? 'success' : undefined}
        />
        <Row
          label="Outstanding"
          value={money(account.outstanding)}
          tone={account.outstanding > 0 ? 'danger' : undefined}
        />
      </Card>

      <Card className="p-4">
        <CardHeading>Pay now</CardHeading>
        <PayActions
          amount={account.outstanding}
          modes={settings.paymentModesEnabled}
        />
      </Card>

      <SectionTitle>Payment history</SectionTitle>
      <Card className="p-4">
        {account.payments.length === 0 ? (
          <p className="py-2 text-center text-sm text-ink-mute">
            No payments recorded yet.
          </p>
        ) : (
          account.payments.slice(0, 12).map((payment) => (
            <Row
              key={payment.id}
              label={
                <>
                  {formatDateFull(payment.createdAt)}
                  <span className="ml-1 text-ink-faint">
                    · {PAYMENT_MODE_LABEL[payment.mode]}
                  </span>
                </>
              }
              value={
                <span className="inline-flex items-center gap-2">
                  {money(payment.amount)}
                  <Tag
                    tone={
                      payment.status === 'CONFIRMED'
                        ? 'ok'
                        : payment.status === 'PENDING'
                          ? 'warn'
                          : 'bad'
                    }
                  >
                    {payment.kind === 'ADVANCE' ? 'Advance' : payment.status === 'CONFIRMED' ? 'Paid' : 'Pending'}
                  </Tag>
                </span>
              }
            />
          ))
        )}
      </Card>

    </div>
  );
}
