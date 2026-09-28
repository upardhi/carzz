import { NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import type { Session } from '@/lib/auth/server';

export function generatePhotoPlaceholderSvg(
  kind: 'before' | 'after' | string = 'before',
  label?: string,
): string {
  const isBefore = kind.toLowerCase().includes('before');
  const title = isBefore ? 'BEFORE WASH' : 'AFTER WASH';
  const subtitle = label || (isBefore ? 'Pre-wash Inspection Photo' : 'Post-wash Quality Inspected');
  const bgGrad1 = isBefore ? '#1e293b' : '#064e3b';
  const bgGrad2 = isBefore ? '#0f172a' : '#022c22';
  const accent = isBefore ? '#f59e0b' : '#10b981';
  const badgeBg = isBefore ? 'rgba(245, 158, 11, 0.18)' : 'rgba(16, 185, 129, 0.18)';
  const badgeBorder = isBefore ? '#f59e0b' : '#10b981';
  const badgeText = isBefore ? '#fbbf24' : '#34d399';
  const icon = isBefore ? '🚿' : '✨';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgGrad1}"/>
      <stop offset="100%" stop-color="${bgGrad2}"/>
    </linearGradient>
    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="600" height="450" fill="url(#bg)"/>
  <rect width="600" height="450" fill="url(#grid)"/>

  <!-- Car outline silhouette -->
  <g transform="translate(160, 95) scale(1.1)" stroke="${accent}" stroke-width="3.5" fill="none" opacity="0.9">
    <path d="M 25,95 Q 30,65 55,60 L 80,30 Q 95,15 140,15 L 175,15 Q 210,15 225,30 L 250,60 Q 275,65 280,95 L 285,115 L 20,115 Z" fill="rgba(255,255,255,0.03)"/>
    <circle cx="75" cy="115" r="20" fill="${bgGrad2}" stroke="${accent}" stroke-width="4"/>
    <circle cx="230" cy="115" r="20" fill="${bgGrad2}" stroke="${accent}" stroke-width="4"/>
    <circle cx="75" cy="115" r="8" fill="${accent}"/>
    <circle cx="230" cy="115" r="8" fill="${accent}"/>
    <line x1="85" y1="60" x2="220" y2="60" stroke="rgba(255,255,255,0.25)" stroke-width="2.5"/>
    <line x1="145" y1="20" x2="145" y2="60" stroke="rgba(255,255,255,0.25)" stroke-width="2.5"/>
  </g>

  <!-- Status pill badge -->
  <g transform="translate(300, 275)">
    <rect x="-120" y="-19" width="240" height="38" rx="19" fill="${badgeBg}" stroke="${badgeBorder}" stroke-width="2"/>
    <text x="0" y="5" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="${badgeText}" text-anchor="middle" letter-spacing="1.5">
      ${icon} ${title}
    </text>
  </g>

  <!-- Subtitle -->
  <text x="300" y="340" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600" fill="rgba(255,255,255,0.85)" text-anchor="middle">
    ${subtitle}
  </text>
  <text x="300" y="365" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="400" fill="rgba(255,255,255,0.45)" text-anchor="middle">
    Carzz Professional Vehicle Detailing
  </text>
</svg>`;
}

export function servePlaceholderResponse(kind: string, label?: string): NextResponse {
  const svg = generatePhotoPlaceholderSvg(kind, label);
  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=86400',
      ...corsHeaders(),
    },
  });
}

/**
 * Serves a private Vercel Blob photo or document through an authenticated proxy.
 *
 * Uses the official @vercel/blob SDK get() with private access and Bearer auth fallback,
 * streaming the content with Content-Disposition: inline and strict private cache headers.
 */
export async function servePhoto(
  url: string,
  _session?: Session | null,
): Promise<NextResponse> {
  if (!url) {
    return servePlaceholderResponse('photo');
  }

  const decoded = url.trim();
  const isBefore = decoded.includes('before');
  const isAfter = decoded.includes('after');

  // SSRF guard — only fetch from Vercel Blob storage
  if (!decoded.includes('.blob.vercel-storage.com')) {
    if (isBefore || isAfter) {
      return servePlaceholderResponse(isBefore ? 'before' : 'after');
    }
    return servePlaceholderResponse('photo');
  }

  const token =
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.PRIVATE_BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN;

  try {
    // Try official @vercel/blob get()
    const result = await get(decoded, {
      access: 'private',
      token: token || undefined,
    });

    if (result && result.statusCode === 200 && 'stream' in result && result.stream) {
      const ext = decoded.split('?')[0].split('.').pop()?.toLowerCase();
      const fallbackContentType =
        ext === 'png'
          ? 'image/png'
          : ext === 'webp'
          ? 'image/webp'
          : ext === 'pdf'
          ? 'application/pdf'
          : 'image/jpeg';

      const contentType = result.blob?.contentType || fallbackContentType;

      return new NextResponse(result.stream as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': 'inline',
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          ...corsHeaders(),
        },
      });
    }
  } catch (sdkErr) {
    console.warn('[photoServe] SDK get() attempt failed, trying direct fetch:', sdkErr);
  }

  // Fallback to direct Bearer fetch
  try {
    const res = await fetch(decoded, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      if (isBefore || isAfter) {
        return servePlaceholderResponse(isBefore ? 'before' : 'after');
      }
      return NextResponse.json(
        { error: 'Photo not found or access denied.' },
        { status: res.status === 404 ? 404 : 502, headers: corsHeaders() },
      );
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const arrayBuf = await res.arrayBuffer();

    return new NextResponse(Buffer.from(arrayBuf), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        ...corsHeaders(),
      },
    });
  } catch (err) {
    console.error('[photoServe] Failed to fetch blob:', err);
    if (isBefore || isAfter) {
      return servePlaceholderResponse(isBefore ? 'before' : 'after');
    }
    return NextResponse.json(
      { error: 'Failed to retrieve photo.' },
      { status: 500, headers: corsHeaders() },
    );
  }
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}
