import { NextRequest, NextResponse } from 'next/server';

/**
 * Parses coordinates from Google Maps URLs (full or redirected).
 */
function extractCoordsFromUrl(targetUrl: string): { lat: number; lng: number } | null {
  // Pattern 1: @20.7458,78.6022
  const atMatch = targetUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Pattern 2: !3d20.7458!4d78.6022
  const dMatch = targetUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dMatch) {
    const lat = parseFloat(dMatch[1]);
    const lng = parseFloat(dMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Pattern 3: q=20.7458,78.6022 or ll=20.7458,78.6022 or loc:20.7458,78.6022
  const qMatch = targetUrl.match(/(?:q|ll|loc:)=?(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Pattern 4: /maps/place/.../data=...!3d20.7458!4d78.6022
  const placeMatch = targetUrl.match(/\/maps\/place\/[^/]+\/(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (placeMatch) {
    const lat = parseFloat(placeMatch[1]);
    const lng = parseFloat(placeMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  return null;
}

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url');
  if (!urlParam) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  const trimmed = urlParam.trim();

  // Try direct regex extraction first
  const directCoords = extractCoordsFromUrl(trimmed);
  if (directCoords) {
    return NextResponse.json({ ...directCoords, resolvedUrl: trimmed });
  }

  // If it's a short URL (maps.app.goo.gl, goo.gl, etc.), follow redirect
  if (trimmed.includes('goo.gl') || trimmed.includes('maps.app') || trimmed.includes('http')) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(trimmed, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const finalUrl = res.url;
      const coords = extractCoordsFromUrl(finalUrl);

      if (coords) {
        return NextResponse.json({ ...coords, resolvedUrl: finalUrl });
      }

      // Also check response text for meta tags / og:image / og:url
      const html = await res.text();
      const ogMatch =
        html.match(/meta property="og:url" content="([^"]+)"/) ||
        html.match(/meta content="([^"]+)" property="og:url"/);
      if (ogMatch && ogMatch[1]) {
        const ogCoords = extractCoordsFromUrl(ogMatch[1]);
        if (ogCoords) {
          return NextResponse.json({ ...ogCoords, resolvedUrl: ogMatch[1] });
        }
      }

      // Check for coordinates in HTML content like center=20.7458,78.6022
      const centerMatch = html.match(/center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/);
      if (centerMatch) {
        const lat = parseFloat(centerMatch[1]);
        const lng = parseFloat(centerMatch[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          return NextResponse.json({ lat, lng, resolvedUrl: finalUrl });
        }
      }
    } catch {
      // Fallback
    }
  }

  return NextResponse.json({ error: 'Could not resolve coordinates from link' }, { status: 404 });
}
