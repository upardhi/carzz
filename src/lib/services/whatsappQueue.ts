import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import { sendWhatsAppMessage, normalizePhoneNumber } from './whatsapp';

export type WhatsAppRecipientType = 'CUSTOMER' | 'STAFF';

export type WhatsAppJobStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED';

export interface WhatsAppMessageRecord {
  id: string;
  to: string;
  from?: string;
  direction?: 'OUTBOUND' | 'INBOUND';
  recipientName: string;
  recipientType: WhatsAppRecipientType;
  recipientId?: string;
  event: string;
  message: string;
  mediaUrl?: string;
  status: WhatsAppJobStatus;
  metaMessageId?: string | null;
  error?: string | null;
  retryCount: number;
  maxRetries: number;
  batchId?: string | null;
  createdAt: string;
  sentAt?: string | null;
  scheduledFor?: string | null;
  dedupKey?: string | null;
  senderUserId?: string | null;
  senderUserName?: string | null;
  senderRole?: string | null;
}

export interface EnqueueWhatsAppOptions {
  to: string;
  recipientName: string;
  recipientType: WhatsAppRecipientType;
  recipientId?: string;
  event: string;
  message: string;
  mediaUrl?: string;
  batchId?: string;
  maxRetries?: number;
  delayMs?: number;
  dedupKey?: string;
  dedupWindowSeconds?: number;
  senderUserId?: string | null;
  senderUserName?: string | null;
  senderRole?: string | null;
}

export interface BatchEnqueueResult {
  batchId: string;
  total: number;
  queuedAt: string;
}

export interface WhatsAppLogQuery {
  page?: number;
  limit?: number;
  status?: WhatsAppJobStatus | 'ALL';
  event?: string;
  recipientType?: WhatsAppRecipientType | 'ALL';
  recipientId?: string;
  batchId?: string;
  search?: string;
  allowedPhones?: Set<string> | string[];
  allowedRecipientIds?: Set<string> | string[];
}

export interface WhatsAppStats {
  total: number;
  totalSent: number;
  totalFailed: number;
  totalQueued: number;
  totalProcessing: number;
  successRate: number;
  isWorkerActive: boolean;
  rateLimitPerSec: number;
}

// ============================================================================
// IN-MEMORY + DISK PERSISTENCE ENGINE (No Redis required)
// ============================================================================

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'whatsapp_messages.json');

// Memory storage holding all jobs and track records
const messageStore: Map<string, WhatsAppMessageRecord> = new Map();
let isInitialized = false;
let isWorkerRunning = false;
let saveDebounceTimer: NodeJS.Timeout | null = null;

// Rate limiting & concurrency configuration (calibrated for Meta Cloud API)
const RATE_LIMIT_MSG_PER_SEC = 40; // Max 40 msg/sec (~25ms interval)
const DISPATCH_INTERVAL_MS = Math.ceil(1000 / RATE_LIMIT_MSG_PER_SEC);
const MAX_CONCURRENT_CALLS = 10;
let currentActiveCalls = 0;

/** Load persistent track record from disk */
function initStore() {
  if (isInitialized) return;
  isInitialized = true;

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const list = JSON.parse(raw) as WhatsAppMessageRecord[];
      messageStore.clear();

      for (const item of list) {
        // Recover any jobs that were abruptly interrupted during server restart
        if (item.status === 'PROCESSING') {
          item.status = 'QUEUED';
        }
        messageStore.set(item.id, item);
      }
    }
  } catch (err) {
    console.error('[WhatsAppQueue] Error loading persistent queue from disk:', err);
  }

  // Resume worker if there are pending jobs
  triggerWorker();
}

/** Save store to disk (debounced to avoid heavy I/O during 50,000-job bursts) */
function schedulePersist() {
  if (saveDebounceTimer) return;

  saveDebounceTimer = setTimeout(() => {
    saveDebounceTimer = null;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      // Retain last 100,000 records on disk for permanent track record
      const allRecords = Array.from(messageStore.values()).slice(-100000);
      fs.writeFileSync(DATA_FILE, JSON.stringify(allRecords), 'utf-8');
    } catch (err) {
      console.error('[WhatsAppQueue] Error persisting queue to disk:', err);
    }
  }, 1000);
}

// ============================================================================
// ENQUEUE FUNCTIONS (Handles 1 to 50,000 jobs seamlessly)
// ============================================================================

function generateId(prefix = 'wq'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/** Enqueue a single WhatsApp message with deduplication & debounce protection */
export function enqueueWhatsAppMessage(options: EnqueueWhatsAppOptions): WhatsAppMessageRecord {
  initStore();

  const now = new Date();
  const normalizedTo = normalizePhoneNumber(options.to);
  const dedupKey = options.dedupKey ? options.dedupKey.trim() : null;
  const dedupWindowMs = (options.dedupWindowSeconds ?? (dedupKey ? 86400 : 60)) * 1000;

  // Deduplication guard:
  // 1. If explicit dedupKey is specified: prevent duplicate enqueue within dedupWindowMs
  // 2. If no dedupKey: guard against rapid double-clicks / retries (same recipient + event + message within 60s)
  for (const existing of messageStore.values()) {
    const ageMs = now.getTime() - new Date(existing.createdAt).getTime();
    if (ageMs > dedupWindowMs) continue;

    if (dedupKey && existing.dedupKey === dedupKey) {
      console.log(
        `[WhatsAppQueue] Deduplicating message with dedupKey "${dedupKey}" (existing id: ${existing.id}, status: ${existing.status})`,
      );
      return existing;
    }

    if (
      !dedupKey &&
      existing.to === normalizedTo &&
      existing.event === options.event &&
      existing.message === options.message
    ) {
      console.log(
        `[WhatsAppQueue] Deduplicating identical message to ${normalizedTo} for event "${options.event}" (existing id: ${existing.id})`,
      );
      return existing;
    }
  }

  const scheduledFor = options.delayMs
    ? new Date(now.getTime() + options.delayMs).toISOString()
    : now.toISOString();

  const job: WhatsAppMessageRecord = {
    id: generateId('wq'),
    to: normalizedTo,
    direction: 'OUTBOUND',
    recipientName: options.recipientName || 'Recipient',
    recipientType: options.recipientType,
    recipientId: options.recipientId,
    event: options.event,
    message: options.message,
    mediaUrl: options.mediaUrl,
    status: 'QUEUED',
    metaMessageId: null,
    error: null,
    retryCount: 0,
    maxRetries: options.maxRetries ?? 3,
    batchId: options.batchId ?? null,
    createdAt: now.toISOString(),
    sentAt: null,
    scheduledFor,
    dedupKey,
    senderUserId: options.senderUserId ?? null,
    senderUserName: options.senderUserName ?? (options.event.includes('Direct') ? 'Staff Member' : 'System Automation'),
    senderRole: options.senderRole ?? null,
  };

  messageStore.set(job.id, job);
  schedulePersist();
  triggerWorker();

  return job;
}

/** Bulk enqueue up to 50,000 messages at once without blocking the request */
export function enqueueWhatsAppBatch(
  jobs: EnqueueWhatsAppOptions[],
  batchLabel?: string,
): BatchEnqueueResult {
  initStore();

  const now = new Date();
  const batchId = `batch_${now.toISOString().slice(0, 10)}_${Math.random().toString(36).substring(2, 8)}${batchLabel ? `_${batchLabel}` : ''}`;
  let queuedCount = 0;

  for (const item of jobs) {
    const normalizedTo = normalizePhoneNumber(item.to);
    const dedupKey = item.dedupKey ? item.dedupKey.trim() : null;
    const dedupWindowMs = (item.dedupWindowSeconds ?? (dedupKey ? 86400 : 60)) * 1000;

    // Check duplicate in store
    let isDuplicate = false;
    for (const existing of messageStore.values()) {
      const ageMs = now.getTime() - new Date(existing.createdAt).getTime();
      if (ageMs > dedupWindowMs) continue;

      if (dedupKey && existing.dedupKey === dedupKey) {
        isDuplicate = true;
        break;
      }
      if (
        !dedupKey &&
        existing.to === normalizedTo &&
        existing.event === item.event &&
        existing.message === item.message
      ) {
        isDuplicate = true;
        break;
      }
    }

    if (isDuplicate) continue;

    const job: WhatsAppMessageRecord = {
      id: generateId('wq'),
      to: normalizedTo,
      direction: 'OUTBOUND',
      recipientName: item.recipientName || 'Recipient',
      recipientType: item.recipientType,
      recipientId: item.recipientId,
      event: item.event,
      message: item.message,
      mediaUrl: item.mediaUrl,
      status: 'QUEUED',
      metaMessageId: null,
      error: null,
      retryCount: 0,
      maxRetries: item.maxRetries ?? 3,
      batchId,
      createdAt: now.toISOString(),
      sentAt: null,
      scheduledFor: item.delayMs
        ? new Date(now.getTime() + item.delayMs).toISOString()
        : now.toISOString(),
      dedupKey,
    };

    messageStore.set(job.id, job);
    queuedCount++;
  }

  schedulePersist();
  triggerWorker();

  return {
    batchId,
    total: queuedCount,
    queuedAt: now.toISOString(),
  };
}

export interface RecordInboundWhatsAppOptions {
  from: string;
  senderName?: string;
  message: string;
  mediaUrl?: string;
  metaMessageId?: string;
  timestamp?: string;
}

/** Record an inbound reply from a customer received via WhatsApp Webhook or manual simulation */
export function recordInboundWhatsAppMessage(
  options: RecordInboundWhatsAppOptions,
): WhatsAppMessageRecord {
  initStore();

  const now = new Date();
  const normalizedFrom = normalizePhoneNumber(options.from);

  // Deduplicate if Meta sends webhook multiple times with same message ID
  if (options.metaMessageId) {
    for (const existing of messageStore.values()) {
      if (existing.metaMessageId === options.metaMessageId) {
        return existing;
      }
    }
  }

  const job: WhatsAppMessageRecord = {
    id: generateId('wq_in'),
    to: normalizedFrom, // Group into the same customer thread by phone number
    from: normalizedFrom,
    direction: 'INBOUND',
    recipientName: options.senderName || 'Customer',
    recipientType: 'CUSTOMER',
    event: 'Customer Reply',
    message: options.message,
    mediaUrl: options.mediaUrl,
    status: 'SENT',
    metaMessageId: options.metaMessageId || null,
    error: null,
    retryCount: 0,
    maxRetries: 0,
    batchId: null,
    createdAt: options.timestamp || now.toISOString(),
    sentAt: options.timestamp || now.toISOString(),
    scheduledFor: null,
    dedupKey: null,
  };

  messageStore.set(job.id, job);
  schedulePersist();

  return job;
}

export interface UpdateStatusOptions {
  metaMessageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp?: string;
  errorMessage?: string;
}

/** Update message status from Meta Cloud API webhook delivery/read receipts */
export function updateWhatsAppMessageStatus(options: UpdateStatusOptions): boolean {
  initStore();
  const { metaMessageId, status, timestamp, errorMessage } = options;

  let found = false;
  for (const record of messageStore.values()) {
    if (record.metaMessageId === metaMessageId) {
      if (status === 'sent' && (record.status === 'QUEUED' || record.status === 'PROCESSING')) {
        record.status = 'SENT';
        record.sentAt = timestamp || record.sentAt || new Date().toISOString();
      } else if (status === 'delivered' && record.status !== 'READ') {
        record.status = 'DELIVERED';
      } else if (status === 'read') {
        record.status = 'READ';
      } else if (status === 'failed') {
        record.status = 'FAILED';
        if (errorMessage) record.error = errorMessage;
      }
      found = true;
      break;
    }
  }

  if (found) {
    schedulePersist();
  }
  return found;
}

// ============================================================================
// RATE-LIMITED WORKER PROCESSOR
// ============================================================================

function triggerWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;
  processQueue().catch((err) => {
    console.error('[WhatsAppQueue] Worker uncaught exception:', err);
    isWorkerRunning = false;
  });
}

async function processQueue() {
  while (true) {
    const nowIso = new Date().toISOString();

    // Find next eligible QUEUED job whose scheduledFor <= now
    let nextJob: WhatsAppMessageRecord | null = null;
    for (const job of messageStore.values()) {
      if (job.status === 'QUEUED' && (!job.scheduledFor || job.scheduledFor <= nowIso)) {
        nextJob = job;
        break;
      }
    }

    if (!nextJob) {
      // Check if there are future delayed jobs
      let hasFutureJobs = false;
      for (const job of messageStore.values()) {
        if (job.status === 'QUEUED') {
          hasFutureJobs = true;
          break;
        }
      }

      if (hasFutureJobs) {
        // Sleep briefly and check again for scheduled retries
        await new Promise((res) => setTimeout(res, 2000));
        continue;
      }

      // No more jobs left to process — worker idles
      isWorkerRunning = false;
      schedulePersist();
      break;
    }

    // Wait if max concurrent active calls reached
    while (currentActiveCalls >= MAX_CONCURRENT_CALLS) {
      await new Promise((res) => setTimeout(res, 50));
    }

    // Mark job as processing
    nextJob.status = 'PROCESSING';
    currentActiveCalls++;

    // Dispatch asynchronously with rate-limit pacing
    dispatchSingleJob(nextJob)
      .finally(() => {
        currentActiveCalls--;
      });

    // Enforce rate limiter delay between dispatches (40 msg/sec)
    await new Promise((res) => setTimeout(res, DISPATCH_INTERVAL_MS));
  }
}

async function dispatchSingleJob(job: WhatsAppMessageRecord) {
  try {
    const result = await sendWhatsAppMessage({
      to: job.to,
      message: job.message,
      ...(job.mediaUrl
        ? {
          media: {
            type: 'image',
            url: job.mediaUrl,
          },
        }
        : {}),
    });

    if (result.success) {
      job.status = 'SENT';
      job.metaMessageId = result.messageId || 'mock_delivered';
      job.sentAt = new Date().toISOString();
      job.error = null;
    } else {
      handleJobFailure(job, result.error || 'Meta API returned error');
    }
  } catch (err) {
    handleJobFailure(job, err instanceof Error ? err.message : String(err));
  }

  schedulePersist();
}

function handleJobFailure(job: WhatsAppMessageRecord, errorMsg: string) {
  job.retryCount++;
  job.error = errorMsg;

  if (job.retryCount < job.maxRetries) {
    // Exponential backoff: 5s, 15s, 45s
    const backoffSeconds = Math.pow(3, job.retryCount) * 5;
    job.status = 'QUEUED';
    job.scheduledFor = new Date(Date.now() + backoffSeconds * 1000).toISOString();
    console.warn(
      `[WhatsAppQueue] Job ${job.id} failed (attempt ${job.retryCount}/${job.maxRetries}). Retrying in ${backoffSeconds}s. Reason: ${errorMsg}`,
    );
  } else {
    job.status = 'FAILED';
    console.error(
      `[WhatsAppQueue] Job ${job.id} to ${job.to} PERMANENTLY FAILED after ${job.retryCount} attempts: ${errorMsg}`,
    );
  }
}

// ============================================================================
// QUERY & DASHBOARD TRACK RECORD APIS
// ============================================================================

/** Get paginated message logs with filtering for the dashboard */
export function getWhatsAppLog(query: WhatsAppLogQuery = {}) {
  initStore();

  const {
    page = 1,
    limit = 20,
    status = 'ALL',
    event,
    recipientType = 'ALL',
    recipientId,
    batchId,
    search,
    allowedPhones,
    allowedRecipientIds,
  } = query;

  let records = Array.from(messageStore.values());

  // Filters
  if (status !== 'ALL') {
    records = records.filter((r) => r.status === status);
  }

  if (recipientType !== 'ALL') {
    records = records.filter((r) => r.recipientType === recipientType);
  }

  if (event && event !== 'ALL') {
    records = records.filter((r) => r.event.toLowerCase() === event.toLowerCase());
  }

  if (recipientId) {
    records = records.filter((r) => r.recipientId === recipientId);
  }

  if (batchId) {
    records = records.filter((r) => r.batchId === batchId);
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    records = records.filter((r) =>
      r.to.includes(q) ||
      r.recipientName.toLowerCase().includes(q) ||
      r.message.toLowerCase().includes(q) ||
      r.event.toLowerCase().includes(q),
    );
  }

  // Scoped Area Restriction: If allowed phones or recipient IDs are specified (e.g. for Manager or Area Admin)
  if (allowedPhones || allowedRecipientIds) {
    const phoneSet = allowedPhones
      ? allowedPhones instanceof Set
        ? allowedPhones
        : new Set(allowedPhones)
      : null;
    const idSet = allowedRecipientIds
      ? allowedRecipientIds instanceof Set
        ? allowedRecipientIds
        : new Set(allowedRecipientIds)
      : null;

    records = records.filter((r) => {
      if (idSet && r.recipientId && idSet.has(r.recipientId)) return true;
      if (phoneSet && (phoneSet.has(r.to) || (r.from && phoneSet.has(r.from)))) return true;
      return false;
    });
  }

  // Sort descending by creation date (newest first)
  records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const total = records.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const start = (page - 1) * limit;
  const paginated = records.slice(start, start + limit);

  return {
    records: paginated,
    total,
    page,
    limit,
    totalPages,
  };
}

/** Get overall queue health and delivery statistics */
export function getWhatsAppStats(): WhatsAppStats {
  initStore();

  let totalSent = 0;
  let totalFailed = 0;
  let totalQueued = 0;
  let totalProcessing = 0;

  for (const r of messageStore.values()) {
    if (r.status === 'SENT' || r.status === 'DELIVERED' || r.status === 'READ') totalSent++;
    else if (r.status === 'FAILED') totalFailed++;
    else if (r.status === 'QUEUED') totalQueued++;
    else if (r.status === 'PROCESSING') totalProcessing++;
  }

  const total = messageStore.size;
  const finished = totalSent + totalFailed;
  const successRate = finished > 0 ? Number(((totalSent / finished) * 100).toFixed(1)) : 100;

  return {
    total,
    totalSent,
    totalFailed,
    totalQueued,
    totalProcessing,
    successRate,
    isWorkerActive: isWorkerRunning,
    rateLimitPerSec: RATE_LIMIT_MSG_PER_SEC,
  };
}

/** Get live progress of a large batch (e.g. 50,000 customers) */
export function getBatchProgress(batchId: string) {
  initStore();

  const batchJobs = Array.from(messageStore.values()).filter((r) => r.batchId === batchId);
  const total = batchJobs.length;

  if (total === 0) return null;

  let sent = 0;
  let failed = 0;
  let queued = 0;
  let processing = 0;

  for (const j of batchJobs) {
    if (j.status === 'SENT' || j.status === 'DELIVERED' || j.status === 'READ') sent++;
    else if (j.status === 'FAILED') failed++;
    else if (j.status === 'QUEUED') queued++;
    else if (j.status === 'PROCESSING') processing++;
  }

  const completed = sent + failed;
  const percent = total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0;
  const remaining = total - completed;
  const estimatedTimeRemainingSeconds = Math.ceil(remaining / RATE_LIMIT_MSG_PER_SEC);

  return {
    batchId,
    total,
    sent,
    failed,
    queued,
    processing,
    percent,
    isComplete: completed >= total,
    estimatedTimeRemainingSeconds,
  };
}

/** Retry all or specific failed jobs */
export function retryFailedJobs(jobIds?: string[]): { retriedCount: number } {
  initStore();

  let retriedCount = 0;
  const targetIds = jobIds ? new Set(jobIds) : null;

  for (const job of messageStore.values()) {
    if (job.status === 'FAILED' && (!targetIds || targetIds.has(job.id))) {
      job.status = 'QUEUED';
      job.retryCount = 0;
      job.error = null;
      job.scheduledFor = new Date().toISOString();
      retriedCount++;
    }
  }

  if (retriedCount > 0) {
    schedulePersist();
    triggerWorker();
  }

  return { retriedCount };
}
