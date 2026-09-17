import { NextResponse } from 'next/server';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { getPhotoStorage, photoKey } from '@/lib/storage';

/**
 * Maintenance endpoint to purge wash photos older than the retention period.
 *
 * Can be triggered:
 * 1. By an Admin from the Settings dashboard (authenticated session with `settings:manage`).
 * 2. By an automated scheduled cron job (Vercel Cron) sending `Authorization: Bearer <CRON_SECRET>`.
 */
async function handlePurge(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCron =
      Boolean(cronSecret) &&
      Boolean(authHeader) &&
      authHeader?.replace(/^Bearer\s+/i, '').trim() === cronSecret?.trim();

    if (!isCron) {
      await requireApiSession('settings:manage');
    }

    const store = await getStore();
    const appSettings = await store.getAppSettings();
    const retentionMonths = appSettings.photoRetentionMonths || 1;

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - retentionMonths);
    const cutoffDateStr = cutoff.toISOString().slice(0, 10);

    // Fetch all visits with photos older than retention window
    const allVisits = await store.visits.find();
    const expiredVisitsWithPhotos = allVisits.filter(
      (v) =>
        v.scheduledDate < cutoffDateStr &&
        (Boolean(v.beforePhotoUrl) || Boolean(v.afterPhotoUrl)),
    );

    const storage = getPhotoStorage();
    let purgedPhotos = 0;
    let freedBytes = 0;

    for (const visit of expiredVisitsWithPhotos) {
      if (visit.beforePhotoUrl) {
        await storage.delete(visit.beforePhotoUrl);
        await storage.delete(photoKey(visit.id, 'before'));
        purgedPhotos += 1;
        freedBytes += visit.beforePhotoBytes ?? 250000;
      }
      if (visit.afterPhotoUrl) {
        await storage.delete(visit.afterPhotoUrl);
        await storage.delete(photoKey(visit.id, 'after'));
        purgedPhotos += 1;
        freedBytes += visit.afterPhotoBytes ?? 250000;
      }

      await store.visits.update(visit.id, {
        beforePhotoUrl: null,
        afterPhotoUrl: null,
        beforePhotoBytes: null,
        afterPhotoBytes: null,
      });
    }

    return NextResponse.json({
      ok: true,
      retentionMonths,
      cutoffDate: cutoffDateStr,
      purgedVisits: expiredVisitsWithPhotos.length,
      purgedPhotos,
      freedBytes,
      message: `Cleaned up ${purgedPhotos} expired photos from ${expiredVisitsWithPhotos.length} visits older than ${retentionMonths} month(s).`,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Could not run photo maintenance.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handlePurge(request);
}

export async function GET(request: Request) {
  return handlePurge(request);
}

