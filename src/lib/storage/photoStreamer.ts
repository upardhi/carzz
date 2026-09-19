import { NextResponse } from 'next/server';
import { get as vercelBlobGet, head as vercelBlobHead } from '@vercel/blob';
import { getPhotoStorage } from '@/lib/storage';
import { getStore } from '@/lib/data';

export interface ServePhotoOptions {
  customToken?: string | null;
}

/**
 * Universal photo streaming handler.
 * Fetches and streams photos from private or public cloud storage (Vercel Blob,
 * S3, Firebase, Memory) directly to client apps with CORS and caching enabled.
 * Supports external sites and React Native apps passing blob tokens via query or headers.
 */
export async function servePhoto(target: string, options?: ServePhotoOptions) {
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

  // Support an explicitly provided custom token (from query/header), or fallback to server env tokens
  const token =
    options?.customToken ||
    process.env.PRIVATE_BLOB_READ_WRITE_TOKEN ||
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN ||
    process.env.BLOB_STORE_READ_WRITE_TOKEN ||
    process.env.PUBLIC_BLOB_READ_WRITE_TOKEN;

  // 1. If it's a Vercel Blob URL, use the official @vercel/blob SDK get/head methods
  if (decoded.includes('.blob.vercel-storage.com')) {
    const isPrivate = decoded.includes('.private.blob.vercel-storage.com');

    // 1a. Try @vercel/blob get method
    try {
      const blobResult = await vercelBlobGet(decoded, {
        access: isPrivate ? 'private' : 'public',
        token,
      });

      if (blobResult?.statusCode === 200 && blobResult.stream) {
        const arrayBuf = await new Response(blobResult.stream as BodyInit).arrayBuffer();
        return new NextResponse(Buffer.from(arrayBuf), {
          status: 200,
          headers: {
            'Content-Type': blobResult.blob.contentType || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
            ...corsHeaders(),
          },
        });
      }
    } catch (blobErr) {
      console.warn('[photoStreamer] @vercel/blob SDK get failed, trying head/download fallback:', blobErr);
    }

    // 1b. Try @vercel/blob head method to obtain a presigned downloadUrl
    try {
      const headInfo = await vercelBlobHead(decoded, { token });
      if (headInfo?.downloadUrl) {
        const downloadRes = await fetch(headInfo.downloadUrl);
        if (downloadRes.ok) {
          const contentType = downloadRes.headers.get('content-type') || headInfo.contentType || 'image/jpeg';
          const arrayBuf = await downloadRes.arrayBuffer();
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
    } catch (headErr) {
      console.warn('[photoStreamer] @vercel/blob SDK head fallback failed:', headErr);
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
              ? 'BLOB_READ_WRITE_TOKEN is missing on server or in query params for private Vercel Blob access'
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

  // 4. Fallback: Lookup in database store by visit key
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
          return await servePhoto(targetUrl, options);
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-blob-token',
    'Access-Control-Max-Age': '86400',
  };
}
