import { NextResponse, type NextRequest } from 'next/server';
import { requireApiSession } from '@/lib/auth/server';

/**
 * Authenticated proxy endpoint to stream staff documents and KYC proofs.
 * Handles both private Vercel Blob URLs (using Bearer token authorization)
 * and standard media URLs.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession().catch(() => null);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const headers: Record<string, string> = {};

    if (token && targetUrl.includes('.private.blob.vercel-storage.com')) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const upstreamRes = await fetch(targetUrl, { headers });
    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: 'Document not found or access denied from storage provider' },
        { status: upstreamRes.status },
      );
    }

    const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await upstreamRes.arrayBuffer();

    return new NextResponse(Buffer.from(arrayBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=86400, stale-while-revalidate=3600',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve document';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
