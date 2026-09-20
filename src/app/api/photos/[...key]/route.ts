import { NextResponse, type NextRequest } from 'next/server';
import { servePhoto, corsHeaders } from '@/lib/storage/photoStreamer';
import { getSession } from '@/lib/auth/server';

/**
 * Universal photo key streaming endpoint:
 * GET /api/photos/wash-123-before
 * GET /api/photos/washes/wash-123-before
 *
 * Authenticated by the caller's own session only — see the sibling routes
 * in this folder for why a "server has a token" or caller-supplied-token
 * fallback is not safe here.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Please sign in to view photos.' },
      { status: 401, headers: corsHeaders() },
    );
  }
  const { key } = await params;
  const targetKey = Array.isArray(key) ? key.join('/') : String(key || '');
  return await servePhoto(targetKey, session);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
