import { EventEmitter } from 'node:events';
import Keyv from 'keyv';

interface KvResponse {
  value?: string | null;
  deleted?: boolean;
  cursor?: string | null;
  error?: string;
}

export class CloudflareKvStore extends EventEmitter {
  readonly opts = {};
  namespace = 'nest-cache';

  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {
    super();
  }

  private async request(body: object): Promise<KvResponse> {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      throw new Error(`KV cache request failed (${response.status})`);
    return response.json() as Promise<KvResponse>;
  }

  async get(key: string): Promise<string | undefined> {
    return (await this.request({ operation: 'get', key })).value ?? undefined;
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    await this.request({ operation: 'set', key, value, ttl });
    return true;
  }

  async delete(key: string): Promise<boolean> {
    return (await this.request({ operation: 'delete', key })).deleted ?? false;
  }

  async clear(): Promise<void> {
    let cursor: string | null | undefined;
    do {
      ({ cursor } = await this.request({ operation: 'clear', cursor }));
    } while (cursor);
  }
}

export function createKvCache(url: string, token: string): Keyv {
  return new Keyv({
    store: new CloudflareKvStore(url, token),
    namespace: 'nest-cache',
    throwOnErrors: true,
  });
}
