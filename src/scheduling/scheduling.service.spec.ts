import { Test } from '@nestjs/testing';
import { SchedulingModule } from './scheduling.module.js';
import { EXAMPLE_CRON, SchedulingService } from './scheduling.service.js';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

it('resolves the scheduler through Nest and logs the exact greeting once per invocation', async () => {
  const module = await Test.createTestingModule({
    imports: [SchedulingModule],
  }).compile();
  try {
    const service = module.get(SchedulingService);
    await service.run({ cron: EXAMPLE_CRON, scheduledTime: 1_790_000_000_000 });
    expect(console.log).toHaveBeenCalledExactlyOnceWith('Hello from cron');
    await service.run({ cron: EXAMPLE_CRON, scheduledTime: 1_790_000_060_000 });
    expect(vi.mocked(console.log).mock.calls).toEqual([
      ['Hello from cron'],
      ['Hello from cron'],
    ]);
  } finally {
    await module.close();
  }
});

it.each(['', '*/5 * * * *', '*  * * * *'])(
  'rejects an unsupported expression without logging a greeting: %s',
  async (cron) => {
    await expect(
      new SchedulingService().run({ cron, scheduledTime: 0 }),
    ).rejects.toThrow('Unsupported cron expression');
    expect(console.log).not.toHaveBeenCalled();
  },
);
