import { eq } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createD1Database } from './d1-proxy.js';

const players = sqliteTable('players', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});

const config = {
  url: 'https://example.workers.dev/query',
  token: 'secret-token',
};

describe('Cloudflare D1 proxy driver', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends a parameterized query and maps raw D1 rows', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        results: [{ rows: [[7, 'Ada']] }],
      }),
    );

    const db = createD1Database(config);
    expect(await db.select().from(players).where(eq(players.id, 7))).toEqual([
      { id: 7, name: 'Ada' },
    ]);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.workers.dev/query');
    expect(options?.headers).toEqual({
      Authorization: 'Bearer secret-token',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(options?.body as string)).toMatchObject({ params: [7] });
  });

  it('returns a proxy error instead of treating a failed query as empty rows', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ error: 'Unauthorized' }, { status: 401 }),
    );

    const db = createD1Database(config);
    await expect(db.select().from(players)).rejects.toMatchObject({
      cause: { message: 'Cloudflare D1 proxy query failed' },
    });
  });

  it('sends batched queries in one D1 request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        results: [{ rows: [[1, 'One']] }, { rows: [[2, 'Two']] }],
      }),
    );

    const db = createD1Database(config);
    const result = await db.batch([
      db.select().from(players).where(eq(players.id, 1)),
      db.select().from(players).where(eq(players.id, 2)),
    ]);
    expect(result).toEqual([
      [{ id: 1, name: 'One' }],
      [{ id: 2, name: 'Two' }],
    ]);
    expect(
      JSON.parse(fetchMock.mock.calls[0][1]?.body as string).batch,
    ).toHaveLength(2);
  });

  it('rejects interactive transactions before sending a request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const db = createD1Database(config);
    await expect(db.transaction(async () => undefined)).rejects.toMatchObject({
      cause: {
        message: 'D1 does not support interactive transactions; use db.batch()',
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
