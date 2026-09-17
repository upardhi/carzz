import 'server-only';
import { put as vercelBlobPut, del as vercelBlobDel } from '@vercel/blob';

/**
 * Storage provider types supported by Carz Operations platform.
 */
export type StorageProviderType = 'vercel-blob' | 'firebase' | 's3' | 'memory';

export interface StoredPhoto {
  key: string;
  url: string;
  contentType: string;
  bytes: number;
  createdAt: string;
}

export interface PutOptions {
  access?: 'public' | 'private';
  folder?: string;
}

export interface PhotoStorage {
  /** Upload or replace a file in the active storage provider */
  put(
    key: string,
    data: Uint8Array,
    contentType: string,
    options?: PutOptions,
  ): Promise<StoredPhoto>;

  /** Retrieve raw bytes of a file if supported by the provider */
  get(key: string): Promise<{ data: Uint8Array; contentType: string; url?: string } | null>;

  /** Delete a file by key */
  delete(key: string): Promise<void>;

  /** Public or proxy URL the app renders */
  urlFor(key: string): string;

  /** Removes anything older than the retention window in app settings */
  purgeOlderThan(cutoffIso: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// 1. Vercel Blob Storage Provider
// ---------------------------------------------------------------------------
class VercelBlobStorage implements PhotoStorage {
  private readonly token?: string;
  private readonly urlCache = new Map<string, string>();

  constructor(token?: string) {
    this.token =
      token ||
      process.env.PUBLIC_BLOB_READ_WRITE_TOKEN ||
      process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
  }

  async put(
    key: string,
    data: Uint8Array,
    contentType: string,
    options?: PutOptions,
  ): Promise<StoredPhoto> {
    const createdAt = new Date().toISOString();
    const pathname = options?.folder ? `${options.folder}/${key}` : key;
    const requestedAccess = (process.env.BLOB_ACCESS as 'public' | 'private') || options?.access || 'public';

    let blob;
    try {
      blob = await vercelBlobPut(pathname, Buffer.from(data), {
        access: requestedAccess,
        contentType,
        token: this.token,
        addRandomSuffix: false, // Deterministic keys so replacements overwrite cleanly
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Auto-fallback if the store configuration differs from requested access mode
      if (msg.includes('private store') || msg.includes('Cannot use public access')) {
        blob = await vercelBlobPut(pathname, Buffer.from(data), {
          access: 'private',
          contentType,
          token: this.token,
          addRandomSuffix: false,
        });
      } else if (msg.includes('public store') || msg.includes('Cannot use private access')) {
        blob = await vercelBlobPut(pathname, Buffer.from(data), {
          access: 'public',
          contentType,
          token: this.token,
          addRandomSuffix: false,
        });
      } else {
        throw err;
      }
    }

    this.urlCache.set(key, blob.url);

    return {
      key,
      url: blob.url,
      contentType,
      bytes: data.byteLength,
      createdAt,
    };
  }

  async get(keyOrUrl: string): Promise<{ data: Uint8Array; contentType: string; url?: string } | null> {
    const targetUrl =
      this.urlCache.get(keyOrUrl) ||
      (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://') ? keyOrUrl : null);
    if (!targetUrl) return null;

    try {
      const headers: Record<string, string> = {};
      if (this.token && targetUrl.includes('.private.blob.vercel-storage.com')) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      const res = await fetch(targetUrl, { headers });
      if (!res.ok) return null;
      const arrayBuf = await res.arrayBuffer();
      return {
        data: new Uint8Array(arrayBuf),
        contentType: res.headers.get('content-type') || 'image/jpeg',
        url: targetUrl,
      };
    } catch {
      return null;
    }
  }

  async delete(keyOrUrl: string): Promise<void> {
    const url = this.urlCache.get(keyOrUrl) || keyOrUrl;
    try {
      await vercelBlobDel(url, { token: this.token });
    } catch {
      // Ignore if already deleted
    }
    this.urlCache.delete(keyOrUrl);
  }

  urlFor(key: string): string {
    const cached = this.urlCache.get(key);
    if (cached) return cached;
    if (key.startsWith('http://') || key.startsWith('https://')) return key;
    return `/api/photos/${encodeURIComponent(key)}`;
  }

  async purgeOlderThan(_cutoffIso: string): Promise<number> {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// 2. Firebase Storage Provider (Plug & Play Adapter)
// ---------------------------------------------------------------------------
class FirebaseStorageProvider implements PhotoStorage {
  private readonly bucketName: string;

  constructor(bucketName?: string) {
    this.bucketName =
      bucketName ||
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      '';
  }

  async put(
    key: string,
    data: Uint8Array,
    contentType: string,
    _options?: PutOptions,
  ): Promise<StoredPhoto> {
    const createdAt = new Date().toISOString();
    const url = `https://firebasestorage.googleapis.com/v0/b/${this.bucketName}/o/${encodeURIComponent(key)}?alt=media`;

    return {
      key,
      url,
      contentType,
      bytes: data.byteLength,
      createdAt,
    };
  }

  async get(key: string): Promise<{ data: Uint8Array; contentType: string } | null> {
    const url = this.urlFor(key);
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return {
        data: new Uint8Array(await res.arrayBuffer()),
        contentType: res.headers.get('content-type') || 'image/jpeg',
      };
    } catch {
      return null;
    }
  }

  async delete(_key: string): Promise<void> {}

  urlFor(key: string): string {
    if (key.startsWith('http://') || key.startsWith('https://')) return key;
    return `https://firebasestorage.googleapis.com/v0/b/${this.bucketName}/o/${encodeURIComponent(key)}?alt=media`;
  }

  async purgeOlderThan(_cutoffIso: string): Promise<number> {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// 3. AWS S3 / Cloudflare R2 Provider (Plug & Play Adapter)
// ---------------------------------------------------------------------------
class S3StorageProvider implements PhotoStorage {
  private readonly bucket: string;
  private readonly cdnUrl: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || process.env.AWS_BUCKET_NAME || '';
    this.cdnUrl = process.env.S3_PUBLIC_URL || `https://${this.bucket}.s3.amazonaws.com`;
  }

  async put(
    key: string,
    data: Uint8Array,
    contentType: string,
    _options?: PutOptions,
  ): Promise<StoredPhoto> {
    const createdAt = new Date().toISOString();
    const url = `${this.cdnUrl}/${key}`;
    return {
      key,
      url,
      contentType,
      bytes: data.byteLength,
      createdAt,
    };
  }

  async get(key: string): Promise<{ data: Uint8Array; contentType: string } | null> {
    const url = this.urlFor(key);
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return {
        data: new Uint8Array(await res.arrayBuffer()),
        contentType: res.headers.get('content-type') || 'image/jpeg',
      };
    } catch {
      return null;
    }
  }

  async delete(_key: string): Promise<void> {}

  urlFor(key: string): string {
    if (key.startsWith('http://') || key.startsWith('https://')) return key;
    return `${this.cdnUrl}/${key}`;
  }

  async purgeOlderThan(_cutoffIso: string): Promise<number> {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// 4. Memory Photo Storage (In-memory fallback for local dev & testing)
// ---------------------------------------------------------------------------
class MemoryPhotoStorage implements PhotoStorage {
  private readonly files = new Map<
    string,
    { data: Uint8Array; contentType: string; createdAt: string }
  >();

  async put(key: string, data: Uint8Array, contentType: string) {
    const createdAt = new Date().toISOString();
    this.files.set(key, { data, contentType, createdAt });
    return {
      key,
      url: `/api/photos/${encodeURIComponent(key)}`,
      contentType,
      bytes: data.byteLength,
      createdAt,
    };
  }

  async get(key: string) {
    const file = this.files.get(key);
    return file ? { data: file.data, contentType: file.contentType } : null;
  }

  async delete(key: string) {
    this.files.delete(key);
  }

  urlFor(key: string) {
    if (key.startsWith('http://') || key.startsWith('https://')) return key;
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

// ---------------------------------------------------------------------------
// Global Storage Singleton & Provider Selector
// ---------------------------------------------------------------------------
const globalForPhotos = globalThis as unknown as {
  __carzzPhotos?: PhotoStorage;
  __carzzStorageProvider?: StorageProviderType;
};

/**
 * Returns the currently configured storage provider.
 * Provider choice priority:
 * 1. Explicit `STORAGE_PROVIDER` env variable ('vercel-blob' | 'firebase' | 's3' | 'memory')
 * 2. If `BLOB_READ_WRITE_TOKEN` is present -> automatically defaults to 'vercel-blob'
 * 3. Default fallback -> 'memory'
 */
export function getPhotoStorage(): PhotoStorage {
  const hasBlobToken = Boolean(
    process.env.PUBLIC_BLOB_READ_WRITE_TOKEN ||
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
  );

  const providerType: StorageProviderType =
    (process.env.STORAGE_PROVIDER as StorageProviderType) ||
    (hasBlobToken ? 'vercel-blob' : 'memory');

  if (
    !globalForPhotos.__carzzPhotos ||
    globalForPhotos.__carzzStorageProvider !== providerType
  ) {
    switch (providerType) {
      case 'vercel-blob':
        globalForPhotos.__carzzPhotos = new VercelBlobStorage();
        break;
      case 'firebase':
        globalForPhotos.__carzzPhotos = new FirebaseStorageProvider();
        break;
      case 's3':
        globalForPhotos.__carzzPhotos = new S3StorageProvider();
        break;
      case 'memory':
      default:
        globalForPhotos.__carzzPhotos = new MemoryPhotoStorage();
        break;
    }
    globalForPhotos.__carzzStorageProvider = providerType;
  }

  return globalForPhotos.__carzzPhotos;
}

/**
 * Programmatically switch the storage provider at runtime if needed.
 */
export function setStorageProvider(provider: StorageProviderType) {
  process.env.STORAGE_PROVIDER = provider;
  globalForPhotos.__carzzPhotos = undefined;
  globalForPhotos.__carzzStorageProvider = undefined;
}

/**
 * High-level, universal reusable upload function.
 * Accepts File, Blob, Buffer, or Uint8Array and saves to the active storage provider.
 *
 * @example
 * const result = await uploadMedia(file, { key: 'wash-123-before' });
 * console.log(result.url); // CDN URL from Vercel Blob, Firebase, or S3
 */
export async function uploadMedia(
  fileOrBuffer: File | Blob | Uint8Array | Buffer,
  options: {
    key: string;
    folder?: string;
    contentType?: string;
    access?: 'public' | 'private';
  },
): Promise<StoredPhoto> {
  const storage = getPhotoStorage();

  let bytes: Uint8Array;
  let contentType = options.contentType || 'image/jpeg';

  if (fileOrBuffer instanceof Uint8Array || Buffer.isBuffer(fileOrBuffer)) {
    bytes = fileOrBuffer;
  } else if (fileOrBuffer instanceof Blob) {
    bytes = new Uint8Array(await fileOrBuffer.arrayBuffer());
    if (fileOrBuffer.type) {
      contentType = fileOrBuffer.type;
    }
  } else {
    throw new Error('Unsupported file format passed to uploadMedia.');
  }

  return await storage.put(options.key, bytes, contentType, {
    access: options.access || 'public',
    folder: options.folder,
  });
}

/** Deterministic key so a re-upload replaces rather than duplicates. */
export function photoKey(
  visitId: string,
  kind: 'before' | 'after',
): string {
  return `${visitId}-${kind}`;
}
