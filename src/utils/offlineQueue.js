const QUEUE_STORAGE_KEY = 'erp_offline_queue_v1';

function readQueue() {
  try {
    const raw = globalThis.localStorage?.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
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
  };
}

function touchQueueItem(item, patch = {}) {
  return {
    ...item,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

export function getOfflineQueue() {
  return readQueue();
}

export function getOfflineQueueStats() {
  const queue = readQueue();
  return {
    total: queue.length,
    pending: queue.filter((item) => item.status === 'pending').length,
    failed: queue.filter((item) => item.status === 'failed').length,
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

export function retryFailedOfflineOperations() {
  const queue = readQueue();
  const nextQueue = queue.map((item) => {
    if (item.status !== 'failed') return item;
    return touchQueueItem(item, { status: 'pending', lastError: '' });
  });
  writeQueue(nextQueue);
}

export async function flushOfflineQueue({ handlers = {} } = {}) {
  const queue = readQueue();
  if (queue.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, remaining: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  const nextQueue = [];

  for (const item of queue) {
    if (item.status === 'failed') {
      nextQueue.push(item);
      continue;
    }

    const handler = handlers[item.type];
    if (typeof handler !== 'function') {
      failed += 1;
      nextQueue.push(
        touchQueueItem(item, {
          status: 'failed',
          attempts: Number(item.attempts || 0) + 1,
          lastError: `No handler registered for operation type ${item.type}.`,
        }),
      );
      continue;
    }

    try {
      await handler(item.payload, item);
      succeeded += 1;
    } catch (error) {
      failed += 1;
      nextQueue.push(
        touchQueueItem(item, {
          status: 'failed',
          attempts: Number(item.attempts || 0) + 1,
          lastError: String(error?.message || error || 'Offline sync failed.'),
        }),
      );
    }
  }

  writeQueue(nextQueue);

  return {
    processed: queue.length,
    succeeded,
    failed,
    remaining: nextQueue.length,
  };
}
