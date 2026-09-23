/**
 * Converts a stored blob URL or bare key into a relative proxy path
 * that the browser can load through /api/photos.
 *
 * Always returns a relative path (never an absolute URL) so the link
 * works regardless of which Vercel deployment URL is active.
 */
export function resolvePublicPhotoUrl(
  rawUrl: string | null | undefined,
): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Already a proxy path — return as-is
  if (trimmed.startsWith('/api/photos')) return trimmed;

  // Any Vercel Blob URL (private or public) → proxy with Bearer auth
  if (trimmed.includes('.blob.vercel-storage.com')) {
    return `/api/photos?url=${encodeURIComponent(trimmed)}`;
  }

  // Bare storage key (e.g. "visit-123-before" or "washes/visit-123-before")
  if (
    !trimmed.startsWith('http://') &&
    !trimmed.startsWith('https://') &&
    !trimmed.startsWith('/')
  ) {
    return `/api/photos?url=${encodeURIComponent(trimmed)}`;
  }

  return trimmed;
}
