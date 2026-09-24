import { drizzle } from 'drizzle-orm/d1';
import { handleCache } from './kv-cache.js';

type Parameter = string | number | boolean | null;
type Statement = { sql: string; params: Parameter[] };

function isStatement(value: unknown): value is Statement {
  if (typeof value !== 'object' || value === null) return false;
  const statement = value as Record<string, unknown>;
  return (
    typeof statement.sql === 'string' &&
    statement.sql.length > 0 &&
    Array.isArray(statement.params) &&
    statement.params.every(
      (param) =>
        param === null ||
        typeof param === 'string' ||
        typeof param === 'number' ||
        typeof param === 'boolean',
    )
  );
}

async function verifyToken(
  provided: string,
  expected: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path !== '/query' && path !== '/cache')
      return new Response('Not found', { status: 404 });
    if (request.method !== 'POST')
      return new Response('Method not allowed', { status: 405 });
    if (!env.D1_PROXY_TOKEN)
      return new Response('Proxy token is not configured', { status: 503 });
    if (
      !(await verifyToken(
        request.headers.get('Authorization') ?? '',
        `Bearer ${env.D1_PROXY_TOKEN}`,
      ))
    ) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (path === '/cache') {
      try {
        return await handleCache(request, env.CACHE);
      } catch (error) {
        console.error(
          JSON.stringify({ event: 'kv_cache_failed', message: String(error) }),
        );
        return Response.json(
          { error: 'KV cache operation failed' },
          { status: 502 },
        );
      }
    }

    const body: unknown = await request.json().catch(() => null);
    const batch =
      typeof body === 'object' && body !== null && 'batch' in body
        ? body.batch
        : undefined;
    const statements = batch === undefined ? [body] : batch;
    if (
      !Array.isArray(statements) ||
      statements.length === 0 ||
      statements.length > 100 ||
      !statements.every(isStatement)
    ) {
      return Response.json(
        {
          error: 'Expected a SQL statement or a batch of up to 100 statements',
        },
        { status: 400 },
      );
    }

    try {
      // The D1 adapter owns the native Worker binding. The transport uses its
      // client for prepared SQL received from the Nest Drizzle proxy.
      const db = drizzle(env.DB.withSession('first-primary'));
      if (batch === undefined) {
        const statement = statements[0];
        const rows = await db.$client
          .prepare(statement.sql)
          .bind(...statement.params)
          .raw();
        return Response.json({ results: [{ rows }] });
      }

      const prepared = statements.map((statement) =>
        db.$client.prepare(statement.sql).bind(...statement.params),
      );
      const results = await db.$client.batch(prepared);
      return Response.json({
        results: results.map((result) => ({
          rows: (result.results ?? []).map((row) => {
            if (typeof row !== 'object' || row === null)
              throw new Error('Invalid D1 batch row');
            return Object.values(row);
          }),
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('UNIQUE constraint failed: users.email')) {
        return Response.json(
          { code: 'EMAIL_EXISTS', error: 'Email already registered' },
          { status: 409 },
        );
      }
      console.error(JSON.stringify({ event: 'd1_query_failed' }));
      return Response.json(
        { code: 'DB_ERROR', error: 'Database unavailable' },
        { status: 503 },
      );
    }
  },
} satisfies ExportedHandler<Env>;
