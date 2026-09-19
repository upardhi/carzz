import { NextResponse } from 'next/server';
import { getPhotoStorage } from '@/lib/storage';

/**
 * Serves a public gallery image.
 *
 * Unlike /api/photos, this needs no session — these are marketing images the
 * owner uploaded deliberately. The `public-` prefix is enforced here so this
 * route can never be pointed at a customer's wash photo.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const decoded = decodeURIComponent(key);

  if (!decoded.startsWith('public-')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const storage = getPhotoStorage();
  const file = await storage.get(decoded);

  if (file?.url) {
    return NextResponse.redirect(file.url, { status: 307 });
  }

  if (file?.data) {
    return new NextResponse(Buffer.from(file.data), {
      headers: {
        'Content-Type': file.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  const externalUrl = storage.urlFor(decoded);
  if (externalUrl.startsWith('http://') || externalUrl.startsWith('https://')) {
    return NextResponse.redirect(externalUrl, { status: 307 });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

