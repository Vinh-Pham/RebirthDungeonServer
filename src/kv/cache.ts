import type { z } from '@hono/zod-openapi';

/**
 * KV rejects expiration TTLs below 60 seconds, and cached values are not worth
 * keeping forever; requested TTLs are clamped into this range.
 */
export const MIN_TTL_SECONDS = 60;
export const MAX_TTL_SECONDS = 2_592_000; // 30 days.

/** Keys are built from prefixes so a single namespace can serve separate domains. */
export const cacheKeys = {
  // Private example entries written through /cache/entries.
  entry: (userId: string, name: string) => `cache:entry:${userId}:${name}`,
};

function logFailure(operation: string, key: string, error: unknown) {
  // Exception details can embed binding internals; log only the error category.
  console.error(
    JSON.stringify({
      event: 'cache_operation_failed',
      operation,
      key,
      reason: error instanceof Error ? error.name : 'unknown',
    }),
  );
}

export function createCacheStore(kv: KVNamespace) {
  /**
   * Reads fail open: an unavailable KV, or an entry that no longer matches the
   * expected shape, is reported as a miss so callers fall back to their source.
   */
  async function read<T>(
    key: string,
    schema?: z.ZodType<T>,
  ): Promise<T | null> {
    let value: unknown;
    try {
      value = await kv.get(key, 'json');
    } catch (error) {
      logFailure('read', key, error);
      return null;
    }
    if (value === null) return null;
    if (!schema) return value as T;
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  /** Writes report success instead of throwing so callers can fail closed. */
  async function write(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<boolean> {
    try {
      await kv.put(key, JSON.stringify(value), {
        expirationTtl: Math.min(
          Math.max(Math.round(ttlSeconds), MIN_TTL_SECONDS),
          MAX_TTL_SECONDS,
        ),
      });
      return true;
    } catch (error) {
      logFailure('write', key, error);
      return false;
    }
  }

  /** Deleting an absent key is a successful no-op; failures report false. */
  async function remove(key: string): Promise<boolean> {
    try {
      await kv.delete(key);
      return true;
    } catch (error) {
      logFailure('delete', key, error);
      return false;
    }
  }

  /**
   * Cache-aside read for expensive sources such as D1: serve a valid cached
   * value when present, otherwise run the loader and cache its result. Loader
   * errors propagate; cache errors fail open and only skip the cached copy.
   */
  async function getOrSet<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
    schema?: z.ZodType<T>,
  ): Promise<T> {
    const cached = await read(key, schema);
    if (cached !== null) return cached;
    const fresh = await loader();
    await write(key, fresh, ttlSeconds);
    return fresh;
  }

  /**
   * Lists key names under a prefix, following cursor pagination. Fails open and
   * returns the names collected before any failure.
   */
  async function listKeys(prefix: string): Promise<string[]> {
    const names: string[] = [];
    try {
      let page = await kv.list({ prefix });
      for (;;) {
        names.push(...page.keys.map((item) => item.name));
        if (page.list_complete) break;
        page = await kv.list({ prefix, cursor: page.cursor });
      }
    } catch (error) {
      logFailure('list', prefix, error);
    }
    return names;
  }

  return { read, write, remove, getOrSet, listKeys };
}

export type CacheStore = ReturnType<typeof createCacheStore>;
