import { CacheModule, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test } from '@nestjs/testing';
import type { Cache } from 'cache-manager';
import type {
  CloudflareKVMetadata,
  CloudflareKVPutOptions,
  CloudflareKVListOptions,
} from '@keyv/cloudflare-kv';
import { describe, it, expect, vi } from 'vitest';
import { CACHE_NAMESPACE, createWorkerCache } from './kv.store.js';

function fixture() {
  const values = new Map<string, string>();
  const metadata = new Map<string, CloudflareKVMetadata>();
  const kv = {
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    getWithMetadata: vi.fn(async (key: string) => ({
      value: values.get(key) ?? null,
      metadata: metadata.get(key) ?? null,
    })),
    put: vi.fn(
      async (key: string, value: string, options?: CloudflareKVPutOptions) => {
        values.set(key, value);
        metadata.delete(key);
        if (options?.metadata) metadata.set(key, options.metadata);
      },
    ),
    delete: vi.fn(async (key: string) => {
      values.delete(key);
      metadata.delete(key);
    }),
    list: vi.fn(async (options?: CloudflareKVListOptions) => {
      const keys = [...values.keys()]
        .sort()
        .filter(
          (name) =>
            name.startsWith(options?.prefix ?? '') &&
            name > (options?.cursor ?? ''),
        );
      return {
        keys: keys.slice(0, 1).map((name) => ({ name })),
        list_complete: keys.length <= 1,
        cursor: keys[0],
      };
    }),
  };
  return { values, kv };
}

describe('Worker KV cache', () => {
  it('round-trips values through the official binding adapter with one namespace prefix', async () => {
    const { kv } = fixture();
    const cache = createWorkerCache(kv);
    await cache.set('sample', { count: 2 }, 1000);
    expect(kv.put).toHaveBeenCalledWith(
      `${CACHE_NAMESPACE}:sample`,
      expect.any(String),
      { metadata: { e: expect.any(Number) } },
    );
    expect(await cache.get('sample')).toEqual({ count: 2 });
    expect(await cache.delete('sample')).toBe(true);
    expect(await cache.get('sample')).toBeUndefined();
    expect(await cache.delete('sample')).toBe(false);
  });

  it('enforces short TTLs, retains zero TTLs, and delegates long TTLs to KV', async () => {
    const { kv } = fixture();
    const cache = createWorkerCache(kv);
    const now = vi.spyOn(Date, 'now');
    try {
      now.mockReturnValue(1000);
      await cache.set('short', 'value', 500);
      await cache.set('forever', 'value', 0);
      await cache.set('long', 'value', 120_000);
      expect(kv.put).toHaveBeenCalledWith(
        `${CACHE_NAMESPACE}:long`,
        expect.any(String),
        {
          expirationTtl: 120,
          metadata: { e: 121_000 },
        },
      );
      expect(kv.put).toHaveBeenCalledWith(
        `${CACHE_NAMESPACE}:forever`,
        expect.any(String),
        {},
      );
      now.mockReturnValue(1600);
      expect(await cache.get('short')).toBeUndefined();
      expect(await cache.get('forever')).toBe('value');
    } finally {
      now.mockRestore();
    }
  });

  it('clears every page of its namespace and preserves unrelated and legacy entries', async () => {
    const { kv, values } = fixture();
    const cache = createWorkerCache(kv);
    values.set('other:key', 'keep');
    values.set('nest-cache:legacy', 'keep');
    await cache.set('a', 'remove');
    await cache.set('b', 'remove');
    await cache.clear();
    expect([...values]).toEqual([
      ['other:key', 'keep'],
      ['nest-cache:legacy', 'keep'],
    ]);
    expect(kv.list).toHaveBeenCalledTimes(2);
  });

  it('propagates binding read and write failures', async () => {
    const { kv } = fixture();
    const cache = createWorkerCache(kv);
    kv.put.mockRejectedValueOnce(new Error('KV write failed'));
    await expect(cache.set('sample', 'value')).rejects.toThrow(
      'KV write failed',
    );
    kv.getWithMetadata.mockRejectedValueOnce(new Error('KV read failed'));
    await expect(cache.get('sample')).rejects.toThrow('KV read failed');
  });

  it('supports the injected Nest cache manager including raw expiry and wrap hits', async () => {
    const { kv } = fixture();
    const module = await Test.createTestingModule({
      imports: [
        CacheModule.register({ ttl: 60_000, stores: [createWorkerCache(kv)] }),
      ],
    }).compile();
    const cache = module.get<Cache>(CACHE_MANAGER);
    try {
      await cache.set('sample', { count: 3 });
      expect(await cache.get('sample')).toEqual({ count: 3 });
      expect(await cache.ttl('sample')).toBeGreaterThan(Date.now());
      const loader = vi.fn(async () => ({ count: 9 }));
      expect(await cache.wrap('sample', loader)).toEqual({ count: 3 });
      expect(loader).not.toHaveBeenCalled();
      expect(await cache.wrap('loaded', loader)).toEqual({ count: 9 });
      expect(await cache.wrap('loaded', loader)).toEqual({ count: 9 });
      expect(loader).toHaveBeenCalledTimes(1);
      await cache.mset<boolean | number>([
        { key: 'a', value: false },
        { key: 'b', value: 0, ttl: 0 },
      ]);
      expect(await cache.mget(['a', 'b', 'missing'])).toEqual([
        false,
        0,
        undefined,
      ]);
      await cache.mdel(['a', 'b']);
      expect(await cache.mget(['a', 'b'])).toEqual([undefined, undefined]);
      await cache.del('sample');
      expect(await cache.get('sample')).toBeUndefined();
      await cache.clear();
      expect(await cache.get('loaded')).toBeUndefined();
    } finally {
      await module.close();
    }
  });
});
