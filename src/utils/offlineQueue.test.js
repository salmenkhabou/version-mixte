import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearOfflineQueue,
  enqueueOfflineOperation,
  flushOfflineQueue,
  getOfflineQueue,
  getOfflineQueueStats,
  retryFailedOfflineOperations,
} from './offlineQueue';

function setupLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

beforeEach(() => {
  setupLocalStorage();
  globalThis.dispatchEvent = () => true;
  globalThis.CustomEvent = function CustomEvent() {};
  vi.stubGlobal('crypto', {
    randomUUID: () => 'test-uuid',
  });
  clearOfflineQueue();
  vi.useRealTimers();
});

describe('offlineQueue', () => {
  it('queues items and reports stats', () => {
    enqueueOfflineOperation({ type: 'orders.create', payload: { id: 1 } });

    const stats = getOfflineQueueStats();
    expect(stats.total).toBe(1);
    expect(stats.pending).toBe(1);
    expect(stats.failed).toBe(0);
    expect(stats.ready).toBe(1);
  });

  it('flushes queue with successful handler', async () => {
    enqueueOfflineOperation({ type: 'orders.create', payload: { id: 1 } });

    const result = await flushOfflineQueue({
      handlers: {
        'orders.create': async () => {},
      },
    });

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(getOfflineQueue()).toHaveLength(0);
  });

  it('marks failures with retry metadata', async () => {
    enqueueOfflineOperation({ type: 'orders.create', payload: { id: 1 } });

    const result = await flushOfflineQueue({
      handlers: {
        'orders.create': async () => {
          throw new Error('boom');
        },
      },
    });

    expect(result.failed).toBe(1);

    const [item] = getOfflineQueue();
    expect(item.status).toBe('failed');
    expect(item.attempts).toBe(1);
    expect(item.nextAttemptAt).toBeTruthy();
  });

  it('retries failed items on demand', async () => {
    enqueueOfflineOperation({ type: 'orders.create', payload: { id: 1 } });

    await flushOfflineQueue({
      handlers: {
        'orders.create': async () => {
          throw new Error('boom');
        },
      },
    });

    retryFailedOfflineOperations({ immediate: true });
    const [item] = getOfflineQueue();

    expect(item.status).toBe('pending');
    expect(item.nextAttemptAt).toBeNull();
  });
});
