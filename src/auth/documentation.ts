import { authResponseSchema, errorSchema } from './schemas.js';

export const credentialsExample = {
  email: 'adventurer@example.com',
  password: 'example-only long password',
};

// Illustrative placeholders only. Never put real credentials in the specification.
export const refreshExample = { refreshToken: 'r'.repeat(43) };
export const userExample = {
  id: '6ce024c5-5c3d-4fa3-9288-3f86f5d47566',
  email: 'adventurer@example.com',
  createdAt: '2026-09-24T12:00:00.000Z',
  updatedAt: '2026-09-24T12:00:00.000Z',
};
export const tokenExample = {
  user: userExample,
  accessToken: 'REPLACE_WITH_ACCESS_TOKEN_FROM_RESPONSE',
  refreshToken: refreshExample.refreshToken,
  tokenType: 'Bearer' as const,
  expiresIn: 900,
  refreshTokenExpiresAt: '2026-10-01T12:00:00.000Z',
};

export const responseHeaders = {
  'Cache-Control': {
    description:
      'Authentication responses must not be cached, including errors.',
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

function errorResponse(
  statusCode: number,
  error: string,
  description: string,
  messages: Record<string, string>,
) {
  return {
    description,
    headers: responseHeaders,
    content: {
      'application/json': {
        schema: errorSchema,
        examples: Object.fromEntries(
          Object.entries(messages).map(([name, message]) => [
            name,
            {
              summary: message,
              value: { statusCode, message, error },
            },
          ]),
        ),
      },
    },
  };
}

// Every auth route runs the body limiter; infrastructure errors can occur on any route.
export const commonErrors = {
  413: errorResponse(
    413,
    'Payload Too Large',
    'Request body exceeds the 4 KiB limit.',
    {
      oversizedBody: 'Request body exceeds 4096 bytes',
    },
  ),
  500: errorResponse(
    500,
    'Internal Server Error',
    'Unexpected failure; implementation details are not exposed.',
    {
      unexpected: 'Internal server error',
    },
  ),
  503: errorResponse(
    503,
    'Service Unavailable',
    'Authentication storage or configuration is unavailable. Retry later; this does not mean the credentials are incorrect.',
    {
      storage: 'Authentication storage unavailable',
      configuration: 'Authentication configuration unavailable',
    },
  ),
};

export const publicEndpointErrors = {
  ...commonErrors,
  400: errorResponse(
    400,
    'Bad Request',
    'Invalid JSON, missing or unknown fields, or values that do not satisfy the request schema.',
    {
      validation: 'Invalid request body',
      malformedJson: 'Malformed JSON in request body',
    },
  ),
  429: {
    ...errorResponse(
      429,
      'Too Many Requests',
      'Per-endpoint/IP limit exceeded. Wait before retrying. Limits are approximate and local to each Cloudflare location.',
      {
        throttled: 'Too many requests',
      },
    ),
    headers: {
      ...responseHeaders,
      'Retry-After': {
        description: 'Suggested delay in seconds before retrying.',
        schema: { type: 'string' as const, example: '60' },
      },
    },
  },
  503: errorResponse(
    503,
    'Service Unavailable',
    'Authentication storage, configuration, or rate limiter is unavailable. Retry later.',
    {
      storage: 'Authentication storage unavailable',
      configuration: 'Authentication configuration unavailable',
      rateLimiter: 'Rate limiting unavailable',
    },
  ),
};

export const duplicateEmailResponse = errorResponse(
  409,
  'Conflict',
  'The normalized email address is already registered.',
  {
    duplicateEmail: 'Email already registered',
  },
);
export const invalidCredentialsResponse = errorResponse(
  401,
  'Unauthorized',
  'Unknown email and incorrect password produce the same response.',
  {
    invalidCredentials: 'Invalid credentials',
  },
);
export const invalidRefreshResponse = errorResponse(
  401,
  'Unauthorized',
  'Refresh token is expired, already consumed, unknown, or belongs to a revoked/replaced session. Sign in again.',
  {
    expiredOrReplayed: 'Invalid refresh token',
    expiredDuringRefresh: 'Session expired',
  },
);
export const protectedEndpointErrors = {
  ...commonErrors,
  401: errorResponse(
    401,
    'Unauthorized',
    'Supply a valid bearer access token belonging to the current, unexpired session.',
    {
      missingBearer: 'Bearer access token required',
      invalidToken: 'Invalid access token',
      revokedSession: 'Session expired or revoked',
    },
  ),
};

export function tokenResponse(description: string, rotated = false) {
  return {
    description,
    headers: responseHeaders,
    content: {
      'application/json': {
        schema: authResponseSchema,
        examples: {
          tokenPair: {
            summary:
              'Fictional example; token values are placeholders, not usable credentials.',
            value: {
              ...tokenExample,
              refreshToken: rotated
                ? 's'.repeat(43)
                : tokenExample.refreshToken,
            },
          },
        },
      },
    },
  };
}

export const authenticationGuide = `
## Quick start

1. Call **Register** with a new email and password, or **Login** for an existing account. Both return a user and token pair.
2. Send the returned access token in \`Authorization: Bearer <accessToken>\` to **Get the current user** or other protected operations.
3. Before the access token expires, call **Refresh** with the current refresh token in the JSON body. Replace both stored tokens after success.
4. Call **Logout** with the current access token to revoke the session. A successful logout returns **204 with no body**.

## Session and refresh behavior

Each user has **one active session**. A new login immediately revokes the previous session's access and refresh tokens for subsequent requests; already authorized requests can finish.

Access tokens last **at most 15 minutes**, capped by the session deadline. Sessions expire **seven days after login**. Refresh preserves the session ID and absolute deadline; it does not add another seven days. Access tokens from the same session remain valid until their expiry.

Refresh tokens are single-use. **Serialize refresh requests** in the client: exactly one concurrent use succeeds and the others return 401. Replaying a consumed token does not revoke the winning session. If a successful refresh response is lost, sign in again because the old token has already been consumed. A revoked or expired session also requires login.

## Request and response conventions

Use JSON request bodies and \`Content-Type: application/json\`. Email is trimmed and lowercased, then validated (maximum 254 characters). Passwords contain 12–128 Unicode characters; whitespace is preserved. Unknown credential/refresh fields are rejected. Request bodies are limited to **4 KiB (4096 bytes)**.

Dates are UTC ISO 8601 strings. \`expiresIn\` is the access-token lifetime in **seconds**; \`refreshTokenExpiresAt\` is the fixed session deadline. Refresh tokens are opaque 43-character base64url strings, not JWTs. No cookie authentication is used. Example accounts are fictional and example tokens are clearly marked placeholders.

All authentication responses, including errors, send \`Cache-Control: no-store\` and a server-generated \`X-Request-Id\`. Register and login each allow **10 requests per IP per minute**; refresh allows **30**. Limits are approximate per Cloudflare location. A 429 includes \`Retry-After: 60\` (seconds). Current-user and logout operations do not use these rate-limit bindings.

## Try the API in Scalar

Interactive requests target the **same origin** as this documentation. On your local server, open Register or Login, select **Test Request**, replace the fictional credentials with a disposable test account, and send the request. Copy \`accessToken\` from the response into Scalar's **Bearer Token** authentication input; paste only the token, without the \`Bearer \` prefix. Then test **Get the current user**.

For Refresh, replace the example \`refreshToken\` with the latest token from your response. Afterward, replace both the bearer token and refresh token with the new values. Test Logout last. Authentication persistence is disabled; enter the token again after reloading the documentation. Sending requests changes data on the selected server—use a local disposable account while exploring.
`;
