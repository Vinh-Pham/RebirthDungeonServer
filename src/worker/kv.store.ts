import { EventEmitter } from 'node:events';
import Keyv from 'keyv';

export class WorkerKvStore extends EventEmitter {
  readonly opts = {};
  namespace = 'nest-cache';
  constructor(private readonly kv: KVNamespace) {
    super();
  }
  private checkKey(key: string) {
    if (!key.startsWith(`${this.namespace}:`))
      throw new Error('Invalid cache key');
  }
  async get(key: string): Promise<string | undefined> {
    this.checkKey(key);
    return (await this.kv.get(key)) ?? undefined;
  }
  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    this.checkKey(key);
    // Keyv's envelope enforces logical expiry below KV's 60-second minimum.
    await this.kv.put(key, value, {
      expirationTtl:
        ttl && ttl > 0 ? Math.max(60, Math.ceil(ttl / 1000)) : undefined,
    });
    return true;
  }
  async delete(key: string): Promise<boolean> {
    this.checkKey(key);
    const existed = (await this.kv.get(key)) !== null;
    await this.kv.delete(key);
    return existed;
  }
  async clear(): Promise<void> {
    let cursor: string | undefined;
    do {
      const page = await this.kv.list({ prefix: `${this.namespace}:`, cursor });
      await Promise.all(page.keys.map(({ name }) => this.kv.delete(name)));
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  }
}
export function createWorkerCache(kv: KVNamespace): Keyv {
  return new Keyv({
    store: new WorkerKvStore(kv),
    namespace: 'nest-cache',
    throwOnErrors: true,
  });
}
