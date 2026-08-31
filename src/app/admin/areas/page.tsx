import { PageHeader } from '@/components/shell/ConsoleShell';
import {
  Card,
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

export default async function AdminAreas() {
  await requirePermission('area:manage');
  const store = await getStore();
  const cycle = currentCycle();

  const [performance, staff, regions] = await Promise.all([
    areaPerformance(store, cycle, null),
    store.staff.find({ where: { role: 'MANAGER' } }),
    store.regions.find(),
  ]);

  const managerById = new Map(staff.map((s) => [s.id, s]));
  const regionById = new Map(regions.map((r) => [r.id, r]));
  const ranked = [...performance].sort((a, b) => b.margin - a.margin);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  return (
    <>
      <PageHeader
        title="Areas"
        description={`${cycleLabel(cycle)} · compare side by side to decide where to expand`}
      />

      <KpiGrid>
        <Kpi label="Areas" value={performance.length} />
        <Kpi
          label="Customers"
          value={performance.reduce((s, p) => s + p.customers, 0)}
        />
        <Kpi
          label="Collected"
          value={money(performance.reduce((s, p) => s + p.collected, 0))}
          tone="success"
        />
        <Kpi
          label="Profit"
          value={money(performance.reduce((s, p) => s + p.profit, 0))}
          tone="success"
        />
        <Kpi label="Best margin" value={best ? percent(best.margin) : '—'} tone="success" />
        <Kpi
          label="Weakest margin"
          value={worst ? percent(worst.margin) : '—'}
          tone="danger"
        />
      </KpiGrid>

      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {ranked.map((area) => {
          const isWorst = ranked.length > 1 && area.area.id === worst?.area.id;
          const isBest = ranked.length > 1 && area.area.id === best?.area.id;
          return (
            <Card
              key={area.area.id}
              accent={isWorst ? 'danger' : isBest ? 'success' : undefined}
              className="p-4"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold">{area.area.name}</h3>
                  <p className="text-xs text-ink-mute">
                    {area.area.managerId
                      ? (managerById.get(area.area.managerId)?.name ?? 'No manager')
                      : 'No manager assigned'}
                    {' · '}
                    {regionById.get(area.area.regionId)?.name ?? ''}
                  </p>
                </div>
                {isBest ? <Tag tone="ok">Best margin</Tag> : null}
                {isWorst ? <Tag tone="bad">Weakest</Tag> : null}
              </div>

              <Row label="Customers" value={area.customers} />
              <Row label="Cars" value={area.activeCars} />
              <Row label="Staff" value={area.staff} />
              <Row label="Collected" value={money(area.collected)} tone="success" />
              <Row label="Outstanding" value={money(area.outstanding)} tone="gold" />
              <Row label="Staff cost" value={money(area.payoutCost)} />
              <Row label="Goods cost" value={money(area.goodsCost)} />
              <Row
                label="Profit"
                value={`${money(area.profit)} (${percent(area.margin)})`}
                tone={area.profit > 0 ? 'success' : 'danger'}
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

              {isWorst && best && worst && worst.margin < best.margin - 0.04 ? (
                <div className="mt-3">
                  <Note tone="danger">
                    {worst.washesMissed} missed washes against{' '}
                    {best.washesMissed} in {best.area.name}. Every one returns to
                    the customer&rsquo;s count and is delivered later at the same
                    price — that is where the margin goes.
                  </Note>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </>
  );
}
