const PREFIX = 'nest-cache:';

export async function handleCache(
  request: Request,
  kv: KVNamespace,
): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== 'object' || body === null) {
    return Response.json(
      { error: 'Expected a cache operation' },
      { status: 400 },
    );
  }
  const { operation, key, value, ttl, cursor } = body as Record<
    string,
    unknown
  >;
  if (operation === 'clear') {
    if (cursor !== undefined && cursor !== null && typeof cursor !== 'string') {
      return Response.json({ error: 'Invalid cursor' }, { status: 400 });
    }
    const page = await kv.list({
      prefix: PREFIX,
      limit: 25,
      cursor: typeof cursor === 'string' ? cursor : undefined,
    });
    await Promise.all(page.keys.map((entry) => kv.delete(entry.name)));
    return Response.json({ cursor: page.list_complete ? null : page.cursor });
  }
  if (
    typeof key !== 'string' ||
    !key.startsWith(PREFIX) ||
    new TextEncoder().encode(key).length > 512
  ) {
    return Response.json({ error: 'Invalid cache key' }, { status: 400 });
  }
  switch (operation) {
    case 'get':
      return Response.json({ value: await kv.get(key) });
    case 'set': {
      if (
        typeof value !== 'string' ||
        (ttl !== undefined &&
          (typeof ttl !== 'number' || !Number.isFinite(ttl) || ttl < 0))
      ) {
        return Response.json(
          { error: 'Invalid value or TTL' },
          { status: 400 },
        );
      }
      // Keyv's serialized envelope retains the precise millisecond expiry.
      const expirationTtl =
        typeof ttl === 'number' && ttl > 0
          ? Math.max(60, Math.ceil(ttl / 1000))
          : undefined;
      await kv.put(key, value, { expirationTtl });
      return Response.json({});
    }
    case 'delete': {
      const existed = (await kv.get(key)) !== null;
      await kv.delete(key);
      return Response.json({ deleted: existed });
    }
    default:
      return Response.json(
        { error: 'Unknown cache operation' },
        { status: 400 },
      );
  }
}
