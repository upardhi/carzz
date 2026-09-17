import { PageHeader } from '@/components/shell/ConsoleShell';
import { Card } from '@/components/ui/primitives';
import { DataTable } from '@/components/ui/DataTable';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { leadSourceReport } from '@/lib/services/reports';
import { percent } from '@/lib/util/format';
import { LEAD_SOURCE_LABEL } from '@/lib/util/labels';

export const metadata = { title: 'Lead sources' };

export default async function AdminSources() {
  await requirePermission('report:business');
  const store = await getStore();
  const rows = await leadSourceReport(store, null);



  return (
    <>
      <PageHeader
        title="Lead sources"
        description="Which reference actually brings customers who stay"
      />

      <Card className="mb-3 p-4">
        <p className="text-sm text-ink-mute">
          Every new customer must have a source recorded — the intake form
          cannot be completed without it. This is that data.
        </p>
      </Card>

      <DataTable<(typeof rows)[number]>
        data={rows}
        keyExtractor={(row) => row.source}
        itemLabel="lead sources"
        emptyMessage="No lead source data available."
        columns={[
          {
            id: 'source',
            header: 'SOURCE',
            className: 'font-bold text-navy-950',
            render: (row) => LEAD_SOURCE_LABEL[row.source],
          },
          {
            id: 'joined',
            header: 'CUSTOMERS JOINED',
            align: 'center',
            render: (row) => row.joined,
          },
          {
            id: 'stillActive',
            header: 'STILL ACTIVE',
            align: 'center',
            render: (row) => row.stillActive,
          },
          {
            id: 'retention',
            header: 'RETENTION',
            align: 'center',
            render: (row) => (
              <span
                className={
                  row.retention >= 0.85
                    ? 'font-bold text-emerald-600'
                    : row.retention < 0.5
                      ? 'font-bold text-rose-600'
                      : 'text-gold-600'
                }
              >
                {percent(row.retention)}
              </span>
            ),
          },

        ]}
      />


    </>
  );
}
