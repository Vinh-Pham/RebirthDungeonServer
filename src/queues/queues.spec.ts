import { Test } from '@nestjs/testing';
import { QueueProducerService } from './queue-producer.service.js';
import { QueueConsumerService } from './queue-consumer.service.js';
import { ExampleProcessorService } from './example-processor.service.js';
import { QueuesModule } from './queues.module.js';
import { EXAMPLE_QUEUE_NAME, exampleJobSchema } from './queue.schemas.js';

function job(value = 7) {
  return {
    version: 1,
    type: 'example.square',
    jobId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    payload: { value },
  };
}
function message<T>(body: T, attempts = 1) {
  return {
    body,
    attempts,
    id: crypto.randomUUID(),
    timestamp: new Date(),
    ack: vi.fn(),
    retry: vi.fn(),
  };
}
function batch(
  messages: Message<unknown>[],
  queue = EXAMPLE_QUEUE_NAME,
): MessageBatch<unknown> {
  return {
    queue,
    messages,
    ackAll: vi.fn(),
    retryAll: vi.fn(),
    metadata: { metrics: { backlogCount: messages.length, backlogBytes: 100 } },
  };
}
function bindings() {
  return {
    example: {
      send: vi.fn<Queue['send']>(async () => ({
        metadata: { metrics: { backlogCount: 1, backlogBytes: 100 } },
      })),
      sendBatch: vi.fn<Queue['sendBatch']>(async () => ({
        metadata: { metrics: { backlogCount: 1, backlogBytes: 100 } },
      })),
      metrics: vi.fn(async () => ({ backlogCount: 0, backlogBytes: 0 })),
    },
    rateLimit: { limit: vi.fn(async () => ({ success: true })) },
  };
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

it('registers native bindings behind a Nest provider and awaits publishing', async () => {
  const native = bindings();
  let accepted!: () => void;
  native.example.send.mockImplementationOnce(async () => {
    await new Promise<void>((resolve) => {
      accepted = resolve;
    });
    return { metadata: { metrics: { backlogCount: 1, backlogBytes: 100 } } };
  });
  const module = await Test.createTestingModule({
    imports: [QueuesModule.register(native)],
  }).compile();
  await module.init();
  try {
    let resolved = false;
    const pending = module
      .get(QueueProducerService)
      .enqueueExample({ value: 7 })
      .then((result) => {
        resolved = true;
        return result;
      });
    expect(resolved).toBe(false);
    expect(console.log).not.toHaveBeenCalled();
    accepted();
    const result = await pending;
    const [envelope, options] = native.example.send.mock.calls[0];
    expect(exampleJobSchema.parse(envelope)).toMatchObject({
      jobId: result.jobId,
      payload: { value: 7 },
    });
    expect(result.status).toBe('accepted');
    expect(options).toEqual({ contentType: 'json' });
  } finally {
    await module.close();
  }
});

it('sanitizes uncertain publish failures without retrying', async () => {
  const native = bindings();
  native.example.send.mockRejectedValueOnce(new Error('private-provider-body'));
  await expect(
    new QueueProducerService(native).enqueueExample({ value: 3 }),
  ).rejects.toThrow('Queue unavailable');
  expect(native.example.send).toHaveBeenCalledTimes(1);
  expect(console.log).not.toHaveBeenCalled();
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
    'private-provider-body',
  );
});

it('acknowledges independent successes, retries failures, and tolerates duplicates', async () => {
  const processor = new ExampleProcessorService();
  const process = vi
    .spyOn(processor, 'process')
    .mockRejectedValueOnce(new Error('private-processor-body'));
  const consumer = new QueueConsumerService(processor);
  const failed = message(job(2));
  const successful = message(job(7));
  await consumer.consume(batch([failed, successful]));
  expect(failed.retry).toHaveBeenCalledOnce();
  expect(failed.ack).not.toHaveBeenCalled();
  expect(successful.ack).toHaveBeenCalledOnce();
  expect(successful.retry).not.toHaveBeenCalled();
  const duplicate = message(successful.body, 2);
  await consumer.consume(batch([duplicate]));
  expect(duplicate.ack).toHaveBeenCalledOnce();
  expect(process).toHaveBeenCalledTimes(3);
  const logs = vi
    .mocked(console.log)
    .mock.calls.map(([line]) => JSON.parse(line as string));
  expect(logs).toEqual([
    expect.objectContaining({
      code: 'QUEUE_COMPLETED',
      jobId: successful.body.jobId,
      result: 49,
      attempt: 1,
      durationMs: expect.any(Number),
    }),
    expect.objectContaining({
      jobId: successful.body.jobId,
      result: 49,
      attempt: 2,
    }),
  ]);
  expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(
    'private-processor-body',
  );
});

it.each([
  null,
  { ...job(), version: 2 },
  { ...job(), type: 'unknown' },
  { ...job(), jobId: 'not-a-uuid' },
  { ...job(), createdAt: 'yesterday' },
  { ...job(), payload: { value: 1_000_001 } },
  { ...job(), payload: { value: 1.1 } },
  { ...job(), payload: { value: 7, secret: 'private-payload' } },
])('retries invalid messages without exposing bodies: %j', async (body) => {
  const processor = { process: vi.fn() };
  const input = message(body);
  await new QueueConsumerService(processor).consume(batch([input]));
  expect(input.retry).toHaveBeenCalledOnce();
  expect(input.ack).not.toHaveBeenCalled();
  expect(processor.process).not.toHaveBeenCalled();
  expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(
    'private-payload',
  );
});

it('fails unknown queue dispatch before acknowledging any messages', async () => {
  const input = message(job());
  await expect(
    new QueueConsumerService(new ExampleProcessorService()).consume(
      batch([input], 'unknown'),
    ),
  ).rejects.toThrow('Unsupported queue');
  expect(input.ack).not.toHaveBeenCalled();
});

it.each([-1_000_000, 0, 1_000_000])(
  'processes the supported numeric range: %i',
  async (value) => {
    expect(await new ExampleProcessorService().process({ value })).toBe(
      value * value,
    );
  },
);
