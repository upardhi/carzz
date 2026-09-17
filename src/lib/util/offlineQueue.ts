'use client';

export interface QueuedRequest {
  id: string;
  url: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body: string;
  label: string;
  createdAt: number;
}

const QUEUE_STORAGE_KEY = 'carzz_offline_sync_queue_v1';

export function getOfflineQueue(): QueuedRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedRequest[]) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: QueuedRequest[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage write errors
  }
}

export function queueOfflineRequest(req: Omit<QueuedRequest, 'id' | 'createdAt'>): QueuedRequest {
  const item: QueuedRequest = {
    ...req,
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  };

  const queue = getOfflineQueue();
  queue.push(item);
  saveOfflineQueue(queue);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('carzz:offline-queue-updated', { detail: { count: queue.length } }));
  }

  return item;
}

export async function flushOfflineQueue(
  onItemSynced?: (item: QueuedRequest, result: unknown) => void,
): Promise<{ success: number; failed: number }> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { success: 0, failed: 0 };
  }

  const queue = getOfflineQueue();
  if (queue.length === 0) return { success: 0, failed: 0 };

  const remaining: QueuedRequest[] = [];
  let successCount = 0;

  for (const item of queue) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          ...item.headers,
        },
        body: item.body,
      });

      if (res.ok) {
        successCount++;
        const data = await res.json().catch(() => null);
        onItemSynced?.(item, data);
      } else if (res.status >= 400 && res.status < 500) {
        // Client-level reject (e.g. validation / duplicate), do not re-try endlessly
        console.warn(`[Offline Sync] Request rejected by server (${res.status}):`, item);
      } else {
        // Server-level 5xx or network glitch during request, keep in queue
        remaining.push(item);
      }
    } catch {
      // Still no connection or network drop mid-flight
      remaining.push(item);
    }
  }

  saveOfflineQueue(remaining);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('carzz:offline-queue-updated', { detail: { count: remaining.length } }));
  }

  return { success: successCount, failed: remaining.length };
}

/**
 * Universal safe fetch that auto-queues offline submissions on network failure.
 */
export async function safeOfflineFetch<T = unknown>(
  url: string,
  options: {
    method?: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: string | Record<string, unknown>;
    label: string;
  },
): Promise<{ ok: boolean; queuedOffline?: boolean; data?: T; error?: string }> {
  const method = options.method || 'POST';
  const bodyString = typeof options.body === 'string' ? options.body : JSON.stringify(options.body ?? {});

  // If already known to be offline, queue immediately
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    queueOfflineRequest({
      url,
      method,
      headers: options.headers,
      body: bodyString,
      label: options.label,
    });
    return { ok: true, queuedOffline: true };
  }

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: bodyString,
    });

    const data = (await res.json().catch(() => null)) as T & { error?: string };

    if (!res.ok) {
      return { ok: false, error: (data as { error?: string })?.error ?? 'Server error.' };
    }

    return { ok: true, data };
  } catch {
    // Network failed or device dropped offline mid-request
    queueOfflineRequest({
      url,
      method,
      headers: options.headers,
      body: bodyString,
      label: options.label,
    });
    return { ok: true, queuedOffline: true };
  }
}
