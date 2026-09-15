import { NextResponse, type NextRequest } from 'next/server';
import { servePhoto, corsHeaders } from '@/lib/storage/photoStreamer';

/**
 * Universal photo streaming endpoint:
 * GET /api/photos?url=<encoded_private_url_or_key>
 * GET /api/photos?key=<storage_key>
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('url') || searchParams.get('key') || '';
  return await servePhoto(target);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
