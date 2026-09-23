import { type NextRequest } from 'next/server';
import { servePhoto, corsHeaders } from '@/lib/storage/photoStreamer';
import { getSession } from '@/lib/auth/server';

/**
 * Authenticated proxy endpoint to stream staff documents and KYC proofs.
 * Delegates to the unified servePhoto engine.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  const { searchParams } = new URL(request.url);
  const targetUrl = decodeURIComponent(searchParams.get('url') || '');
  return servePhoto(targetUrl, session);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}
