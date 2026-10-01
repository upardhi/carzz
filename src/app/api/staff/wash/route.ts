import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { MISS_REASONS } from '@/lib/data/types';
import { completeWash, missWash, WashRuleError } from '@/lib/services/visits';
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';
import { parsePackageServices } from '@/lib/data/types';
import { nextSlotAfter } from '@/lib/services/schedule';
import { currentCycle, cycleLabel, previousCycle } from '@/lib/util/format';
import { washDurationMinutes, washSpeedFlag } from '@/lib/util/washTiming';
const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('start'),
    visitId: z.string().min(1),
  }),
  z.object({
    action: z.literal('complete'),
    visitId: z.string().min(1),
    servicesDone: z.array(z.string()).min(1),
  }),
  z.object({
    action: z.literal('miss'),
    visitId: z.string().min(1),
    reason: z.enum(MISS_REASONS),
    note: z.string().max(500).optional(),
    rescheduleTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
]);

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('visit:complete');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 },
      );
    }

    const store = await getStore();
    const visit = await store.visits.get(parsed.data.visitId);
    if (!visit) throw new HttpError(404, 'That wash was not found.');

    const isAssigned = visit.staffId === session.user.staffId;
    const inScope =
      session.scope.areaIds === null ||
      session.scope.areaIds.includes(visit.areaId);
    if (!isAssigned && !(session.user.role !== 'EMPLOYEE' && inScope)) {
      throw new HttpError(403, 'This wash is not assigned to you.');
    }

    if (parsed.data.action === 'start') {
      const startedAt = visit.startedAt ?? new Date().toISOString();
      const updated = await store.visits.update(visit.id, {
        status: 'IN_PROGRESS',
        startedAt,
        staffId: session.user.staffId ?? visit.staffId ?? '',
      });
      return NextResponse.json({
        ok: true,
        visit: {
          ...updated,
          beforePhotoUrl: resolvePublicPhotoUrl(updated.beforePhotoUrl),
          afterPhotoUrl: resolvePublicPhotoUrl(updated.afterPhotoUrl),
        },
        startedAt,
        message: 'Wash started! Clock is running.',
      });
    }

    if (parsed.data.action === 'complete') {
      // The photo URLs come from the visit record, not the request body, so a
      // crafted payload cannot close a wash without real photos.
      const updated = await completeWash(store, visit.id, {
        staffId: session.user.staffId ?? visit.staffId ?? '',
        servicesDone: parsed.data.servicesDone,
        beforePhotoUrl: visit.beforePhotoUrl,
        afterPhotoUrl: visit.afterPhotoUrl,
      });
      return NextResponse.json({
        ok: true,
        visit: {
          ...updated,
          beforePhotoUrl: resolvePublicPhotoUrl(updated.beforePhotoUrl),
          afterPhotoUrl: resolvePublicPhotoUrl(updated.afterPhotoUrl),
        },
        message: 'Wash closed. Your earnings have been updated.',
      });
    }

    if (visit.status === 'IN_PROGRESS' || visit.startedAt || visit.beforePhotoUrl) {
      throw new HttpError(400, 'Cannot skip or mark vehicle as unavailable once cleaning has started.');
    }

    const { visit: updated, replacement } = await missWash(store, visit.id, {
      staffId: session.user.staffId ?? null,
      reason: parsed.data.reason,
      note: parsed.data.note,
      rescheduleTo: parsed.data.rescheduleTo,
    });

    return NextResponse.json({
      ok: true,
      visit: updated,
      replacement,
      message: replacement
        ? 'Recorded. The wash went back into the customer’s count.'
        : 'Recorded.',
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof WashRuleError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Could not save that. Try again.' },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireApiSession('visit:complete');
    const { searchParams } = new URL(request.url);
    const visitId = searchParams.get('visitId');
    if (!visitId) throw new HttpError(400, 'visitId is required');

    const store = await getStore();
    const visit = await store.visits.get(visitId);
    if (!visit) throw new HttpError(404, 'That wash was not found.');

    const isAssigned = visit.staffId === session.user.staffId;
    const inScope =
      session.scope.areaIds === null ||
      session.scope.areaIds.includes(visit.areaId);
    if (!isAssigned && !(session.user.role !== 'EMPLOYEE' && inScope)) {
      throw new HttpError(403, 'This wash is not assigned to you.');
    }

    const [car, customer, settings] = await Promise.all([
      store.cars.get(visit.carId),
      store.customers.get(visit.customerId),
      store.getAppSettings(),
    ]);
    if (!car || !customer) throw new HttpError(404, 'Car or customer not found');

    const pkg = await store.packages.get(car.packageId);

    const allCarVisits = await store.visits.find({
      where: { carId: car.id },
      orderBy: [{ field: 'scheduledDate', dir: 'desc' }],
      limit: 60,
    });

    const activeCycle = visit.cycle || currentCycle();
    const lastCycle = previousCycle(activeCycle);

    const parsedPackageServices = parsePackageServices(
      pkg?.services,
      pkg?.washesPerMonth ?? 8,
    );

    const serviceStats = parsedPackageServices.map((s) => {
      const matchingCompletedVisits = allCarVisits.filter(
        (v) =>
          v.status === 'DONE' &&
          v.id !== visit.id &&
          Array.isArray(v.servicesDone) &&
          v.servicesDone.some(
            (doneName) =>
              doneName.trim().toLowerCase() === s.name.trim().toLowerCase() ||
              doneName.trim().toLowerCase().includes(s.name.trim().toLowerCase()),
          ),
      );

      const timesDoneThisCycle = matchingCompletedVisits.filter(
        (v) => v.cycle === activeCycle,
      ).length;

      const timesDoneLastCycle = matchingCompletedVisits.filter(
        (v) => v.cycle === lastCycle,
      ).length;

      const lastDoneVisit = matchingCompletedVisits[0];
      const lastDoneDate = lastDoneVisit ? lastDoneVisit.scheduledDate : null;

      const isQuotaMet = timesDoneThisCycle >= s.washesPerMonth;
      const shouldDefaultSkip = isQuotaMet;

      return {
        name: s.name,
        quotaPerMonth: s.washesPerMonth,
        timesDoneThisCycle,
        timesDoneLastCycle,
        lastDoneDate,
        isQuotaMet,
        shouldDefaultSkip,
      };
    });

    const completedVisitsThisCycle = allCarVisits.filter(
      (v) => v.status === 'DONE' && v.cycle === activeCycle && v.id !== visit.id,
    );
    const totalDoneThisCycle = completedVisitsThisCycle.length;
    const totalPackageWashes = pkg?.washesPerMonth ?? 8;

    const completedVisitsLastCycle = allCarVisits.filter(
      (v) => v.status === 'DONE' && v.cycle === lastCycle,
    );
    const totalDoneLastCycle = completedVisitsLastCycle.length;

    const pastHistory = allCarVisits
      .filter((v) => v.id !== visit.id && (v.status === 'DONE' || v.status === 'MISSED'))
      .map((v) => ({
        id: v.id,
        cycle: v.cycle,
        date: v.scheduledDate,
        time: v.scheduledTime,
        status: v.status,
        servicesDone: v.servicesDone || [],
        beforePhotoUrl: resolvePublicPhotoUrl(v.beforePhotoUrl),
        afterPhotoUrl: resolvePublicPhotoUrl(v.afterPhotoUrl),
        rating: v.rating ?? null,
        ratingComment: v.ratingComment ?? null,
        missReason: v.missReason ?? null,
        missNote: v.missNote ?? null,
        durationMinutes: washDurationMinutes(v),
        speedFlag: washSpeedFlag(washDurationMinutes(v), settings),
        managerRating: v.managerRating ?? null,
        managerRatingComment: v.managerRatingComment ?? null,
      }));

    return NextResponse.json({
      ok: true,
      visit: {
        ...visit,
        beforePhotoUrl: resolvePublicPhotoUrl(visit.beforePhotoUrl),
        afterPhotoUrl: resolvePublicPhotoUrl(visit.afterPhotoUrl),
      },
      car,
      customer,
      package: pkg,
      services: parsedPackageServices.map((s) => s.name),
      serviceStats,
      totalPackageWashes,
      totalDoneThisCycle,
      totalDoneLastCycle,
      currentCycleLabel: cycleLabel(activeCycle),
      lastCycleLabel: cycleLabel(lastCycle),
      pastHistory,
      startedAt: visit.startedAt,
      beforePhotoUrl: resolvePublicPhotoUrl(visit.beforePhotoUrl),
      afterPhotoUrl: resolvePublicPhotoUrl(visit.afterPhotoUrl),
      nextSlotDate: nextSlotAfter(car, visit.scheduledDate),
      requireBothPhotos: settings.requireBothPhotos,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Could not load wash details.' },
      { status: 500 },
    );
  }
}

