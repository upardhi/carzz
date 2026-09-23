import { NextResponse, type NextRequest } from 'next/server';
import { servePhoto, corsHeaders } from '@/lib/storage/photoStreamer';
import { getSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';

/**
 * Resolves a bare storage key to its blob URL via DB lookup, then serves it.
 *
 * GET /api/photos/visit-123-before
 * GET /api/photos/visit-123-after
 *
 * Used when a URL stored in the DB is already a /api/photos/<key> path
 * (e.g. from seed data or older uploads).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Please sign in to view photos.' },
      { status: 401, headers: corsHeaders() },
    );
  }

  const { key } = await params;
  const decoded = decodeURIComponent(key);

  // Try to resolve the key to a blob URL via DB lookup
  const isBefore = decoded.endsWith('-before');
  const isAfter = decoded.endsWith('-after');

  if (isBefore || isAfter) {
    try {
      const visitId = decoded.replace(/-(before|after)$/, '');
      const store = await getStore();
      const visit = await store.visits.get(visitId);

      if (visit) {
        const blobUrl = isBefore ? visit.beforePhotoUrl : visit.afterPhotoUrl;
        if (blobUrl && blobUrl.includes('.blob.vercel-storage.com')) {
          return servePhoto(blobUrl, session);
        }
      }
    } catch {
      // Fall through to 404
    }
  }

  return NextResponse.json(
    { error: 'Photo not found.' },
    { status: 404, headers: corsHeaders() },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
