import { notFound } from 'next/navigation';
import {
  Card,
  CardHeading,
  Note,
  Row,
  SectionTitle,
  Tag,
} from '@/components/ui/primitives';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { loadCustomerAccount } from '@/lib/services/accounts';
import { currentCycle, formatDateFull } from '@/lib/util/format';
import { COMPLAINT_TYPE_LABEL } from '@/lib/util/labels';
import { ComplaintForm, RateWashForm } from './HelpForms';

export const metadata = { title: 'Help & feedback' };

export default async function CustomerHelp() {
  const session = await requirePermission('self:feedback');
  const store = await getStore();
  const account = await loadCustomerAccount(
    store,
    session.user.customerId!,
    currentCycle(),
  );
  if (!account) notFound();

  const lastWash = account.visits.find((v) => v.status === 'DONE') ?? null;
  const lastCar = lastWash
    ? account.cars.find((c) => c.id === lastWash.carId)
    : null;
  const staff = lastWash?.staffId ? await store.staff.get(lastWash.staffId) : null;
  const rules = await store.getPayoutSettings();

  const complaints = await store.complaints.find({
    where: { customerId: account.customer.id },
    orderBy: [{ field: 'createdAt', dir: 'desc' }],
    limit: 10,
  });

  return (
    <div className="space-y-3">
      {lastWash && lastCar ? (
        <Card className="p-4">
          <CardHeading>Rate your last wash</CardHeading>
          <RateWashForm
            visitId={lastWash.id}
            carLabel={`${lastCar.make} ${lastCar.model}`}
            dateLabel={formatDateFull(lastWash.scheduledDate)}
            staffName={staff?.name.split(' ')[0] ?? null}
            existingRating={lastWash.rating}
          />
          <div className="mt-3">
            <Note tone="teal">
              A rating of {rules.goodReviewMinStars} stars or more pays your wash
              boy ₹{rules.goodReviewBonus} extra for that wash.
            </Note>
          </div>
        </Card>
      ) : null}

      <Card className="p-4">
        <CardHeading>Raise a complaint</CardHeading>
        <ComplaintForm />
      </Card>

      <SectionTitle>My complaints</SectionTitle>
      <Card className="p-4">
        {complaints.length === 0 ? (
          <p className="py-2 text-center text-sm text-ink-mute">
            You have not raised any complaints.
          </p>
        ) : (
          complaints.map((complaint) => (
            <Row
              key={complaint.id}
              label={
                <>
                  {formatDateFull(complaint.createdAt)}
                  <span className="ml-1 text-ink-faint">
                    · {COMPLAINT_TYPE_LABEL[complaint.type]}
                  </span>
                </>
              }
              value={
                <Tag
                  tone={
                    complaint.status === 'RESOLVED'
                      ? 'ok'
                      : complaint.status === 'ESCALATED'
                        ? 'bad'
                        : 'warn'
                  }
                >
                  {complaint.status === 'RESOLVED'
                    ? 'Resolved'
                    : complaint.status === 'ESCALATED'
                      ? 'Escalated'
                      : 'Open'}
                </Tag>
              }
            />
          ))
        )}
      </Card>
    </div>
  );
}
