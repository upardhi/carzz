import { NextResponse, type NextRequest } from 'next/server';
import { servePhoto, corsHeaders } from '@/lib/storage/photoStreamer';
import { getSession } from '@/lib/auth/server';

/**
 * Authenticated proxy for private Vercel Blob photos.
 *
 * GET /api/photos?url=<encoded_blob_url>
 *
 * The `url` param must be a Vercel Blob storage URL.
 * The caller must be signed in — enforced inside servePhoto().
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  const { searchParams } = new URL(request.url);
  const url = decodeURIComponent(searchParams.get('url') || '');
  return servePhoto(url, session);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
