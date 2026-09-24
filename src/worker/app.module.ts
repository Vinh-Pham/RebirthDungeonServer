import { WorkerThrottlerStorage } from './throttler.storage.js';
import { Module, type DynamicModule } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { DrizzleModule } from '@nestjs/drizzle';
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { workerPasswordHasher } from './password-hasher.js';
import { createWorkerCache } from './kv.store.js';

// Never keep a D1 session/bookmark from one request in the shared Nest container.
// Each query builder starts with its own authoritative primary session.
function createDatabase() {
  const db = drizzle(env.DB);
  return new Proxy(db, {
    get(_target, key) {
      const current = drizzle(env.DB.withSession('first-primary'));
      const value: unknown = Reflect.get(current, key);
      return typeof value === 'function' ? value.bind(current) : value;
    },
  });
}

@Module({})
export class WorkerAppModule {
  static register(): DynamicModule {
    return {
      module: WorkerAppModule,
      imports: [
        AuthModule.register(
          workerPasswordHasher,
          (request) => {
            // Cloudflare sets this header at ingress. Do not trust arbitrary X-Forwarded-For.
            const address: unknown = request.headers['cf-connecting-ip'];
            return typeof address === 'string' ? address : String(request.ip);
          },
          new WorkerThrottlerStorage(),
        ),
        EmailModule,
        DrizzleModule.forRootAsync({
          useFactory: () => ({ db: createDatabase() }),
        }),
        CacheModule.registerAsync({
          isGlobal: true,
          useFactory: () => ({
            ttl: 60_000,
            stores: [createWorkerCache(env.CACHE)],
          }),
        }),
      ],
    };
  }
}
