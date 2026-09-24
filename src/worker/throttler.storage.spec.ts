import { describe, it, expect, vi } from 'vitest';
import { WorkerThrottlerStorage } from './throttler.storage.js';

describe('Worker throttling without background timers', () => {
  it('blocks at the limit, separates callers, and expires after requests finish', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      const storage = new WorkerThrottlerStorage();
      const hit = (key = 'player') =>
        storage.increment(key, 60000, 2, 60000, 'default');
      expect((await hit()).isBlocked).toBe(false);
      expect((await hit()).isBlocked).toBe(false);
      expect((await hit()).isBlocked).toBe(true);
      expect((await hit('other')).isBlocked).toBe(false);
      now.mockReturnValue(61001);
      expect(await hit()).toMatchObject({ isBlocked: false, totalHits: 1 });
    } finally {
      now.mockRestore();
    }
  });
});
