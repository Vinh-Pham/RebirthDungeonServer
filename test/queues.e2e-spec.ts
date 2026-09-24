import request from 'supertest';
import { Test } from '@nestjs/testing';
import {
  ExpressAdapter,
  type NestExpressApplication,
} from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from '../src/auth/auth.module.js';
import { AuthRepository } from '../src/auth/auth.repository.js';
import { authConfig } from '../src/auth/auth.config.js';
import { QueuesModule } from '../src/queues/queues.module.js';
import { configureApp } from '../src/configure-app.js';

const config = authConfig('queue-test-secret-at-least-thirty-two-bytes');
const native = {
  example: {
    send: vi.fn<Queue['send']>(async () => ({
      metadata: { metrics: { backlogCount: 1, backlogBytes: 100 } },
    })),
    sendBatch: vi.fn<Queue['sendBatch']>(),
    metrics: vi.fn<Queue['metrics']>(),
  },
  rateLimit: {
    limit: vi.fn<RateLimit['limit']>(async () => ({ success: true })),
  },
};
const activeSession = vi.fn(async () => true);
let app: NestExpressApplication;
let token: string;

beforeAll(async () => {
  const module = await Test.createTestingModule({
    imports: [
      AuthModule.register({
        config,
        passwords: { hash: async () => '', verify: async () => false },
        database: () => {
          throw new Error('Unexpected database operation');
        },
        limits: {
          credentials: { limit: async () => ({ success: true }) },
          refresh: { limit: async () => ({ success: true }) },
        },
      }),
      QueuesModule.register(native),
    ],
  })
    .overrideProvider(AuthRepository)
    .useValue({ activeSession })
    .compile();
  app = module.createNestApplication<NestExpressApplication>(
    new ExpressAdapter(),
  );
  configureApp(app);
  await app.init();
  token = await new JwtService().signAsync(
    { sub: 'queue-user', sid: 'queue-session' },
    {
      secret: config.secret,
      issuer: config.issuer,
      audience: config.audience,
      expiresIn: 900,
      algorithm: 'HS256',
    },
  );
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await app.close();
});
function post(body: unknown) {
  return request(app.getHttpServer())
    .post('/queues/example')
    .auth(token, { type: 'bearer' })
    .send(body as object);
}

it('requires a valid active session before rate limiting or publishing', async () => {
  const missing = await request(app.getHttpServer())
    .post('/queues/example')
    .send({ value: 7 });
  expect(missing.status).toBe(401);
  expect(missing.headers['cache-control']).toBe('no-store');
  activeSession.mockResolvedValueOnce(false);
  expect((await post({ value: 7 })).status).toBe(401);
  expect(native.rateLimit.limit).not.toHaveBeenCalled();
  expect(native.example.send).not.toHaveBeenCalled();
});
it('publishes a validated job and returns its application job ID', async () => {
  const response = await post({ value: 7 });
  expect(response.status).toBe(202);
  expect(response.body).toEqual({
    status: 'accepted',
    jobId: expect.any(String),
  });
  expect(response.headers['cache-control']).toBe('no-store');
  expect(native.example.send).toHaveBeenCalledWith(
    expect.objectContaining({
      jobId: response.body.jobId,
      payload: { value: 7 },
    }),
    { contentType: 'json' },
  );
  expect(native.rateLimit.limit).toHaveBeenCalledWith({
    key: 'queues:example:queue-user',
  });
});
it.each([
  {},
  { value: '7' },
  { value: 1.5 },
  { value: -1_000_001 },
  { value: 1_000_001 },
  { value: 7, fail: true },
])('rejects invalid bodies: %j', async (body) => {
  const response = await post(body);
  expect(response.status).toBe(400);
  expect(response.body).toMatchObject({
    message: 'Validation failed',
    issues: expect.any(Array),
  });
  expect(response.headers['cache-control']).toBe('no-store');
  expect(native.example.send).not.toHaveBeenCalled();
});
it('returns sanitized publishing errors', async () => {
  native.example.send.mockRejectedValueOnce(new Error('private-publish-error'));
  const response = await post({ value: 7 });
  expect(response.status).toBe(503);
  expect(response.body.message).toBe('Queue unavailable');
  expect(response.headers['cache-control']).toBe('no-store');
  expect(native.example.send).toHaveBeenCalledOnce();
  expect(JSON.stringify(response.body)).not.toContain('private-publish-error');
});
it('rejects rate-limited requests with retry headers and no publishing', async () => {
  native.rateLimit.limit.mockResolvedValueOnce({ success: false });
  const response = await post({ value: 7 });
  expect(response.status).toBe(429);
  expect(response.headers['retry-after']).toBe('60');
  expect(response.headers['cache-control']).toBe('no-store');
  expect(native.example.send).not.toHaveBeenCalled();
});
it('fails closed when the limiter is unavailable', async () => {
  native.rateLimit.limit.mockRejectedValueOnce(
    new Error('private-limiter-error'),
  );
  const response = await post({ value: 7 });
  expect(response.status).toBe(503);
  expect(response.body.message).toBe('Rate limiting unavailable');
  expect(native.example.send).not.toHaveBeenCalled();
});
it('documents authenticated queue acceptance, constraints, and failures', async () => {
  const response = await request(app.getHttpServer()).get('/openapi.json');
  const document = response.body;
  const operation = document.paths['/queues/example'].post;
  expect(document.security).toEqual([{ 'access-token': [] }]);
  expect(operation.security).toBeUndefined();
  expect(operation.operationId).toBe('enqueueExample');
  expect(
    operation.requestBody.content['application/json'].schema,
  ).toMatchObject({
    additionalProperties: false,
    required: ['value'],
    properties: {
      value: { type: 'integer', minimum: -1_000_000, maximum: 1_000_000 },
    },
  });
  for (const status of ['202', '400', '401', '429', '503'])
    expect(operation.responses[status]).toBeDefined();
  expect(
    operation.responses['202'].content['application/json'].schema.required,
  ).toEqual(['status', 'jobId']);
});
