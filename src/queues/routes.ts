import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env.js';
import { requireAuth } from '../auth/middleware.js';
import { errorSchema } from '../auth/schemas.js';
import { enqueueExampleJob } from './producer.js';
import { exampleRequestSchema, queuedResponseSchema } from './schemas.js';

const headers = {
  'Cache-Control': {
    description: 'Do not cache this response.',
    schema: { type: 'string' as const, const: 'no-store', example: 'no-store' },
  },
  'X-Request-Id': {
    description:
      'Server-generated identifier; also included in the job for log correlation.',
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
const rateLimitQueue = createMiddleware<AppEnv>(async (c, next) => {
  let allowed: boolean;
  try {
    ({ success: allowed } = await c.env.QUEUE_RATE_LIMIT.limit({
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
export const queueRoutes = new OpenAPIHono<AppEnv>({
  defaultHook: (result) => {
    if (!result.success)
      throw new HTTPException(400, { message: 'Invalid request body' });
  },
});
queueRoutes.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});
queueRoutes.use(
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
queueRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/example',
    operationId: 'enqueueExampleJob',
    tags: ['Queues'],
    summary: 'Enqueue an example background job',
    description:
      'Requires a current bearer session. Accepts a message of 1–256 characters and rejects unknown fields. Limited to 10 requests per user per minute, approximately per Cloudflare location; maximum request size is 4 KiB. A 202 confirms queue acceptance, not completion. Find queue_job_completed in Worker logs using jobId or X-Request-Id. Delivery is at least once and ordering is not guaranteed; duplicate delivery can create duplicate logs. Retrying an HTTP request can enqueue another job. Logout does not cancel accepted jobs. This example has no persistent side effects or status endpoint.',
    security: [{ bearerAuth: [] }],
    middleware: [requireAuth, rateLimitQueue] as const,
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: exampleRequestSchema,
            examples: {
              example: { value: { message: 'Hello from the game client' } },
            },
          },
        },
      },
    },
    responses: {
      202: {
        description: 'Accepted for asynchronous processing.',
        headers,
        content: {
          'application/json': {
            schema: queuedResponseSchema,
            example: {
              jobId: '6ce024c5-5c3d-4fa3-9288-3f86f5d47566',
              status: 'queued',
            },
          },
        },
      },
      400: errorResponse(400, 'Bad Request', 'Invalid request body'),
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
        ...errorResponse(503, 'Service Unavailable', 'Queue unavailable'),
        description:
          'Queue publication, rate limiting, authentication storage, or authentication configuration is unavailable. A failed publication can have an uncertain outcome; retrying can enqueue a duplicate.',
      },
    },
  }),
  async (c) => {
    let jobId: string;
    try {
      jobId = await enqueueExampleJob(
        c.env.APP_QUEUE,
        c.req.valid('json'),
        c.get('user').id,
        c.get('requestId'),
      );
    } catch {
      throw new HTTPException(503, { message: 'Queue unavailable' });
    }
    return c.json({ jobId, status: 'queued' as const }, 202);
  },
);
