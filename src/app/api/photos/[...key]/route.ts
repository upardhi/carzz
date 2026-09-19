import { NextResponse, type NextRequest } from 'next/server';
import { servePhoto, corsHeaders } from '@/lib/storage/photoStreamer';
import { getSession } from '@/lib/auth/server';

/**
 * Universal photo key streaming endpoint:
 * GET /api/photos/wash-123-before
 * GET /api/photos/washes/wash-123-before
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const url = new URL(request.url);
  const customToken =
    url.searchParams.get('token') ||
    url.searchParams.get('blobToken') ||
    url.searchParams.get('secret') ||
    request.headers.get('x-blob-token') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    null;

  const session = await getSession();
  if (!session && !customToken) {
    const serverHasToken =
      process.env.PRIVATE_BLOB_READ_WRITE_TOKEN ||
      process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.VERCEL_BLOB_READ_WRITE_TOKEN ||
      process.env.PUBLIC_BLOB_READ_WRITE_TOKEN;

    if (!serverHasToken) {
      return NextResponse.json(
        { error: 'Please sign in or provide a blob token to view photos.' },
        { status: 401, headers: corsHeaders() },
      );
    }
  }

  const { key } = await params;
  const targetKey = Array.isArray(key) ? key.join('/') : String(key || '');
  return await servePhoto(targetKey, { customToken });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
