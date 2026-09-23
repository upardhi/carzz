import 'server-only';
import { put, del } from '@vercel/blob';

export interface StoredPhoto {
  key: string;
  url: string;
  contentType: string;
  bytes: number;
  createdAt: string;
}

/**
 * Uploads a file to Vercel Blob with private access.
 * Always private — wash photos are customer vehicles outside their home
 * and must never be publicly accessible without an authenticated session.
 */
export async function uploadMedia(
  fileOrBuffer: File | Blob | Uint8Array | Buffer,
  options: {
    key: string;
    folder?: string;
    contentType?: string;
  },
): Promise<StoredPhoto> {
  const token =
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;

  let bytes: Uint8Array;
  let contentType = options.contentType || 'image/jpeg';

  if (fileOrBuffer instanceof Uint8Array || Buffer.isBuffer(fileOrBuffer)) {
    bytes = fileOrBuffer as Uint8Array;
  } else if (fileOrBuffer instanceof Blob) {
    bytes = new Uint8Array(await fileOrBuffer.arrayBuffer());
    if (fileOrBuffer.type) contentType = fileOrBuffer.type;
  } else {
    throw new Error('Unsupported file format passed to uploadMedia.');
  }

  const pathname = options.folder
    ? `${options.folder}/${options.key}`
    : options.key;

  const blob = await put(pathname, Buffer.from(bytes), {
    access: 'private',
    contentType,
    token,
    addRandomSuffix: false,
  });

  return {
    key: options.key,
    url: blob.url,
    contentType,
    bytes: bytes.byteLength,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Deletes a file from Vercel Blob by its full blob URL.
 * Safe to call with null/undefined — does nothing.
 */
export async function deleteMedia(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const trimmed = url.trim();
  if (!trimmed || !trimmed.includes('.blob.vercel-storage.com')) return;

  const token =
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;

  try {
    await del(trimmed, { token });
  } catch {
    // Ignore if already deleted or not found
  }
}

/** Deterministic key so a re-upload replaces rather than duplicates. */
export function photoKey(
  visitId: string,
  kind: 'before' | 'after',
): string {
  return `${visitId}-${kind}`;
}
