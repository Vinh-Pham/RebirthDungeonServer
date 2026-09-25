import { expect, it, vi } from 'vitest';
import { runScheduled } from '../src/cron/scheduled.js';

function controller(cron = '* * * * *') {
  return {
    cron,
    scheduledTime: new Date('2026-09-25T12:00:00.000Z').getTime(),
    noRetry() {},
  } as ScheduledController;
}

it('prints Hello from cron with schedule context', async () => {
  const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
  await runScheduled(controller());
  const output = logs.mock.calls.flat().join('');
  expect(output).toContain('Hello from cron');
  expect(output).toContain('* * * * *');
  expect(output).toContain('2026-09-25T12:00:00.000Z');
});

it('runs through the real worker scheduled handler', async () => {
  const logs = vi.spyOn(console, 'log').mockImplementation(() => {});
  const worker = (await import('../src/index.js')).default;
  await worker.scheduled(controller());
  expect(logs.mock.calls.flat().join('')).toContain('Hello from cron');
});
