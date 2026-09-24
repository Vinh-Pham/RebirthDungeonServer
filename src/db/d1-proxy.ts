import { drizzle } from 'drizzle-orm/sqlite-proxy';

export interface D1ProxyConfig {
  url: string;
  token: string;
}

interface D1ProxyResponse {
  results?: { rows: unknown[][] }[];
  error?: string;
  code?: string;
}

export class D1ProxyError extends Error {
  constructor(readonly code: string) {
    super('Cloudflare D1 proxy query failed');
  }
}

export function createD1Database({ url, token }: D1ProxyConfig) {
  async function query(body: object, expectedResults: number) {
    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as D1ProxyResponse;
    if (!response.ok || data.results?.length !== expectedResults) {
      throw new D1ProxyError(data.code ?? 'DB_ERROR');
    }
    return data.results;
  }

  return drizzle(
    async (sql, params, method) => {
      if (/^\s*(?:begin|commit|rollback|savepoint|release)\b/i.test(sql)) {
        throw new Error(
          'D1 does not support interactive transactions; use db.batch()',
        );
      }
      const [result] = await query({ sql, params }, 1);
      return { rows: method === 'get' ? result.rows[0] : result.rows };
    },
    async (queries) => {
      const results = await query(
        { batch: queries.map(({ sql, params }) => ({ sql, params })) },
        queries.length,
      );
      return results.map((result, index) => ({
        rows: queries[index].method === 'get' ? result.rows[0] : result.rows,
      }));
    },
  );
}

export type D1Database = ReturnType<typeof createD1Database>;
