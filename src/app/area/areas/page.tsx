import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Card,
  CardHeading,
  Kpi,
  KpiGrid,
  Note,
  Row,
  Tag,
} from '@/components/ui/primitives';
import { requirePermission } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { areaPerformance } from '@/lib/services/reports';
import { currentCycle, cycleLabel, money, percent } from '@/lib/util/format';

export const metadata = { title: 'Areas' };

export default async function AreaAdminAreas() {
  const session = await requirePermission('report:area');
  const store = await getStore();
  const cycle = currentCycle();
  const performance = await areaPerformance(store, cycle, session.scope.areaIds);

  const managerIds = performance
    .map((p) => p.area.managerId)
    .filter(Boolean) as string[];
  const managers = new Map(
    (await Promise.all(managerIds.map((id) => store.staff.get(id))))
      .filter(Boolean)
      .map((m) => [m!.id, m!]),
  );

  const best = [...performance].sort((a, b) => b.margin - a.margin)[0];
  const worst = [...performance].sort((a, b) => a.margin - b.margin)[0];

  return (
    <>
      <PageHeader
        title="Areas in your region"
        description={`${cycleLabel(cycle)} · ${performance.length} areas`}
      />

      <KpiGrid>
        <Kpi
          label="Customers"
          value={performance.reduce((s, p) => s + p.customers, 0)}
        />
        <Kpi
          label="Collected"
          value={money(performance.reduce((s, p) => s + p.collected, 0))}
          tone="teal"
        />
        <Kpi
          label="Outstanding"
          value={money(performance.reduce((s, p) => s + p.outstanding, 0))}
          tone="gold"
        />
        <Kpi
          label="Washes done"
          value={performance.reduce((s, p) => s + p.washesDone, 0)}
        />
        <Kpi
          label="Washes missed"
          value={performance.reduce((s, p) => s + p.washesMissed, 0)}
          tone="gold"
        />
        <Kpi
          label="Staff"
          value={performance.reduce((s, p) => s + p.staff, 0)}
        />
      </KpiGrid>

      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {performance.map((area) => {
          const isWorst =
            performance.length > 1 && area.area.id === worst?.area.id;
          const isBest = performance.length > 1 && area.area.id === best?.area.id;

          return (
            <Card
              key={area.area.id}
              accent={isWorst ? 'danger' : isBest ? 'teal' : undefined}
              className="p-4"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold">{area.area.name}</h3>
                  <p className="text-xs text-ink-mute">
                    {area.area.managerId
                      ? (managers.get(area.area.managerId)?.name ?? 'No manager')
                      : 'No manager assigned'}
                  </p>
                </div>
                {isBest ? <Tag tone="ok">Best margin</Tag> : null}
                {isWorst ? <Tag tone="bad">Weakest</Tag> : null}
              </div>

              <Row label="Customers" value={area.customers} />
              <Row label="Cars" value={area.activeCars} />
              <Row label="Staff" value={area.staff} />
              <Row label="Collected" value={money(area.collected)} tone="teal" />
              <Row
                label="Outstanding"
                value={money(area.outstanding)}
                tone={area.outstanding > 0 ? 'gold' : undefined}
              />
              <Row
                label="Profit"
                value={`${money(area.profit)} (${percent(area.margin)})`}
                tone={area.profit > 0 ? 'teal' : 'danger'}
              />
              <Row
                label="Missed washes"
                value={area.washesMissed}
                tone={area.washesMissed > 30 ? 'danger' : undefined}
              />
              <Row
                label="Rating"
                value={area.averageRating ? `${area.averageRating.toFixed(1)} ★` : '—'}
              />

              {isWorst && worst && best && worst.margin < best.margin - 0.05 ? (
                <div className="mt-3">
                  <Note tone="danger">
                    {percent(worst.margin)} margin against {percent(best.margin)}{' '}
                    in {best.area.name}, on the same package prices. The gap is
                    route density and missed washes, not pricing.
                  </Note>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <div className="mt-4">
        <Card className="p-4">
          <CardHeading>How to read this</CardHeading>
          <p className="text-sm leading-relaxed text-ink-mute">
            Every missed wash returns to the customer&rsquo;s count, so it is
            delivered later at no extra charge. An area with many missed washes
            therefore carries the delivery cost twice — which is why a weak
            margin usually shows up here before it shows up in collection.
          </p>
        </Card>
      </div>
    </>
  );
}
