import {
  Card,
  CardHeading,
  Note,
  Row,
  SectionTitle,
  Stat,
  Tag,
} from '@/components/ui/primitives';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { pocketAllowance } from '@/lib/services/payroll';
import { currentCycle, formatDateFull, money } from '@/lib/util/format';
import { PocketForm } from './PocketForm';

export const metadata = { title: 'Pocket money' };

export default async function StaffPocket() {
  const session = await requirePermission('pocket:request');
  const store = await getStore();
  const staffId = session.user.staffId!;

  const [allowance, rules, requests] = await Promise.all([
    pocketAllowance(store, staffId, currentCycle()),
    store.getPayoutSettings(),
    store.pocketRequests.find({
      where: { staffId },
      orderBy: [{ field: 'requestedAt', dir: 'desc' }],
      limit: 10,
    }),
  ]);

  const hasPending = requests.some((r) => r.status === 'PENDING');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Card tone="success" className="p-3.5">
          <CardHeading>You can take</CardHeading>
          <Stat value={money(allowance.available)} tone="success" sub="right now" />
        </Card>
        <Card className="p-3.5">
          <CardHeading>In your account</CardHeading>
          <Stat value={money(allowance.inAccount)} sub="earned, not yet paid" />
        </Card>
      </div>

      <Card className="p-4">
        <CardHeading>The rules</CardHeading>
        <Row
          label="Weekly limit"
          value={`${rules.pocketWeeklyCapPercent}% of earnings`}
        />
        <Row label="Limit in rupees" value={money(allowance.weeklyCap)} />
        <Row label="Taken this week" value={money(allowance.takenThisWeek)} />
        <Row
          label="Must stay in account"
          value={money(rules.pocketMinimumBalance)}
        />
        <Row
          label="Available now"
          value={money(allowance.available)}
          tone="success"
        />
      </Card>

      <Card className="p-4">
        <CardHeading>Request a withdrawal</CardHeading>
        <PocketForm available={allowance.available} hasPending={hasPending} />
      </Card>

      <SectionTitle>Past requests</SectionTitle>
      <Card className="p-4">
        {requests.length === 0 ? (
          <p className="py-2 text-center text-sm text-ink-mute">
            You have not asked for pocket money yet.
          </p>
        ) : (
          requests.map((request) => (
            <Row
              key={request.id}
              label={formatDateFull(request.requestedAt)}
              value={
                <span className="inline-flex items-center gap-2">
                  {money(request.amount)}
                  <Tag
                    tone={
                      request.status === 'PAID' || request.status === 'APPROVED'
                        ? 'ok'
                        : request.status === 'PENDING'
                          ? 'warn'
                          : 'bad'
                    }
                  >
                    {request.status === 'PAID'
                      ? 'Paid'
                      : request.status === 'APPROVED'
                        ? 'Approved'
                        : request.status === 'PENDING'
                          ? 'Waiting'
                          : 'Rejected'}
                  </Tag>
                </span>
              }
            />
          ))
        )}
      </Card>

      <Note>
        Whatever you take now is deducted from your monthly payout. The minimum
        balance rule is there so you always have something left at month end.
      </Note>
    </div>
  );
}
