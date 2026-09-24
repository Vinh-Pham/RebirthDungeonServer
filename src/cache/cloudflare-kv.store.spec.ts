import { createKvCache } from './cloudflare-kv.store.js';

describe('Cloudflare KV cache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('serializes values and expires short TTLs before KV physical deletion', async () => {
    vi.useFakeTimers();
    const values = new Map<string, string>();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
      const body = JSON.parse(options?.body as string) as {
        operation: string;
        key: string;
        value: string;
        ttl: number;
      };
      if (body.operation === 'set') {
        expect(body.key).toBe('nest-cache:player:1');
        expect(body.ttl).toBe(1000);
        values.set(body.key, body.value);
        return Response.json({});
      }
      if (body.operation === 'delete') {
        return Response.json({ deleted: values.delete(body.key) });
      }
      return Response.json({ value: values.get(body.key) ?? null });
    });
    const cache = createKvCache('http://localhost/cache', 'test');
    await cache.set('player:1', { level: 3 }, 1000);
    expect(await cache.get('player:1')).toEqual({ level: 3 });
    vi.advanceTimersByTime(1001);
    expect(await cache.get('player:1')).toBeUndefined();
  });

  it('clears every page in the cache namespace', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ cursor: 'next-page' }))
      .mockResolvedValueOnce(Response.json({ cursor: null }));
    await createKvCache('http://localhost/cache', 'test').clear();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toEqual({
      operation: 'clear',
      cursor: 'next-page',
    });
  });

  it('surfaces Worker failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    );
    await expect(
      createKvCache('http://localhost/cache', 'test').get('key'),
    ).rejects.toThrow('401');
  });
});
