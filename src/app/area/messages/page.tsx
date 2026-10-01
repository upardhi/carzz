import { PageHeader } from '@/components/shell/ConsoleShell';
import { WhatsAppTrackRecord } from '@/components/console/WhatsAppTrackRecord';
import { requirePermission } from '@/lib/auth/server';

export const metadata = {
  title: 'WhatsApp Web',
  robots: { index: false, follow: false },
};

export default async function AreaWhatsAppMessagesPage() {
  await requirePermission('visit:view');

  return (
    <div className="space-y-3">
      <PageHeader
        title="WhatsApp Web"
        description="Direct chat with customers and wash boys, real-time message delivery, and instant retry."
      />

      <WhatsAppTrackRecord standalone={true} />
    </div>
  );
}
