import { NextResponse, type NextRequest } from 'next/server';
import { servePhoto, corsHeaders } from '@/lib/storage/photoStreamer';

/**
 * Universal photo streaming endpoint:
 * GET /api/photos?url=<encoded_private_url_or_key>&token=<optional_blob_token>
 * GET /api/photos?key=<storage_key>&token=<optional_blob_token>
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('url') || searchParams.get('key') || '';
  const customToken =
    searchParams.get('token') ||
    searchParams.get('blobToken') ||
    searchParams.get('secret') ||
    request.headers.get('x-blob-token') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    null;

  return await servePhoto(target, { customToken });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
