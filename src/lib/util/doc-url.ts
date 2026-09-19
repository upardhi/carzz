/**
 * Resolves a safe, viewable URL for staff documents and uploaded KYC files.
 * If the URL is hosted on a private Vercel Blob store, routes it through our
 * authenticated preview proxy so browsers can render thumbnails and images without 403 Forbidden errors.
 */
export function getSafeDocumentUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (trimmed.includes('.private.blob.vercel-storage.com')) {
    return `/api/ops/staff/doc/preview?url=${encodeURIComponent(trimmed)}`;
  }

  return trimmed;
}
