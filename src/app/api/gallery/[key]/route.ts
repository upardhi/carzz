import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';

/**
 * Serves a public gallery image.
 *
 * Gallery images are uploaded with public access to Vercel Blob and their
 * full CDN URLs are stored in the database. This route finds the URL and
 * redirects directly — no auth required, these are marketing images the
 * owner uploaded deliberately.
 *
 * The `public-` prefix check ensures this route can never be pointed at a
 * customer's private wash photo.
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

  try {
    const store = await getStore();
    const content = await store.getSiteContent();
    const item = content.gallery.find(
      (g) =>
        g.beforeUrl?.includes(decoded) || g.afterUrl?.includes(decoded),
    );

    if (item) {
      const targetUrl = item.beforeUrl?.includes(decoded)
        ? item.beforeUrl
        : item.afterUrl;

      if (targetUrl && targetUrl.startsWith('http')) {
        return NextResponse.redirect(targetUrl, { status: 307 });
      }
    }
  } catch {
    // Fall through to 404
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
