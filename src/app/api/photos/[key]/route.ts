import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/server';
import { getPhotoStorage } from '@/lib/storage';

/**
 * Serves a wash photo.
 *
 * Access is gated on a session rather than being public: these are photographs
 * of customers' vehicles outside their homes, and a guessable public URL would
 * make the whole fleet browsable.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const session = await requireApiSession().catch(() => null);
  if (!session) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { key } = await params;
  const file = await getPhotoStorage().get(decodeURIComponent(key));
  if (!file) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  }

  return new NextResponse(Buffer.from(file.data), {
    headers: {
      'Content-Type': file.contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
