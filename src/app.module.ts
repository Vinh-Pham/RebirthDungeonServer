import { Module, type DynamicModule } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AuthModule } from './auth/auth.module.js';
import { authConfig } from './auth/auth.config.js';
import type { PasswordHasher } from './auth/password-hasher.js';
import { EmailModule } from './email/email.module.js';
import { emailConfig } from './email/email.config.js';
import { createPrimaryDatabaseFactory } from './db/primary-database.js';
import { createWorkerCache } from './worker/kv.store.js';
import { QueuesModule } from './queues/queues.module.js';

@Module({})
export class AppModule {
  static register(env: Env, passwords: PasswordHasher): DynamicModule {
    return {
      module: AppModule,
      imports: [
        QueuesModule.register({
          example: env.EXAMPLE_QUEUE,
          rateLimit: env.QUEUE_RATE_LIMIT,
        }),
        AuthModule.register({
          passwords,
          config: authConfig(env.JWT_ACCESS_SECRET),
          database: createPrimaryDatabaseFactory(env.DB),
          limits: {
            credentials: env.AUTH_RATE_LIMIT,
            refresh: env.REFRESH_RATE_LIMIT,
          },
        }),
        EmailModule.register(
          emailConfig({ from: env.EMAIL_FROM, fromName: env.EMAIL_FROM_NAME }),
          env.EMAIL,
        ),
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
