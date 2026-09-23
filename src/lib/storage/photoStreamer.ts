import { NextResponse } from 'next/server';
import type { Session } from '@/lib/auth/server';

/**
 * Serves a private Vercel Blob photo through an authenticated proxy.
 *
 * The only mechanism: fetch the blob URL server-side using the
 * BLOB_READ_WRITE_TOKEN as a Bearer credential, then stream the bytes back.
 * No SDK fallbacks, no URL cache, no DB lookup — just one fetch.
 *
 * The caller must supply a valid `session` — these are pictures of a
 * customer's vehicle outside their home and must never be served without auth.
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
    process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;

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
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=300',
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
