import { describe, it, expect, vi } from 'vitest';
import { createWorkerCache, WorkerKvStore } from './kv.store.js';

describe('Worker KV cache', () => {
  function fixture() {
    const values = new Map<string, string>();
    const kv = {
      get: vi.fn(async (key: string) => values.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        values.delete(key);
      }),
      list: vi.fn(async () => ({
        keys: [...values.keys()]
          .filter((name) => name.startsWith('nest-cache:'))
          .map((name) => ({ name })),
        list_complete: true,
      })),
    };
    return { values, kv, binding: kv as unknown as KVNamespace };
  }
  it('round-trips Keyv values, isolates the namespace, and rounds physical TTL to 60s', async () => {
    const { kv, binding } = fixture();
    const cache = createWorkerCache(binding);
    await cache.set('sample', { count: 2 }, 1000);
    expect(kv.put).toHaveBeenCalledWith(
      'nest-cache:sample',
      expect.any(String),
      { expirationTtl: 60 },
    );
    expect(await cache.get('sample')).toEqual({ count: 2 });
    expect(await cache.delete('sample')).toBe(true);
    expect(await cache.get('sample')).toBeUndefined();
    expect(await cache.delete('sample')).toBe(false);
  });
  it('enforces logical expiry and keeps zero-TTL values indefinitely', async () => {
    const { binding } = fixture();
    const cache = createWorkerCache(binding);
    const now = vi.spyOn(Date, 'now');
    try {
      now.mockReturnValue(1000);
      await cache.set('short', 'value', 500);
      await cache.set('forever', 'value', 0);
      now.mockReturnValue(1600);
      expect(await cache.get('short')).toBeUndefined();
      expect(await cache.get('forever')).toBe('value');
    } finally {
      now.mockRestore();
    }
  });
  it('clears only its namespace and rejects keys outside it', async () => {
    const { binding, values } = fixture();
    const store = new WorkerKvStore(binding);
    values.set('other:key', 'keep');
    values.set('nest-cache:key', 'remove');
    await store.clear();
    expect([...values]).toEqual([['other:key', 'keep']]);
    await expect(store.set('other:key', 'bad')).rejects.toThrow(
      'Invalid cache key',
    );
  });
});
