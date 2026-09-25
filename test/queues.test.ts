import { env, exports } from 'cloudflare:workers';
import {
  applyD1Migrations,
  reset,
  createMessageBatch,
  createExecutionContext,
  getQueueResult,
  type D1Migration,
} from 'cloudflare:test';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { sign, decode } from 'hono/jwt';
import { app } from '../src/index.js';
import { consumeJobs } from '../src/queues/consumer.js';
import { enqueueExampleJob } from '../src/queues/producer.js';
import {
  jobSchema,
  exampleRequestSchema,
  queuedResponseSchema,
  type Job,
} from '../src/queues/schemas.js';
import { errorSchema, type AuthResponse } from '../src/auth/schemas.js';

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
afterEach(() => vi.restoreAllMocks());

async function register() {
  const response = await exports.default.fetch(
    'https://example.com/auth/register',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'queue-test@example.com',
        password: 'queue test long password',
      }),
    },
  );
  expect(response.status).toBe(201);
  return response.json<AuthResponse>();
}
function request(
  token?: string,
  body: unknown = { message: 'Hello from the game client' },
  bindings = env,
) {
  return app.request(
    '/queues/example',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    },
    bindings,
  );
}
function job(): Job {
  return {
    version: 1,
    type: 'example',
    jobId: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    payload: { message: 'private payload not logged' },
  };
}

it('publishes validated JSON with server-owned identity and correlation metadata', async () => {
  const auth = await register();
  const send = vi.spyOn(env.APP_QUEUE, 'send').mockResolvedValue({
    metadata: {
      metrics: {
        backlogCount: 1,
        backlogBytes: 100,
        oldestMessageTimestamp: new Date(0),
      },
    },
  });
  const response = await request(auth.accessToken);
  expect(response.status).toBe(202);
  const result = queuedResponseSchema.parse(await response.json());
  expect(send).toHaveBeenCalledTimes(1);
  const sent = jobSchema.parse(send.mock.calls[0][0]);
  expect(sent).toMatchObject({
    jobId: result.jobId,
    userId: auth.user.id,
    requestId: response.headers.get('X-Request-Id'),
    payload: { message: 'Hello from the game client' },
  });
  expect(send.mock.calls[0][1]).toEqual({ contentType: 'json' });
  expect(response.headers.get('Cache-Control')).toBe('no-store');
});

it('waits for publication confirmation and returns 503 on failure', async () => {
  const send = vi
    .spyOn(env.APP_QUEUE, 'send')
    .mockRejectedValue(new Error('secret details'));
  const auth = await register();
  const response = await request(auth.accessToken);
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    statusCode: 503,
    message: 'Queue unavailable',
    error: 'Service Unavailable',
  });
  expect(send).toHaveBeenCalledOnce();
  let resolve!: (value: Awaited<ReturnType<typeof env.APP_QUEUE.send>>) => void;
  send.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  let completed = false;
  const pending = enqueueExampleJob(
    env.APP_QUEUE,
    { message: 'test' },
    auth.user.id,
    crypto.randomUUID(),
  ).then(() => {
    completed = true;
  });
  await Promise.resolve();
  expect(completed).toBe(false);
  resolve({
    metadata: {
      metrics: {
        backlogCount: 1,
        backlogBytes: 100,
        oldestMessageTimestamp: new Date(0),
      },
    },
  });
  await pending;
  expect(completed).toBe(true);
});

it('rejects missing, expired, and revoked credentials without publishing', async () => {
  const send = vi.spyOn(env.APP_QUEUE, 'send');
  expect((await request()).status).toBe(401);
  const auth = await register();
  const expired = await sign(
    { ...decode(auth.accessToken).payload, exp: 1 },
    env.JWT_ACCESS_SECRET,
    'HS256',
  );
  expect((await request(expired)).status).toBe(401);
  await exports.default.fetch('https://example.com/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  expect((await request(auth.accessToken)).status).toBe(401);
  expect(send).not.toHaveBeenCalled();
});

it('rejects invalid, oversized, and malformed request bodies', async () => {
  const auth = await register();
  const send = vi.spyOn(env.APP_QUEUE, 'send');
  for (const body of [
    {},
    { message: '' },
    { message: 'a'.repeat(257) },
    { message: 'test', userId: auth.user.id },
  ])
    expect((await request(auth.accessToken, body)).status).toBe(400);
  expect(
    (await request(auth.accessToken, { message: 'a'.repeat(5000) })).status,
  ).toBe(413);
  const response = await app.request(
    '/queues/example',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: '{',
    },
    env,
  );
  expect(response.status).toBe(400);
  expect(send).not.toHaveBeenCalled();
});

it('limits by authenticated user and fails closed when the limiter fails', async () => {
  const auth = await register();
  const limit = vi
    .spyOn(env.QUEUE_RATE_LIMIT, 'limit')
    .mockResolvedValue({ success: false });
  const send = vi.spyOn(env.APP_QUEUE, 'send');
  const response = await request(auth.accessToken);
  expect(response.status).toBe(429);
  expect(response.headers.get('Retry-After')).toBe('60');
  expect(limit).toHaveBeenCalledWith({ key: auth.user.id });
  limit.mockRejectedValue(new Error('unavailable'));
  expect((await request(auth.accessToken)).status).toBe(503);
  expect(send).not.toHaveBeenCalled();
});

it('acknowledges successes and independently retries failed or invalid messages', async () => {
  const good = job();
  const failed = job();
  const batch = createMessageBatch(
    'rebirth-dungeon-jobs',
    [good, failed, { version: 99 }].map((body, i) => ({
      id: `message-${i}`,
      timestamp: Date.now(),
      attempts: 1,
      body,
    })),
  );
  const process = vi.fn(async (item: Job) => {
    if (item.jobId === failed.jobId) throw new Error('secret failure');
  });
  const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  await consumeJobs(batch, process);
  const result = await getQueueResult(batch, createExecutionContext());
  expect(result.explicitAcks).toEqual(['message-0']);
  expect(result.retryMessages.map((item) => item.msgId)).toEqual([
    'message-1',
    'message-2',
  ]);
  expect(process).toHaveBeenCalledTimes(2);
  expect(logs.mock.calls.flat().join('')).toContain(good.jobId);
  expect(logs.mock.calls.flat().join('')).not.toContain(good.payload.message);
  expect(errors.mock.calls.flat().join('')).not.toContain('secret failure');
});

it('safely handles duplicate delivery through the real worker queue handler', async () => {
  const item = job();
  const batch = createMessageBatch(
    'rebirth-dungeon-jobs',
    [1, 2].map((attempts) => ({
      id: `duplicate-${attempts}`,
      timestamp: Date.now(),
      attempts,
      body: item,
    })),
  );
  // The default handler delegates to the same consumer; direct invocation exposes acknowledgement state.
  const worker = (await import('../src/index.js')).default;
  await worker.queue(batch);
  expect(
    (await getQueueResult(batch, createExecutionContext())).explicitAcks,
  ).toEqual(['duplicate-1', 'duplicate-2']);
});

it('documents the queue contract and preserves unique operation IDs', async () => {
  const spec = await (
    await exports.default.fetch('https://example.com/openapi.json')
  ).json<{
    paths: Record<
      string,
      Record<
        string,
        {
          operationId: string;
          security: unknown;
          requestBody: {
            content: Record<
              string,
              { examples: Record<string, { value: unknown }> }
            >;
          };
          responses: Record<
            string,
            {
              headers: Record<string, unknown>;
              content: Record<string, { example: unknown }>;
            }
          >;
        }
      >
    >;
  }>();
  const route = spec.paths['/queues/example'].post;
  expect(route.operationId).toBe('enqueueExampleJob');
  expect(route.security).toEqual([{ bearerAuth: [] }]);
  expect(Object.keys(route.responses).sort()).toEqual([
    '202',
    '400',
    '401',
    '413',
    '429',
    '500',
    '503',
  ]);
  expect(
    exampleRequestSchema.safeParse(
      route.requestBody.content['application/json'].examples.example.value,
    ).success,
  ).toBe(true);
  expect(
    queuedResponseSchema.safeParse(
      route.responses['202'].content['application/json'].example,
    ).success,
  ).toBe(true);
  for (const [status, response] of Object.entries(route.responses)) {
    if (Number(status) >= 400)
      expect(
        errorSchema.parse(response.content['application/json'].example)
          .statusCode,
      ).toBe(Number(status));
    expect(response.headers).toHaveProperty('Cache-Control');
    expect(response.headers).toHaveProperty('X-Request-Id');
    expect(Object.hasOwn(response.headers, 'Retry-After')).toBe(
      status === '429',
    );
  }
  const ids = Object.values(spec.paths).flatMap((methods) =>
    Object.values(methods).map((operation) => operation.operationId),
  );
  expect(new Set(ids).size).toBe(ids.length);
});
