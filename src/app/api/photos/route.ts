import { NextResponse, type NextRequest } from 'next/server';
import { servePhoto, corsHeaders } from '@/lib/storage/photoStreamer';
import { getSession } from '@/lib/auth/server';

/**
 * Universal photo streaming endpoint:
 * GET /api/photos?url=<encoded_private_url_or_key>
 * GET /api/photos?key=<storage_key>
 *
 * Authenticated by the caller's own session only — there is no caller-
 * supplied storage-token path. Accepting a token from a query param or
 * header would let anyone use this route as an open proxy onto whatever
 * storage account that token belongs to, session or not.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Please sign in to view photos.' },
      { status: 401, headers: corsHeaders() },
    );
  }
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('url') || searchParams.get('key') || '';
  return await servePhoto(target, session);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
