import 'server-only';

/**
 * Where wash photos live.
 *
 * Photos are the product's proof of work, so they get the same treatment as
 * the database: one narrow interface, adapters behind it, chosen by env. The
 * default keeps them in process so the app runs with no bucket configured;
 * point `PHOTO_STORAGE` at `s3` or `firebase` once infrastructure is picked
 * and nothing above this file changes.
 */
export interface StoredPhoto {
  key: string;
  contentType: string;
  bytes: number;
  createdAt: string;
}

export interface PhotoStorage {
  put(
    key: string,
    data: Uint8Array,
    contentType: string,
  ): Promise<StoredPhoto>;
  get(key: string): Promise<{ data: Uint8Array; contentType: string } | null>;
  delete(key: string): Promise<void>;
  /** Public URL the app renders. Adapters may return a signed URL instead. */
  urlFor(key: string): string;
  /** Removes anything older than the retention window in app settings. */
  purgeOlderThan(cutoffIso: string): Promise<number>;
}

class MemoryPhotoStorage implements PhotoStorage {
  private readonly files = new Map<
    string,
    { data: Uint8Array; contentType: string; createdAt: string }
  >();

  async put(key: string, data: Uint8Array, contentType: string) {
    const createdAt = new Date().toISOString();
    this.files.set(key, { data, contentType, createdAt });
    return { key, contentType, bytes: data.byteLength, createdAt };
  }

  async get(key: string) {
    const file = this.files.get(key);
    return file ? { data: file.data, contentType: file.contentType } : null;
  }

  async delete(key: string) {
    this.files.delete(key);
  }

  urlFor(key: string) {
    return `/api/photos/${encodeURIComponent(key)}`;
  }

  async purgeOlderThan(cutoffIso: string) {
    let removed = 0;
    for (const [key, file] of this.files) {
      if (file.createdAt < cutoffIso) {
        this.files.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}

const globalForPhotos = globalThis as unknown as {
  __carzzPhotos?: PhotoStorage;
};

export function getPhotoStorage(): PhotoStorage {
  if (!globalForPhotos.__carzzPhotos) {
    // Only the in-process adapter ships today. An S3 or Firebase Storage
    // adapter implements this same interface and is selected here.
    globalForPhotos.__carzzPhotos = new MemoryPhotoStorage();
  }
  return globalForPhotos.__carzzPhotos;
}

/** Deterministic key so a re-upload replaces rather than duplicates. */
export function photoKey(
  visitId: string,
  kind: 'before' | 'after',
): string {
  return `${visitId}-${kind}`;
}
