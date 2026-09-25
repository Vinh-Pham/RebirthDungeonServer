import { OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { secureHeaders } from 'hono/secure-headers';
import { authRoutes } from './auth/routes.js';
import { authenticationGuide } from './auth/documentation.js';
import { handleError } from './errors.js';
import { queueRoutes } from './queues/routes.js';
import { cacheRoutes } from './kv/routes.js';
import { consumeJobs } from './queues/consumer.js';
import { runScheduled } from './cron/scheduled.js';
import type { AppEnv } from './env.js';

export const app = new OpenAPIHono<AppEnv>();
app.use('*', secureHeaders());
app.use('*', async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-Id', requestId);
  await next();
  // Route patterns exclude query strings, credentials, and arbitrary path content.
  console.log(
    JSON.stringify({
      event: 'request_completed',
      requestId,
      method: c.req.method,
      route: c.req.routePath,
      status: c.res.status,
    }),
  );
});
app.use('/auth/*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});
app.onError(handleError);
app.notFound((c) =>
  c.json({ statusCode: 404, message: 'Not found', error: 'Not Found' }, 404),
);
app.get('/', (c) => c.text('Hello Hono!'));
app.route('/auth', authRoutes);
app.route('/queues', queueRoutes);
app.route('/cache', cacheRoutes);
app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description:
    'Paste accessToken from Register, Login, or Refresh. Use `Authorization: Bearer <accessToken>`; the Scalar token field needs only the token value.',
});
app.doc31('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'Rebirth Dungeon API',
    version: '1.0.0',
    description: authenticationGuide,
  },
  servers: [
    { url: '/', description: 'Current server (same origin as these docs)' },
  ],
  tags: [
    {
      name: 'Queues',
      description:
        'Asynchronous jobs with at-least-once delivery. The example records completion in Worker logs.',
    },
    {
      name: 'Cache',
      description:
        'Authenticated example entries in Cloudflare Workers KV with a time-to-live. KV is eventually consistent and never a source of truth.',
    },
    {
      name: 'Authentication',
      description:
        'Email/password authentication with short-lived JWT access tokens and rotating opaque refresh tokens.',
    },
  ],
});
app.get(
  '/docs',
  Scalar({
    url: '/openapi.json',
    pageTitle: 'Rebirth Dungeon API Reference',
    persistAuth: false,
  }),
);

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<unknown>): Promise<void> {
    await consumeJobs(batch);
  },
  async scheduled(controller: ScheduledController): Promise<void> {
    await runScheduled(controller);
  },
} satisfies ExportedHandler<CloudflareBindings>;
