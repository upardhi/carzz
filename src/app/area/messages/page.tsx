import { PageHeader } from '@/components/shell/ConsoleShell';
import { WhatsAppTrackRecord } from '@/components/console/WhatsAppTrackRecord';
import { requirePermission } from '@/lib/auth/server';

export const metadata = {
  title: 'WhatsApp Messages & Delivery Log',
  robots: { index: false, follow: false },
};

export default async function AreaWhatsAppMessagesPage() {
  await requirePermission('visit:view');

  return (
    <div className="space-y-3">
      <PageHeader
        title="WhatsApp Messages & Delivery Log"
        description="Inspect all outbound customer and staff WhatsApp notifications, track real-time delivery status, and retry failed messages."
      />

      <WhatsAppTrackRecord standalone={true} />
    </div>
  );
}
