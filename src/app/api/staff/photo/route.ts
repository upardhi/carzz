import { NextResponse } from 'next/server';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { getPhotoStorage, photoKey } from '@/lib/storage';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

/** Uploads a before or after photo for a visit the caller is assigned to. */
export async function POST(request: Request) {
  try {
    const session = await requireApiSession('visit:complete');

    const form = await request.formData();
    const visitId = String(form.get('visitId') ?? '');
    const kind = String(form.get('kind') ?? '');
    const file = form.get('photo');

    if (kind !== 'before' && kind !== 'after') {
      throw new HttpError(400, 'Photo kind must be before or after.');
    }
    if (!(file instanceof File)) {
      throw new HttpError(400, 'No photo was attached.');
    }
    if (file.size > MAX_BYTES) {
      throw new HttpError(413, 'That photo is too large. Try again.');
    }
    if (file.type && !ALLOWED.includes(file.type)) {
      throw new HttpError(415, 'Only photos can be uploaded.');
    }

    const store = await getStore();
    const visit = await store.visits.get(visitId);
    if (!visit) throw new HttpError(404, 'That wash was not found.');

    // A wash boy may only attach photos to his own car; a manager covering an
    // absence may attach to anything inside their area.
    const isAssigned = visit.staffId === session.user.staffId;
    const inScope =
      session.scope.areaIds === null ||
      session.scope.areaIds.includes(visit.areaId);
    if (!isAssigned && !(session.user.role !== 'EMPLOYEE' && inScope)) {
      throw new HttpError(403, 'This wash is not assigned to you.');
    }

    const key = photoKey(visitId, kind);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const storage = getPhotoStorage();
    await storage.put(key, bytes, file.type || 'image/jpeg');

    // Record it on the visit immediately so a crash between upload and submit
    // does not lose the wash boy's work.
    await store.visits.update(visitId, {
      [kind === 'before' ? 'beforePhotoUrl' : 'afterPhotoUrl']:
        storage.urlFor(key),
      ...(kind === 'before' && !visit.startedAt
        ? { startedAt: new Date().toISOString(), status: 'IN_PROGRESS' as const }
        : {}),
    });

    return NextResponse.json({ ok: true, url: storage.urlFor(key) });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Could not save that photo.' },
      { status: 500 },
    );
  }
}
