import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import type { Session } from '@/lib/auth/server';

/**
 * Serves a private Vercel Blob photo or document through an authenticated proxy.
 *
 * Uses the official @vercel/blob SDK get() with private access and Bearer auth fallback,
 * streaming the content with Content-Disposition: inline and strict private cache headers.
 */
export async function servePhoto(
  url: string,
  session: Session | null | undefined,
): Promise<NextResponse> {
  if (!session) {
    return NextResponse.json(
      { error: 'Please sign in to view photos.' },
      { status: 401, headers: corsHeaders() },
    );
  }

  if (!url) {
    return NextResponse.json(
      { error: 'Missing photo URL.' },
      { status: 400, headers: corsHeaders() },
    );
  }

  const decoded = url.trim();

  // SSRF guard — only fetch from Vercel Blob storage
  if (!decoded.includes('.blob.vercel-storage.com')) {
    return NextResponse.json(
      { error: 'That URL is not a recognized photo storage location.' },
      { status: 400, headers: corsHeaders() },
    );
  }

  const token =
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.PRIVATE_BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN;

  try {
    // Try official @vercel/blob get()
    const result = await get(decoded, {
      access: 'private',
      token: token || undefined,
    });

    if (result && result.statusCode === 200 && 'stream' in result && result.stream) {
      const ext = decoded.split('?')[0].split('.').pop()?.toLowerCase();
      const fallbackContentType =
        ext === 'png'
          ? 'image/png'
          : ext === 'webp'
          ? 'image/webp'
          : ext === 'pdf'
          ? 'application/pdf'
          : 'image/jpeg';

      const contentType = result.blob?.contentType || fallbackContentType;

      return new NextResponse(result.stream as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': 'inline',
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          ...corsHeaders(),
        },
      });
    }
  } catch (sdkErr) {
    console.warn('[photoServe] SDK get() attempt failed, trying direct fetch:', sdkErr);
  }

  // Fallback to direct Bearer fetch
  try {
    const res = await fetch(decoded, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Photo not found or access denied.' },
        { status: res.status === 404 ? 404 : 502, headers: corsHeaders() },
      );
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const arrayBuf = await res.arrayBuffer();

    return new NextResponse(Buffer.from(arrayBuf), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        ...corsHeaders(),
      },
    });
  } catch (err) {
    console.error('[photoServe] Failed to fetch blob:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve photo.' },
      { status: 500, headers: corsHeaders() },
    );
  }
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}
