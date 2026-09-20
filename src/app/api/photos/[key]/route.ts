import { NextResponse, type NextRequest } from 'next/server';
import { servePhoto, corsHeaders } from '@/lib/storage/photoStreamer';
import { getSession } from '@/lib/auth/server';

/**
 * Streams a wash photo by storage key or filename.
 * Supports CORS so mobile apps and external consumers can preview images seamlessly.
 *
 * Authenticated by the caller's own session only. A "server has a storage
 * token configured" fallback would make login optional for every request —
 * this app always has a token configured, so that fallback is effectively
 * "no auth required." There is no caller-supplied-token path either: a
 * client handing in its own storage credential turns this into an open
 * proxy onto whatever account that credential belongs to.
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
  return await servePhoto(key, session);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
