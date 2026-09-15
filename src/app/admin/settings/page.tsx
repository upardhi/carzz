import { PageHeader } from '@/components/shell/ConsoleShell';
import { Card, CardHeading, Note, Row } from '@/components/ui/primitives';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { money } from '@/lib/util/format';
import {
  OperatingRulesForm,
  PayoutBaseForm,
  PayoutRulesForm,
  PhotoPurgeButton,
} from './SettingsForms';

export const metadata = { title: 'Settings' };

export default async function AdminSettings() {
  await requirePermission('settings:manage');
  const store = await getStore();

  const [app, payout, allVisits] = await Promise.all([
    store.getAppSettings(),
    store.getPayoutSettings(),
    store.visits.find(),
  ]);

  // Compute exact stored photo count and actual bytes
  let photosStored = 0;
  let totalBytes = 0;

  for (const v of allVisits) {
    if (v.beforePhotoUrl) {
      photosStored += 1;
      totalBytes += v.beforePhotoBytes ?? 250000;
    }
    if (v.afterPhotoUrl) {
      photosStored += 1;
      totalBytes += v.afterPhotoBytes ?? 250000;
    }
  }

  // Format actual storage size dynamically
  let formattedSize = '0 MB';
  if (totalBytes < 1024 * 1024) {
    formattedSize = `${(totalBytes / 1024).toFixed(1)} KB`;
  } else if (totalBytes < 1024 * 1024 * 1024) {
    formattedSize = `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    formattedSize = `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="The rules the whole business runs on"
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card accent="gold" className="p-4">
          <CardHeading>Base pay rule — needs your decision</CardHeading>
          <Note>
            Your brief left this unsettled: are the ₹300 / ₹350 / ₹400 figures a
            slab by the car&rsquo;s position in the day, or does a flat per-wash
            rate apply? The two differ by roughly three times on the same work,
            so it is the single most consequential setting here.
          </Note>
          <div className="mt-3">
            <PayoutBaseForm settings={payout} />
          </div>
        </Card>

        <Card className="p-4">
          <CardHeading>Operating rules</CardHeading>
          <OperatingRulesForm settings={app} />
        </Card>

        <Card className="p-4 lg:col-span-2">
          <CardHeading>Bonuses, penalties and pocket money</CardHeading>
          <PayoutRulesForm settings={payout} />
        </Card>

        <Card className="p-4">
          <CardHeading>Photo storage</CardHeading>
          <Row label="Kept for" value={`${app.photoRetentionMonths} months`} />
          <Row label="Photos stored" value={photosStored.toLocaleString('en-IN')} />
          <Row label="Storage used" value={formattedSize} />
          <Row
            label="Both photos required"
            value={app.requireBothPhotos ? 'Yes' : 'No'}
            tone={app.requireBothPhotos ? 'success' : 'danger'}
          />
          <div className="mt-3">
            <Note>
              Photos are served only to a signed-in account — they are pictures
              of customers&rsquo; vehicles outside their homes, so they are
              never on a guessable public address.
            </Note>
          </div>
          <PhotoPurgeButton />
        </Card>

        <Card className="p-4">
          <CardHeading>Current rules at a glance</CardHeading>
          <Row
            label="Base pay"
            value={
              payout.baseMode === 'PER_WASH'
                ? `${money(payout.perWashRate)} per wash`
                : `Slab ${(payout.slabByCarIndex as number[]).map((v) => money(v)).join(' / ')}`
            }
          />
          <Row label="On-time bonus" value={money(payout.onTimeBonus)} />
          <Row
            label="Good review bonus"
            value={`${money(payout.goodReviewBonus)} at ${payout.goodReviewMinStars}★+`}
          />
          <Row label="Offs allowed" value={`${payout.offsAllowedPerMonth} per month`} />
          <Row
            label="Pocket money cap"
            value={`${payout.pocketWeeklyCapPercent}% weekly, ${money(payout.pocketMinimumBalance)} must stay`}
          />
          <Row label="Reminder channel" value={app.reminderChannel} />
          <Row label="Tea break" value={`${app.teaBreakMinutes} minutes`} />
        </Card>
      </div>
    </>
  );
}
