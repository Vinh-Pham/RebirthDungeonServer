import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { unstable_readConfig } from 'wrangler';

// Reuse Wrangler's installed runtime and bundler; no separate versions to maintain.
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler'));
const { Miniflare, convertV4MiniflareOptions } = wranglerRequire('miniflare');
const { build } = wranglerRequire('esbuild');

test(
  'local queue retries the actual consumer and delivers exhausted messages to the DLQ',
  { timeout: 15000 },
  async (t) => {
    const config = unstable_readConfig({ config: 'wrangler.jsonc' });
    const consumer = config.queues.consumers[0];
    assert.equal(consumer.max_retries, 3);
    assert.equal(consumer.retry_delay, 30);
    const bundled = await build({
      stdin: {
        contents: `import { consumeJobs } from './src/queues/consumer.ts';
      export default { async queue(batch, env) {
        await env.REPORT.fetch('https://report/attempt', { method: 'POST', body: JSON.stringify(batch.messages.map(m => m.attempts)) });
        await consumeJobs(batch);
      } };`,
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
    });
    const attempts = [];
    let delivered;
    const received = new Promise((resolve) => {
      delivered = resolve;
    });
    const mf = new Miniflare(
      convertV4MiniflareOptions({
        workers: [
          {
            name: 'consumer',
            modules: true,
            script: bundled.outputFiles[0].text,
            compatibilityDate: config.compatibility_date,
            queueProducers: { APP_QUEUE: consumer.queue },
            queueConsumers: {
              [consumer.queue]: {
                maxBatchSize: consumer.max_batch_size,
                maxBatchTimeout: 0,
                maxRetries: consumer.max_retries,
                retryDelay: 0, // Deterministic, fast test; production delay checked above.
                deadLetterQueue: consumer.dead_letter_queue,
              },
            },
            serviceBindings: {
              REPORT: async (request) => {
                attempts.push(...(await request.json()));
                return new Response('ok');
              },
            },
          },
          {
            name: 'dlq-observer',
            modules: true,
            compatibilityDate: config.compatibility_date,
            script: `export default { async queue(batch, env) {
        await env.REPORT.fetch('https://report/dlq', { method: 'POST', body: JSON.stringify(batch.messages.map(m => m.body)) });
        batch.ackAll();
      } };`,
            queueConsumers: {
              [consumer.dead_letter_queue]: { maxBatchTimeout: 0 },
            },
            serviceBindings: {
              REPORT: async (request) => {
                delivered(await request.json());
                return new Response('ok');
              },
            },
          },
        ],
      }),
    );
    t.after(() => mf.dispose());
    const queue = await mf.getQueueProducer('APP_QUEUE', 'consumer');
    const invalid = { version: 99, type: 'unsupported' };
    await queue.send(invalid, { contentType: 'json' });
    assert.deepEqual(await received, [invalid]);
    assert.deepEqual(attempts, [1, 2, 3, 4]);
  },
);
