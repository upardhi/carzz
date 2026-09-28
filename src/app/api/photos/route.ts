import { NextResponse, type NextRequest } from 'next/server';
import { servePhoto, corsHeaders, servePlaceholderResponse } from '@/lib/storage/photoStreamer';
import { getSession } from '@/lib/auth/server';

/**
 * Authenticated proxy for private Vercel Blob photos.
 *
 * GET /api/photos?url=<encoded_blob_url>
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url') || '';
  if (!url) {
    return servePlaceholderResponse('photo');
  }
  return servePhoto(url, session);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
