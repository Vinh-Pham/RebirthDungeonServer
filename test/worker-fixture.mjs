// Local integration entrypoint only. Production Wrangler uses dist/worker/main.js.
import 'reflect-metadata';
import { Controller, Get, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Public } from '../dist/auth/public.decorator.js';
import { AppModule } from '../dist/app.module.js';
import { workerPasswordHasher } from '../dist/worker/password-hasher.js';
import { QueuesModule } from '../dist/queues/queues.module.js';
import { ExampleProcessorService } from '../dist/queues/example-processor.service.js';
import { createWorkerHandler } from '../dist/worker/handler.js';

class ProtectedController {
  get() {
    return { ok: true };
  }
}
Controller('__test/protected')(ProtectedController);
Get()(
  ProtectedController.prototype,
  'get',
  Object.getOwnPropertyDescriptor(ProtectedController.prototype, 'get'),
);
class CacheController {
  constructor(cache) {
    this.cache = cache;
  }
  async get() {
    await this.cache.set('runtime-test', { count: 7 }, 1000);
    const value = await this.cache.get('runtime-test');
    const expires = await this.cache.ttl('runtime-test');
    const wrapped = await this.cache.wrap('runtime-test', async () => ({
      count: -1,
    }));
    await this.cache.del('runtime-test');
    const missing = await this.cache.get('runtime-test');
    return {
      value,
      wrapped,
      expiring: expires > Date.now(),
      missing: missing === undefined,
    };
  }
}
Controller('__test/kv')(CacheController);
Inject(CACHE_MANAGER)(CacheController, undefined, 0);
Public()(CacheController);
Get()(
  CacheController.prototype,
  'get',
  Object.getOwnPropertyDescriptor(CacheController.prototype, 'get'),
);
let initializationAttempts = 0;
const startupProbe = {
  onModuleInit() {
    initializationAttempts++;
    console.log(
      JSON.stringify({
        code: 'QUEUE_TEST_INITIALIZATION',
        attempt: initializationAttempts,
      }),
    );
    if (initializationAttempts === 1)
      throw new Error('private-startup-fixture-error');
  },
};
// Failure injection exists only in this local fixture. No production failure knobs.
let transientAttempts = 0;
const processor = {
  async process(payload) {
    if (
      payload.value === -999_999 ||
      (payload.value === -999_998 && ++transientAttempts === 1)
    ) {
      throw new Error('private-queue-processing-error');
    }
    return new ExampleProcessorService().process(payload);
  },
};
const api = createWorkerHandler((env) => {
  const root = AppModule.register(env, workerPasswordHasher);
  root.imports = root.imports.map((module) =>
    typeof module === 'object' &&
    module !== null &&
    'module' in module &&
    module.module === QueuesModule
      ? {
          ...module,
          providers: module.providers.map((provider) =>
            provider === ExampleProcessorService
              ? { provide: ExampleProcessorService, useValue: processor }
              : provider,
          ),
        }
      : module,
  );
  return {
    ...root,
    controllers: [ProtectedController, CacheController],
    providers: [{ provide: 'TEST_STARTUP_PROBE', useValue: startupProbe }],
  };
});
import { renderEmailTemplate } from '../dist/email/render-email-template.js';
import { CloudflareEmailTransport } from '../dist/email/cloudflare-email.transport.js';
import { EmailService } from '../dist/email/email.service.js';
import { emailConfig } from '../dist/email/email.config.js';
import TestEmail from '../dist/email/templates/test-email.js';

export default {
  async queue(batch, env, ctx) {
    if (batch.queue === 'rebirth-dungeon-example-dlq') {
      for (const message of batch.messages) {
        console.log(
          JSON.stringify({
            code: 'QUEUE_TEST_DEAD_LETTER',
            jobId: message.body.jobId,
          }),
        );
        message.ack();
      }
      return;
    }
    return api.queue(batch, env, ctx);
  },
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === '/__test/ready')
      return Response.json({ initializationAttempts });
    if (path === '/__test/queue') {
      await env.EXAMPLE_QUEUE.sendBatch(
        (await request.json()).map((body) => ({ body, contentType: 'json' })),
      );
      return Response.json({ status: 'accepted' });
    }
    if (path === '/__test/render-email') {
      return Response.json(
        await renderEmailTemplate(TestEmail({ recipientName: '<Adventurer>' })),
      );
    }
    if (path === '/__test/send-email') {
      const email = new EmailService(
        new CloudflareEmailTransport(
          emailConfig({ from: env.EMAIL_FROM, fromName: env.EMAIL_FROM_NAME }),
          { client: env.EMAIL },
        ),
      );
      return Response.json(
        await email.sendTemplate({
          to: 'local-fixture@example.com',
          subject: 'Local simulation only',
          template: TestEmail({ recipientName: '<Adventurer>' }),
        }),
      );
    }
    return api.fetch(request, env, ctx);
  },
};
