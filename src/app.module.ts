import { nodePasswordHasher } from './auth/node-password-hasher.js';
import { EmailModule } from './email/email.module.js';
import 'dotenv/config';
import { AuthModule } from './auth/auth.module.js';
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { createKvCache } from './cache/cloudflare-kv.store.js';
import { DrizzleModule } from '@nestjs/drizzle';
import { createObserveModule } from '@nestjs/observe';
import { createD1Database } from './db/d1-proxy.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    AuthModule.register(nodePasswordHasher),
    EmailModule,
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => ({
        ttl: 60_000,
        stores: [
          createKvCache(
            requiredEnv('KV_PROXY_URL'),
            requiredEnv('D1_PROXY_TOKEN'),
          ),
        ],
      }),
    }),
    DrizzleModule.forRootAsync({
      useFactory: () => ({
        db: createD1Database({
          url: requiredEnv('D1_PROXY_URL'),
          token: requiredEnv('D1_PROXY_TOKEN'),
        }),
      }),
    }),
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'rebirth-dungeon-server',
      http: { capture: false, ignore: [/^\/auth(?:\/|$)/] },
      redaction: {
        enabled: true,
        keys: [
          'password',
          'passwordHash',
          'refreshToken',
          'refreshTokenHash',
          'accessToken',
          'authorization',
        ],
      },
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is required for the Cloudflare connection`);
  return value;
}
