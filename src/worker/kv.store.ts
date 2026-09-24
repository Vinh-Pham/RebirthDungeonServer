import KeyvCloudflareKV, {
  type CloudflareKVNamespace,
} from '@keyv/cloudflare-kv';
import Keyv from 'keyv';
import CacheManagerKeyv from 'keyv-cache-manager';

export const CACHE_NAMESPACE = 'nest-cache:v6';

export function createWorkerCache(kv: CloudflareKVNamespace): CacheManagerKeyv {
  const storage = new Keyv({
    store: new KeyvCloudflareKV({ mode: 'bind', kvNamespace: kv }),
    namespace: CACHE_NAMESPACE,
    throwOnErrors: true,
  });

  // Keyv 5 subscribes to storage errors; keep those errors rejecting operations.
  storage.on('error', (error: Error) => {
    throw error;
  });

  // cache-manager 7 needs Keyv 5's get(key, { raw: true }) contract.
  // Let Keyv 6 own serialization and the official adapter own KV I/O/expiry.
  return new CacheManagerKeyv({
    store: storage,
    namespace: CACHE_NAMESPACE,
    useKeyPrefix: false,
    serialize: undefined,
    deserialize: undefined,
    throwOnErrors: true,
  });
}
