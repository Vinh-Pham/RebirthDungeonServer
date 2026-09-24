// Local integration entrypoint only. Production Wrangler uses dist/worker/main.js.
import api from '../dist/worker/main.js';
import { createWorkerCache } from '../dist/worker/kv.store.js';
import { renderEmailTemplate } from '../dist/email/render-email-template.js';
import TestEmail from '../dist/email/templates/test-email.js';

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === '/__test/render-email') {
      return Response.json(
        await renderEmailTemplate(TestEmail({ recipientName: '<Adventurer>' })),
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
