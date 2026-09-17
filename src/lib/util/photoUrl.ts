/**
 * Transforms stored photo URLs (such as private Vercel Blob URLs or storage keys) into
 * publicly accessible, fully-qualified proxy endpoints so that external apps, mobile apps,
 * and web dashboards can render previews reliably anywhere.
 */
export function resolvePublicPhotoUrl(
  rawUrl: string | null | undefined,
  baseUrl?: string,
): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Determine the default public base URL if not explicitly provided
  const base =
    baseUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  const formatUrl = (path: string) => {
    if (!base) return path;
    const cleanBase = base.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${cleanBase}${cleanPath}`;
  };

  // If already an API route or relative path
  if (trimmed.startsWith('/api/photos')) {
    return formatUrl(trimmed);
  }

  // If it is a private Vercel Blob URL, route through the streaming API endpoint
  if (trimmed.includes('.private.blob.vercel-storage.com')) {
    const proxyPath = `/api/photos?url=${encodeURIComponent(trimmed)}`;
    return formatUrl(proxyPath);
  }

  // If it's a bare visit photo key (e.g. "wash-123-before" or "washes/wash-123-before")
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) {
    const proxyPath = `/api/photos?key=${encodeURIComponent(trimmed)}`;
    return formatUrl(proxyPath);
  }

  return trimmed;
}
