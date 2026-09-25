import { HTTPException } from 'hono/http-exception';
import type { ErrorHandler } from 'hono';
import type { AppEnv } from './env.js';

const labels: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

export const handleError: ErrorHandler<AppEnv> = (error, c) => {
  const status = error instanceof HTTPException ? error.status : 500;
  // Exception messages can contain SQL parameters or JWTs. Never log them.
  if (status >= 500) {
    console.error(
      JSON.stringify({
        event: 'request_failed',
        status,
        requestId: c.get('requestId'),
      }),
    );
  }
  return c.json(
    {
      statusCode: status,
      message: status === 500 ? 'Internal server error' : error.message,
      error: labels[status] ?? 'Request failed',
    },
    status,
  );
};
