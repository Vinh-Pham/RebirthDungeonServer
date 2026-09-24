import type { DynamicModule } from '@nestjs/common';
import { QueueConsumerService } from '../queues/queue-consumer.service.js';
import {
  SchedulingService,
  type ScheduledInvocation,
} from '../scheduling/scheduling.service.js';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  handle: vi.fn(),
  configure: vi.fn(),
}));
vi.mock('@nestjs/core', () => ({ NestFactory: { create: mocks.create } }));
vi.mock('cloudflare:node', () => ({ handleAsNodeRequest: mocks.handle }));
vi.mock('../configure-app.js', () => ({ configureApp: mocks.configure }));
import { createWorkerHandler } from './handler.js';

function fixture() {
  const consume = vi.fn(async (_batch: MessageBatch<unknown>) => {});
  const run = vi.fn(async (_invocation: ScheduledInvocation) => {});
  const app = {
    get: vi.fn((token: unknown) => {
      if (token === SchedulingService) return { run };
      if (token === QueueConsumerService) return { consume };
      throw new Error('Unexpected provider');
    }),
    listen: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  mocks.create.mockResolvedValue(app);
  mocks.handle.mockResolvedValue(new Response('ok'));
  const moduleFactory = vi.fn((): DynamicModule => ({
    module: class TestModule {},
  }));
  const handler = createWorkerHandler(moduleFactory);
  const batch = {
    queue: 'rebirth-dungeon-example',
    messages: [],
    ackAll: vi.fn(),
    retryAll: vi.fn(),
    metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
  } satisfies MessageBatch<unknown>;
  return {
    app,
    consume,
    run,
    handler,
    batch,
    moduleFactory,
    env: {} as Env,
    ctx: {} as ExecutionContext,
    controller: {
      cron: '* * * * *',
      scheduledTime: 1_790_000_000_000,
      noRetry: vi.fn(),
    } satisfies ScheduledController,
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

it('shares scheduled-first startup with concurrent HTTP and queue events and awaits the job', async () => {
  const f = fixture();
  let finishStartup!: () => void;
  let finishJob!: () => void;
  f.app.listen.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishStartup = resolve;
      }),
  );
  f.run.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishJob = resolve;
      }),
  );
  let scheduledFinished = false;
  const scheduled = f.handler.scheduled(f.controller, f.env, f.ctx).then(() => {
    scheduledFinished = true;
  });
  const http = f.handler.fetch(new Request('http://test/'), f.env, f.ctx);
  const queue = f.handler.queue(f.batch, f.env, f.ctx);
  await vi.waitFor(() => expect(f.app.listen).toHaveBeenCalledOnce());
  expect(f.run).not.toHaveBeenCalled();
  expect(f.consume).not.toHaveBeenCalled();
  finishStartup();
  await queue;
  expect((await http).status).toBe(200);
  expect(f.run).toHaveBeenCalledWith({
    cron: f.controller.cron,
    scheduledTime: f.controller.scheduledTime,
  });
  expect(scheduledFinished).toBe(false);
  finishJob();
  await scheduled;
  expect(scheduledFinished).toBe(true);
  expect(mocks.create).toHaveBeenCalledOnce();
  expect(f.moduleFactory).toHaveBeenCalledOnce();
  expect(f.controller.noRetry).not.toHaveBeenCalled();
});

it('reports scheduled startup failure safely and recovers on the next invocation', async () => {
  const f = fixture();
  f.app.listen.mockRejectedValueOnce(new Error('private-cron-startup-error'));
  await expect(f.handler.scheduled(f.controller, f.env, f.ctx)).rejects.toThrow(
    'WORKER_SCHEDULED_FAILED',
  );
  expect(f.app.close).toHaveBeenCalledOnce();
  expect(f.run).not.toHaveBeenCalled();
  expect(console.error).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ code: 'WORKER_SCHEDULED_FAILED' }),
  );
  await f.handler.scheduled(f.controller, f.env, f.ctx);
  expect(mocks.create).toHaveBeenCalledTimes(2);
  expect(f.run).toHaveBeenCalledOnce();
});

it('propagates a sanitized scheduled job failure without replacing the initialized app', async () => {
  const f = fixture();
  f.run.mockRejectedValueOnce(new Error('private-cron-job-error'));
  await expect(f.handler.scheduled(f.controller, f.env, f.ctx)).rejects.toThrow(
    'WORKER_SCHEDULED_FAILED',
  );
  expect(console.error).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({ code: 'WORKER_SCHEDULED_FAILED' }),
  );
  await f.handler.scheduled(f.controller, f.env, f.ctx);
  expect(mocks.create).toHaveBeenCalledOnce();
  expect(f.run).toHaveBeenCalledTimes(2);
});
afterEach(() => vi.restoreAllMocks());

it('shares queue-first initialization with concurrent HTTP requests', async () => {
  const f = fixture();
  let finish!: () => void;
  f.app.listen.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const queue = f.handler.queue(f.batch, f.env, f.ctx);
  const http = f.handler.fetch(new Request('http://test/'), f.env, f.ctx);
  await vi.waitFor(() => expect(f.app.listen).toHaveBeenCalledOnce());
  expect(f.consume).not.toHaveBeenCalled();
  finish();
  await queue;
  expect((await http).status).toBe(200);
  expect(mocks.create).toHaveBeenCalledOnce();
  expect(f.moduleFactory).toHaveBeenCalledOnce();
  expect(f.app.get).toHaveBeenCalledWith(QueueConsumerService);
  expect(f.consume).toHaveBeenCalledWith(f.batch);
  expect(f.batch.retryAll).not.toHaveBeenCalled();
});

it('retries queue startup failure, closes the failed app, and recovers', async () => {
  const f = fixture();
  f.app.listen.mockRejectedValueOnce(new Error('private-startup-error'));
  await f.handler.queue(f.batch, f.env, f.ctx);
  expect(f.batch.retryAll).toHaveBeenCalledOnce();
  expect(f.app.close).toHaveBeenCalledOnce();
  expect(f.consume).not.toHaveBeenCalled();
  await f.handler.queue(f.batch, f.env, f.ctx);
  expect(mocks.create).toHaveBeenCalledTimes(2);
  expect(f.consume).toHaveBeenCalledOnce();
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
    'private-startup-error',
  );
});

it('retries dispatcher failure without replacing an initialized application', async () => {
  const f = fixture();
  f.consume.mockRejectedValueOnce(new Error('private-dispatch-error'));
  await f.handler.queue(f.batch, f.env, f.ctx);
  expect(f.batch.retryAll).toHaveBeenCalledOnce();
  await f.handler.queue(f.batch, f.env, f.ctx);
  expect(mocks.create).toHaveBeenCalledOnce();
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
    'private-dispatch-error',
  );
});

it('recovers a synchronous module configuration error and sanitizes HTTP failures', async () => {
  const f = fixture();
  f.moduleFactory.mockImplementationOnce(() => {
    throw new Error('private-configuration');
  });
  const response = await f.handler.fetch(
    new Request('http://test/'),
    f.env,
    f.ctx,
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    statusCode: 503,
    message: 'API unavailable',
  });
  await f.handler.queue(f.batch, f.env, f.ctx);
  expect(f.consume).toHaveBeenCalledOnce();
});
