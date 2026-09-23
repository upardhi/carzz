import { resolvePublicPhotoUrl } from './photoUrl';

/**
 * Resolves a safe, viewable URL for staff documents, Aadhaar cards, PAN cards,
 * and uploaded KYC files.
 *
 * If the URL is hosted on Vercel Blob store (private or public), routes it through
 * the authenticated /api/photos proxy so browsers can render previews without 403 Forbidden errors.
 */
export function getSafeDocumentUrl(url: string | null | undefined): string {
  if (!url) return '';
  const resolved = resolvePublicPhotoUrl(url);
  return resolved || '';
}
