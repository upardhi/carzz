import { NextResponse } from 'next/server';
import { get as vercelBlobGet } from '@vercel/blob';
import { getPhotoStorage } from '@/lib/storage';
import { getStore } from '@/lib/data';

/**
 * Universal photo streaming handler.
 * Fetches and streams photos from private or public cloud storage (Vercel Blob,
 * S3, Firebase, Memory) directly to client apps with CORS and caching enabled.
 */
export async function servePhoto(target: string) {
  if (!target) {
    return NextResponse.json(
      { error: 'Missing photo target' },
      { status: 400, headers: corsHeaders() },
    );
  }

  let decoded = target;
  try {
    decoded = decodeURIComponent(target).trim();
  } catch {
    decoded = target.trim();
  }

  const token =
    process.env.PUBLIC_BLOB_READ_WRITE_TOKEN ||
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN;

  // 1. If it's a Vercel Blob URL, use the official @vercel/blob SDK get method
  if (decoded.includes('.blob.vercel-storage.com')) {
    try {
      const isPrivate = decoded.includes('.private.blob.vercel-storage.com');
      const blobResult = await vercelBlobGet(decoded, {
        access: isPrivate ? 'private' : 'public',
        token,
      });

      if (blobResult?.statusCode === 200 && blobResult.stream) {
        return new NextResponse(blobResult.stream as never, {
          status: 200,
          headers: {
            'Content-Type': blobResult.blob.contentType || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
            ...corsHeaders(),
          },
        });
      }
    } catch (blobErr) {
      console.warn('[photoStreamer] @vercel/blob SDK get failed, trying direct fetch:', blobErr);
    }
  }

  // 2. If it's a full URL (Vercel Blob, S3, Firebase, Unsplash, etc.)
  if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
    try {
      const headers: Record<string, string> = {};
      if (token && decoded.includes('.private.blob.vercel-storage.com')) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(decoded, { headers });
      if (!res.ok) {
        console.warn(`[photoStreamer] Upstream fetch failed for ${decoded}: ${res.status} ${res.statusText}`);
        return NextResponse.json(
          {
            error: 'Photo not found or inaccessible from storage provider',
            upstreamStatus: res.status,
            hint: decoded.includes('.private.blob.vercel-storage.com') && !token
              ? 'BLOB_READ_WRITE_TOKEN is missing on server for private Vercel Blob access'
              : undefined,
          },
          { status: res.status === 404 ? 404 : 502, headers: corsHeaders() },
        );
      }

      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const arrayBuf = await res.arrayBuffer();

      return new NextResponse(Buffer.from(arrayBuf), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
          ...corsHeaders(),
        },
      });
    } catch (err) {
      console.error('[photoStreamer] Error streaming photo by URL:', err);
      return NextResponse.json(
        { error: 'Failed to fetch photo from storage' },
        { status: 500, headers: corsHeaders() },
      );
    }
  }

  // 3. If it's a storage key, try the active storage provider first
  const storage = getPhotoStorage();
  try {
    const file = await storage.get(decoded);
    if (file?.data) {
      return new NextResponse(Buffer.from(file.data), {
        status: 200,
        headers: {
          'Content-Type': file.contentType || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
          ...corsHeaders(),
        },
      });
    }
  } catch (err) {
    console.warn('Storage provider get failed, falling back to DB lookup:', err);
  }

  // 3. Fallback: Lookup in database store by visit key
  try {
    const cleanKey = decoded.replace(/^washes\//, '');
    const isBefore = cleanKey.endsWith('-before');
    const isAfter = cleanKey.endsWith('-after');

    if (isBefore || isAfter) {
      const visitId = cleanKey.replace(/-(before|after)$/, '');
      const store = await getStore();
      const visit = await store.visits.get(visitId);

      if (visit) {
        const targetUrl = isBefore ? visit.beforePhotoUrl : visit.afterPhotoUrl;
        if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
          const headers: Record<string, string> = {};
          if (token && targetUrl.includes('.private.blob.vercel-storage.com')) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          const res = await fetch(targetUrl, { headers });
          if (res.ok) {
            const contentType = res.headers.get('content-type') || 'image/jpeg';
            const arrayBuf = await res.arrayBuffer();
            return new NextResponse(Buffer.from(arrayBuf), {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
                ...corsHeaders(),
              },
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Error resolving photo key from DB:', err);
  }

  return NextResponse.json(
    { error: 'Photo not found' },
    { status: 404, headers: corsHeaders() },
  );
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}
