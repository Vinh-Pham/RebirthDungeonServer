import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env.js';
import { requireAuth } from '../auth/middleware.js';
import { errorSchema } from '../auth/schemas.js';
import { cacheKeys, createCacheStore } from './cache.js';
import {
  cacheEntryParams,
  cacheEntryResponseSchema,
  cachePutSchema,
  storedResponseSchema,
} from './schemas.js';

const headers = {
  'Cache-Control': {
    description: 'Do not cache this response.',
    schema: { type: 'string' as const, const: 'no-store', example: 'no-store' },
  },
  'X-Request-Id': {
    description: 'Server-generated request identifier for diagnostics.',
    schema: {
      type: 'string' as const,
      format: 'uuid',
      example: 'ae150598-e67c-46e7-ab97-6683d5199404',
    },
  },
};
function errorResponse(statusCode: number, error: string, message: string) {
  return {
    description: message,
    headers,
    content: {
      'application/json': {
        schema: errorSchema,
        example: { statusCode, error, message },
      },
    },
  };
}
const rateLimitCache = createMiddleware<AppEnv>(async (c, next) => {
  let allowed: boolean;
  try {
    ({ success: allowed } = await c.env.CACHE_RATE_LIMIT.limit({
      key: c.get('user').id,
    }));
  } catch {
    throw new HTTPException(503, { message: 'Rate limiting unavailable' });
  }
  if (!allowed) {
    c.header('Retry-After', '60');
    throw new HTTPException(429, { message: 'Too many requests' });
  }
  await next();
});
export const cacheRoutes = new OpenAPIHono<AppEnv>({
  defaultHook: (result) => {
    // Covers JSON bodies and the {name} path parameter.
    if (!result.success)
      throw new HTTPException(400, { message: 'Invalid request' });
  },
});
cacheRoutes.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});
cacheRoutes.use(
  '*',
  bodyLimit({
    maxSize: 4096,
    onError: () => {
      throw new HTTPException(413, {
        message: 'Request body exceeds 4096 bytes',
      });
    },
  }),
);
cacheRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/entries',
    operationId: 'storeCacheEntry',
    tags: ['Cache'],
    summary: 'Store a personal cache entry',
    description:
      'Requires a current bearer session. Stores a value under the given name in Cloudflare Workers KV, scoped to the authenticated user, with a time-to-live of 60–2,592,000 seconds (default 300). Writing an existing name overwrites its value and restarts the TTL. Names are lowercase slugs of 1–64 characters and values are 1–2048 characters; unknown fields are rejected and request bodies are limited to 4 KiB. Limited to 30 write requests per user per minute, approximately per Cloudflare location. KV is eventually consistent: a read from another Cloudflare location can return the previous value, or 404 for a new entry, for up to about 60 seconds. Sustained writes to a single key are limited to roughly one per second. Never store authentication, session, or other read-after-write data here; D1 remains the system of record.',
    security: [{ bearerAuth: [] }],
    middleware: [requireAuth, rateLimitCache] as const,
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: cachePutSchema,
            examples: {
              entry: {
                summary: 'Fictional entry; replace before sending.',
                value: {
                  name: 'daily-greeting',
                  value: 'Hello from the game client',
                  ttlSeconds: 300,
                },
              },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Entry stored. It expires after the applied TTL.',
        headers,
        content: {
          'application/json': {
            schema: storedResponseSchema,
            example: {
              name: 'daily-greeting',
              ttlSeconds: 300,
              status: 'stored',
            },
          },
        },
      },
      400: errorResponse(400, 'Bad Request', 'Invalid request'),
      401: {
        ...errorResponse(401, 'Unauthorized', 'Session expired or revoked'),
        description:
          'Missing, invalid, expired, or revoked bearer authentication.',
      },
      413: errorResponse(
        413,
        'Payload Too Large',
        'Request body exceeds 4096 bytes',
      ),
      429: {
        ...errorResponse(429, 'Too Many Requests', 'Too many requests'),
        headers: {
          ...headers,
          'Retry-After': {
            description: 'Seconds to wait before retrying.',
            schema: { type: 'string' as const, example: '60' },
          },
        },
      },
      500: errorResponse(500, 'Internal Server Error', 'Internal server error'),
      503: {
        ...errorResponse(503, 'Service Unavailable', 'Cache unavailable'),
        description:
          'The cache write, rate limiting, or authentication storage failed. Reads may still return the previous entry.',
      },
    },
  }),
  async (c) => {
    const input = c.req.valid('json');
    const written = await createCacheStore(c.env.CACHE).write(
      cacheKeys.entry(c.get('user').id, input.name),
      input.value,
      input.ttlSeconds,
    );
    if (!written)
      throw new HTTPException(503, { message: 'Cache unavailable' });
    return c.json(
      {
        name: input.name,
        ttlSeconds: input.ttlSeconds,
        status: 'stored' as const,
      },
      200,
    );
  },
);
cacheRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/entries/{name}',
    operationId: 'getCacheEntry',
    tags: ['Cache'],
    summary: 'Read a personal cache entry',
    description:
      "Requires a current bearer session. Returns the authenticated user's entry with the given name, or 404 when it was never stored, has expired, or no longer matches the expected shape. Cache reads fail open: if KV is unavailable the endpoint reports 404 rather than an error, because the cache is an optimization and never a source of truth. KV is eventually consistent: a value just written, especially from another Cloudflare location, can remain unreadable for up to about 60 seconds.",
    security: [{ bearerAuth: [] }],
    middleware: [requireAuth] as const,
    request: { params: cacheEntryParams },
    responses: {
      200: {
        description: 'The stored entry.',
        headers,
        content: {
          'application/json': {
            schema: cacheEntryResponseSchema,
            example: {
              name: 'daily-greeting',
              value: 'Hello from the game client',
            },
          },
        },
      },
      400: {
        ...errorResponse(400, 'Bad Request', 'Invalid request'),
        description: 'The entry name does not match the required format.',
      },
      401: {
        ...errorResponse(401, 'Unauthorized', 'Session expired or revoked'),
        description:
          'Missing, invalid, expired, or revoked bearer authentication.',
      },
      404: {
        ...errorResponse(404, 'Not Found', 'Entry not found'),
        description: 'No readable entry exists for this user and name.',
      },
      500: errorResponse(500, 'Internal Server Error', 'Internal server error'),
    },
  }),
  async (c) => {
    const { name } = c.req.valid('param');
    const value = await createCacheStore(c.env.CACHE).read<string>(
      cacheKeys.entry(c.get('user').id, name),
    );
    if (value === null)
      throw new HTTPException(404, { message: 'Entry not found' });
    return c.json({ name, value }, 200);
  },
);
cacheRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/entries/{name}',
    operationId: 'deleteCacheEntry',
    tags: ['Cache'],
    summary: 'Delete a personal cache entry',
    description:
      "Requires a current bearer session. Deletes the authenticated user's entry with the given name and returns 204; deleting an absent or expired entry is also successful. Limited to 30 write requests per user per minute, approximately per Cloudflare location. KV deletes are eventually consistent: a read from another Cloudflare location can still return the deleted value for up to about 60 seconds.",
    security: [{ bearerAuth: [] }],
    middleware: [requireAuth, rateLimitCache] as const,
    request: { params: cacheEntryParams },
    responses: {
      204: {
        description: 'Entry deleted, or nothing to delete. No response body.',
        headers,
      },
      400: {
        ...errorResponse(400, 'Bad Request', 'Invalid request'),
        description: 'The entry name does not match the required format.',
      },
      401: {
        ...errorResponse(401, 'Unauthorized', 'Session expired or revoked'),
        description:
          'Missing, invalid, expired, or revoked bearer authentication.',
      },
      429: {
        ...errorResponse(429, 'Too Many Requests', 'Too many requests'),
        headers: {
          ...headers,
          'Retry-After': {
            description: 'Seconds to wait before retrying.',
            schema: { type: 'string' as const, example: '60' },
          },
        },
      },
      500: errorResponse(500, 'Internal Server Error', 'Internal server error'),
      503: {
        ...errorResponse(503, 'Service Unavailable', 'Cache unavailable'),
        description:
          'The cache delete, rate limiting, or authentication storage failed. The entry may still exist.',
      },
    },
  }),
  async (c) => {
    const { name } = c.req.valid('param');
    const deleted = await createCacheStore(c.env.CACHE).remove(
      cacheKeys.entry(c.get('user').id, name),
    );
    if (!deleted)
      throw new HTTPException(503, { message: 'Cache unavailable' });
    return c.body(null, 204);
  },
);
