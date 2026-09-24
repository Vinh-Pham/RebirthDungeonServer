// Local integration entrypoint only. Production Wrangler uses dist/worker/main.js.
import 'reflect-metadata';
import { Controller, Get } from '@nestjs/common';
import { AppModule } from '../dist/app.module.js';
import { workerPasswordHasher } from '../dist/worker/password-hasher.js';
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
let initializationAttempts = 0;
const startupProbe = {
  onModuleInit() {
    initializationAttempts++;
    if (initializationAttempts === 1)
      throw new Error('private-startup-fixture-error');
  },
};
const api = createWorkerHandler((env) => ({
  ...AppModule.register(env, workerPasswordHasher),
  controllers: [ProtectedController],
  providers: [{ provide: 'TEST_STARTUP_PROBE', useValue: startupProbe }],
}));
import { createWorkerCache } from '../dist/worker/kv.store.js';
import { renderEmailTemplate } from '../dist/email/render-email-template.js';
import { CloudflareEmailTransport } from '../dist/email/cloudflare-email.transport.js';
import { EmailService } from '../dist/email/email.service.js';
import { emailConfig } from '../dist/email/email.config.js';
import TestEmail from '../dist/email/templates/test-email.js';

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
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
    if (path === '/__test/kv') {
      const cache = createWorkerCache(env.CACHE);
      await cache.set('runtime-test', { count: 7 }, 1000);
      const value = await cache.get('runtime-test');
      const deleted = await cache.delete('runtime-test');
      const missing = await cache.get('runtime-test');
      return Response.json({ value, deleted, missing: missing === undefined });
    }
    return api.fetch(request, env, ctx);
  },
};
