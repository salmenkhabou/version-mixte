const QUEUE_STORAGE_KEY = 'erp_offline_queue_v1';
const BASE_RETRY_MS = 5000;
const MAX_RETRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RETRY_JITTER_RATIO = 0.2;

function normalizeQueueItem(rawItem) {
  if (!rawItem || typeof rawItem !== 'object') return null;

  const createdAt = rawItem.createdAt || new Date().toISOString();
  const updatedAt = rawItem.updatedAt || createdAt;

  return {
    id: String(rawItem.id || '').trim() || `queue-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: String(rawItem.type || '').trim(),
    payload: rawItem.payload ?? {},
    meta: rawItem.meta ?? {},
    status: String(rawItem.status || 'pending').trim(),
    attempts: Number(rawItem.attempts || 0),
    createdAt,
    updatedAt,
    lastError: String(rawItem.lastError || '').trim(),
    lastAttemptAt: rawItem.lastAttemptAt || null,
    nextAttemptAt: rawItem.nextAttemptAt || null,
  };
}

function readQueue() {
  try {
    const raw = globalThis.localStorage?.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeQueueItem)
      .filter(Boolean);
  } catch (error) {
    console.warn('Unable to read offline queue.', error);
    return [];
  }
}

function writeQueue(queue) {
  try {
    globalThis.localStorage?.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    globalThis.dispatchEvent(new CustomEvent('erp-offline-queue-updated'));
    return true;
  } catch (error) {
    console.warn('Unable to write offline queue.', error);
    return false;
  }
}

function buildQueueItem({ type, payload, meta }) {
  const id =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `queue-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const now = new Date().toISOString();

  return {
    id,
    type: String(type || '').trim(),
    payload: payload ?? {},
    meta: meta ?? {},
    status: 'pending',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    lastError: '',
    lastAttemptAt: null,
    nextAttemptAt: null,
  };
}

function touchQueueItem(item, patch = {}) {
  return {
    ...item,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

function computeBackoffMs(attempts) {
  const exponent = Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** Math.max(0, attempts));
  const jitter = Math.round(exponent * RETRY_JITTER_RATIO * Math.random());
  return exponent + jitter;
}

function computeNextAttemptAt(attempts, nowMs) {
  const delayMs = computeBackoffMs(attempts);
  return new Date(nowMs + delayMs).toISOString();
}

function isAttemptReady(item, nowMs) {
  if (!item.nextAttemptAt) return true;
  const nextMs = new Date(item.nextAttemptAt).getTime();
  if (!Number.isFinite(nextMs)) return true;
  return nextMs <= nowMs;
}

function isRetryable(item) {
  return Number(item.attempts || 0) < MAX_ATTEMPTS;
}

function shouldAttemptItem(item, nowMs) {
  if (item.status === 'pending' || item.status === 'processing') {
    return isAttemptReady(item, nowMs);
  }

  if (item.status === 'failed') {
    return isRetryable(item) && isAttemptReady(item, nowMs);
  }

  return false;
}

export function getOfflineQueue() {
  return readQueue();
}

export function getOfflineQueueStats() {
  const queue = readQueue();
  const nowMs = Date.now();
  const readyCount = queue.filter((item) => shouldAttemptItem(item, nowMs)).length;
  const blockedCount = Math.max(0, queue.length - readyCount);
  const retryableFailed = queue.filter((item) => item.status === 'failed' && isRetryable(item)).length;
  return {
    total: queue.length,
    pending: queue.filter((item) => item.status === 'pending').length,
    failed: queue.filter((item) => item.status === 'failed').length,
    ready: readyCount,
    blocked: blockedCount,
    retryableFailed,
    maxAttempts: MAX_ATTEMPTS,
  };
}

export function enqueueOfflineOperation({ type, payload, meta }) {
  const queue = readQueue();
  const item = buildQueueItem({ type, payload, meta });
  const nextQueue = [...queue, item];
  writeQueue(nextQueue);
  return item;
}

export function clearOfflineQueue() {
  writeQueue([]);
}

export function retryFailedOfflineOperations(options = {}) {
  const { resetAttempts = false, immediate = true } = options;
  const queue = readQueue();
  const nextQueue = queue.map((item) => {
    if (item.status !== 'failed') return item;
    const attempts = resetAttempts ? 0 : Number(item.attempts || 0);
    return touchQueueItem(item, {
      status: 'pending',
      lastError: '',
      attempts,
      nextAttemptAt: immediate ? null : item.nextAttemptAt,
    });
  });
  writeQueue(nextQueue);
}

export async function flushOfflineQueue({ handlers = {} } = {}) {
  const queue = readQueue();
  if (queue.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, remaining: 0 };
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  let succeeded = 0;
  let failed = 0;
  let attempted = 0;

  const nextQueue = [];

  for (const item of queue) {
    if (!shouldAttemptItem(item, nowMs)) {
      nextQueue.push(item);
      continue;
    }

    attempted += 1;

    const handler = handlers[item.type];
    if (typeof handler !== 'function') {
      const nextAttempts = Number(item.attempts || 0) + 1;
      failed += 1;
      nextQueue.push(
        touchQueueItem(item, {
          status: 'failed',
          attempts: nextAttempts,
          lastError: `No handler registered for operation type ${item.type}.`,
          lastAttemptAt: nowIso,
          nextAttemptAt: isRetryable({ ...item, attempts: nextAttempts })
            ? computeNextAttemptAt(nextAttempts, nowMs)
            : null,
        }),
      );
      continue;
    }

    try {
      await handler(item.payload, item);
      succeeded += 1;
    } catch (error) {
      const nextAttempts = Number(item.attempts || 0) + 1;
      failed += 1;
      nextQueue.push(
        touchQueueItem(item, {
          status: 'failed',
          attempts: nextAttempts,
          lastError: String(error?.message || error || 'Offline sync failed.'),
          lastAttemptAt: nowIso,
          nextAttemptAt: isRetryable({ ...item, attempts: nextAttempts })
            ? computeNextAttemptAt(nextAttempts, nowMs)
            : null,
        }),
      );
    }
  }

  writeQueue(nextQueue);

  return {
    processed: queue.length,
    attempted,
    succeeded,
    failed,
    remaining: nextQueue.length,
  };
}
