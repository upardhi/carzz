import { NextResponse, type NextRequest } from 'next/server';
import { servePhoto, corsHeaders, servePlaceholderResponse } from '@/lib/storage/photoStreamer';
import { getSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';

/**
 * Same as /api/photos/[key] but handles paths with folder segments.
 *
 * GET /api/photos/washes/visit-123-before
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const session = await getSession();
  const { key } = await params;
  const fullKey = Array.isArray(key) ? key.join('/') : String(key || '');
  const bareKey = fullKey.replace(/^washes\//, '');
  const decoded = decodeURIComponent(bareKey || '');

  const isBefore = decoded.endsWith('-before') || decoded.includes('before');
  const isAfter = decoded.endsWith('-after') || decoded.includes('after');

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
      // Fall through to placeholder
    }

    return servePlaceholderResponse(isBefore ? 'before' : 'after');
  }

  return servePlaceholderResponse('photo');
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
