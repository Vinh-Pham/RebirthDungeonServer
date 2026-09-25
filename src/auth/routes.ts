import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import type { AppEnv } from '../env.js';
import { createRepository } from '../db/repository.js';
import { createAuthService } from './service.js';
import { publicUser } from './tokens.js';
import { rateLimitAuth, requireAuth } from './middleware.js';
import {
  authResponseSchema,
  credentialsSchema,
  refreshSchema,
  userSchema,
} from './schemas.js';

import {
  credentialsExample,
  refreshExample,
  userExample,
  responseHeaders,
  publicEndpointErrors,
  protectedEndpointErrors,
  duplicateEmailResponse,
  invalidCredentialsResponse,
  invalidRefreshResponse,
  tokenResponse,
} from './documentation.js';

export const authRoutes = new OpenAPIHono<AppEnv>({
  defaultHook: (result) => {
    if (!result.success)
      throw new HTTPException(400, { message: 'Invalid request body' });
  },
});

authRoutes.use(
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

authRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/register',
    tags: ['Authentication'],
    operationId: 'register',
    summary: 'Register and sign in',
    description:
      'Create an account and its initial session atomically. Email is trimmed and lowercased. Passwords contain 12–128 Unicode characters without trimming. A duplicate normalized email returns 409. Limit: 10 requests per IP per minute per Cloudflare location.',
    security: [],
    middleware: [rateLimitAuth] as const,
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: credentialsSchema,
            examples: {
              credentials: {
                summary: 'Fictional account; replace before sending.',
                value: credentialsExample,
              },
            },
          },
        },
      },
    },
    responses: {
      ...publicEndpointErrors,
      201: tokenResponse(
        'Account created and signed in. Store the returned token pair.',
      ),
      409: duplicateEmailResponse,
    },
  }),
  async (c) =>
    c.json(await createAuthService(c.env).register(c.req.valid('json')), 201),
);

authRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/login',
    tags: ['Authentication'],
    operationId: 'login',
    summary: 'Sign in and replace the active session',
    description:
      'Sign in with existing credentials. A successful login replaces the single active session, immediately revoking previous tokens on subsequent requests. Unknown email and wrong password both return 401. Starts a new seven-day session. Limit: 10 requests per IP per minute per Cloudflare location.',
    security: [],
    middleware: [rateLimitAuth] as const,
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: credentialsSchema,
            examples: {
              credentials: {
                summary: 'Fictional account; replace before sending.',
                value: credentialsExample,
              },
            },
          },
        },
      },
    },
    responses: {
      ...publicEndpointErrors,
      401: invalidCredentialsResponse,
      200: tokenResponse(
        'Signed in with a new session. Replace any previously stored tokens.',
      ),
    },
  }),
  async (c) =>
    c.json(await createAuthService(c.env).login(c.req.valid('json')), 200),
);

authRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/refresh',
    tags: ['Authentication'],
    operationId: 'refresh',
    summary: 'Rotate the refresh token',
    security: [],
    middleware: [rateLimitAuth] as const,
    description:
      'Exchange the current opaque refresh token for a new pair; no bearer token is required. Preserves session ID and the seven-day absolute expiry. Serialize client refresh requests: exactly one concurrent use succeeds; others and replay attempts return 401 without revoking the winning session. If a successful response is lost, sign in again. Limit: 30 requests per IP per minute per Cloudflare location.',
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: refreshSchema,
            examples: {
              refresh: {
                summary:
                  'Placeholder only; paste the latest refresh token from your response.',
                value: refreshExample,
              },
            },
          },
        },
      },
    },
    responses: {
      ...publicEndpointErrors,
      401: invalidRefreshResponse,
      200: tokenResponse(
        'Token rotated. Replace both stored tokens; the session deadline is unchanged.',
        true,
      ),
    },
  }),
  async (c) =>
    c.json(
      await createAuthService(c.env).refresh(c.req.valid('json').refreshToken),
      200,
    ),
);

authRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/me',
    tags: ['Authentication'],
    operationId: 'me',
    summary: 'Get the current user',
    description:
      'Send the current bearer access token. Returns the public user profile after checking the active session in D1. Expired tokens and revoked/replaced sessions return 401. No request body is needed.',
    security: [{ bearerAuth: [] }],
    middleware: [requireAuth] as const,
    responses: {
      ...protectedEndpointErrors,
      200: {
        description:
          'Current public user profile. Password hashes and token hashes are never returned.',
        headers: responseHeaders,
        content: {
          'application/json': {
            schema: z.object({ user: userSchema }),
            example: { user: userExample },
          },
        },
      },
    },
  }),
  (c) => c.json({ user: publicUser(c.get('user')) }, 200),
);

authRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/logout',
    tags: ['Authentication'],
    operationId: 'logout',
    summary: 'Revoke this session',
    description:
      'Send the current bearer access token. Deletes only its matching session and invalidates both tokens for subsequent requests. No request body is needed; success has no response body. A missing, expired, or already revoked session returns 401.',
    security: [{ bearerAuth: [] }],
    middleware: [requireAuth] as const,
    responses: {
      ...protectedEndpointErrors,
      204: {
        description:
          'Session revoked. Empty response; do not attempt to parse JSON.',
        headers: responseHeaders,
      },
    },
  }),
  async (c) => {
    await createRepository(c.env.DB).deleteSession(
      c.get('user').id,
      c.get('sessionId'),
    );
    return c.body(null, 204);
  },
);
