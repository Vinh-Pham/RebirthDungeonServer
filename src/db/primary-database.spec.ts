import { createPrimaryDatabaseFactory } from './primary-database.js';
import { sql } from 'drizzle-orm';
import { AuthRepository } from '../auth/auth.repository.js';

describe('Primary database sessions', () => {
  it('creates independent primary sessions for overlapping operations', async () => {
    const sessions: D1DatabaseSession[] = [];
    const withSession = vi.fn<D1Database['withSession']>(() => {
      const index = sessions.length;
      const session = {
        prepare: vi.fn<D1DatabaseSession['prepare']>(() => {
          throw new Error(`session-${index}`);
        }),
        async batch<T>(): Promise<D1Result<T>[]> {
          return [];
        },
        getBookmark: () => null,
      };
      sessions.push(session);
      return session;
    });
    const factory = createPrimaryDatabaseFactory({ withSession });
    const first = factory();
    const second = factory();
    expect(first).not.toBe(second);
    await expect(async () => second.run(sql`select 1`)).rejects.toMatchObject({
      cause: { message: 'session-1' },
    });
    await expect(async () => first.run(sql`select 1`)).rejects.toMatchObject({
      cause: { message: 'session-0' },
    });
    expect(withSession.mock.calls).toEqual([
      ['first-primary'],
      ['first-primary'],
    ]);
  });
  it('sanitizes factory errors as storage failures', async () => {
    const repository = new AuthRepository(() => {
      throw new Error('private binding details');
    });
    await expect(repository.findUser('player@example.com')).rejects.toThrow(
      'Authentication storage unavailable',
    );
  });
});
