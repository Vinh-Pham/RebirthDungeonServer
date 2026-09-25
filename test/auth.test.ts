import { env, exports } from 'cloudflare:workers';
import { applyD1Migrations, reset, type D1Migration } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sign, decode } from 'hono/jwt';
import { createHmac } from 'node:crypto';
import { app } from '../src/index.js';
import { createRepository } from '../src/db/repository.js';
import { hashRefreshToken, newRefreshToken } from '../src/auth/tokens.js';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from '../src/auth/password.js';
import type { AuthResponse } from '../src/auth/schemas.js';
import {
  credentialsSchema,
  refreshSchema,
  authResponseSchema,
  userSchema,
  errorSchema,
} from '../src/auth/schemas.js';

type ExampleMedia = {
  schema: Record<string, unknown>;
  example?: unknown;
  examples?: Record<string, { value: unknown }>;
};
type DocumentResponse = {
  headers: Record<string, unknown>;
  content?: { 'application/json': ExampleMedia };
};
type DocumentOperation = {
  operationId: string;
  security: unknown[];
  requestBody?: { content: { 'application/json': ExampleMedia } };
  responses: Record<string, DocumentResponse>;
};
type ApiDocument = {
  openapi: string;
  servers: { url: string }[];
  components: {
    schemas: Record<
      string,
      { properties: Record<string, unknown>; required: string[] }
    >;
  };
  paths: Record<string, Record<string, DocumentOperation>>;
};

function checkReferences(value: unknown, document: unknown) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === '$ref') {
      expect(typeof child).toBe('string');
      const ref = String(child);
      expect(ref.startsWith('#/')).toBe(true);
      let target = document;
      for (const part of ref.slice(2).split('/')) {
        expect(target).toBeTypeOf('object');
        target = (target as Record<string, unknown>)[
          part.replace(/~1/g, '/').replace(/~0/g, '~')
        ];
      }
      expect(target, `Unresolved reference: ${ref}`).toBeDefined();
    } else checkReferences(child, document);
  }
}

async function document(): Promise<ApiDocument> {
  return (await request('/openapi.json')).json<ApiDocument>();
}

function checkDocumentedHeaders(
  response: Response,
  definition: DocumentResponse,
) {
  for (const header of Object.keys(definition.headers))
    expect(response.headers.get(header), header).not.toBeNull();
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(response.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/);
}

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

const PASSWORD = '  a secure 🔐password漢字  ';
const EMAIL = 'player@example.com';

function request(path: string, body?: unknown, token?: string) {
  return exports.default.fetch(`https://example.com${path}`, {
    method: body !== undefined || path === '/auth/logout' ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '192.0.2.1',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function register(email = EMAIL): Promise<AuthResponse> {
  const response = await request('/auth/register', {
    email,
    password: PASSWORD,
  });
  expect(response.status).toBe(201);
  return response.json<AuthResponse>();
}

async function currentSession() {
  return env.DB.prepare('SELECT * FROM auth_sessions').first<
    Record<string, string | number>
  >();
}

async function customJwt(
  token: string,
  changes: Record<string, unknown>,
  secret = env.JWT_ACCESS_SECRET,
) {
  return sign({ ...decode(token).payload, ...changes }, secret, 'HS256');
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await reset();
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe('authentication in Workers with local D1', () => {
  it('registers, normalizes email, stores hashes, and returns the current user', async () => {
    const response = await request('/auth/register', {
      email: '  PLAYER@EXAMPLE.COM  ',
      password: PASSWORD,
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const data = await response.json<AuthResponse>();
    expect(data.user.email).toBe(EMAIL);
    expect(data.tokenType).toBe('Bearer');
    expect(data.expiresIn).toBe(900);
    const row = await env.DB.prepare('SELECT * FROM users').first();
    expect(row!.password_hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(row!.created_at).toBe(new Date(data.user.createdAt).getTime());
    const session = await currentSession();
    expect(session!.refresh_token_hash).toBe(
      hashRefreshToken(data.refreshToken),
    );
    expect(Number(session!.expires_at) - Number(session!.created_at)).toBe(
      7 * 86400000,
    );
    expect(data.user).not.toHaveProperty('passwordHash');
    const me = await request('/auth/me', undefined, data.accessToken);
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ user: data.user });
  });

  it('rejects duplicate and concurrent normalized registrations without orphan users', async () => {
    const responses = await Promise.all([
      request('/auth/register', { email: EMAIL, password: PASSWORD }),
      request('/auth/register', {
        email: ' PLAYER@EXAMPLE.COM ',
        password: PASSWORD,
      }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first(
        'count',
      ),
    ).toBe(1);
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM auth_sessions').first(
        'count',
      ),
    ).toBe(1);
  });

  it('rolls back user insertion when session insertion fails', async () => {
    await env.DB.prepare(
      "CREATE TRIGGER reject_session BEFORE INSERT ON auth_sessions BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    ).run();
    const response = await request('/auth/register', {
      email: EMAIL,
      password: PASSWORD,
    });
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('test failure');
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first(
        'count',
      ),
    ).toBe(0);
  });

  it('replaces the session on login and immediately revokes previous tokens', async () => {
    const first = await register();
    const response = await request('/auth/login', {
      email: EMAIL,
      password: PASSWORD,
    });
    expect(response.status).toBe(200);
    const second = await response.json<AuthResponse>();
    expect(decode(first.accessToken).payload.sid).not.toBe(
      decode(second.accessToken).payload.sid,
    );
    expect(
      (await request('/auth/me', undefined, first.accessToken)).status,
    ).toBe(401);
    expect(
      (await request('/auth/refresh', { refreshToken: first.refreshToken }))
        .status,
    ).toBe(401);
    expect(
      (await request('/auth/me', undefined, second.accessToken)).status,
    ).toBe(200);
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM auth_sessions').first(
        'count',
      ),
    ).toBe(1);
  });

  it('returns identical errors for wrong passwords and unknown users', async () => {
    await register();
    const wrong = await request('/auth/login', {
      email: EMAIL,
      password: 'a wrong long password',
    });
    const absent = await request('/auth/login', {
      email: 'absent@example.com',
      password: PASSWORD,
    });
    expect(wrong.status).toBe(401);
    expect(absent.status).toBe(401);
    expect(await wrong.json()).toEqual(await absent.json());
    expect(
      (
        await request('/auth/login', {
          email: EMAIL,
          password: PASSWORD.trim(),
        })
      ).status,
    ).toBe(401);
  });

  it('preserves legacy native-Argon2 credentials and preexisting JWT/refresh sessions', async () => {
    // Independently generated with Node's native Argon2, not the Worker implementation.
    const password = '  🔐pässword漢字\u0000a long password  ';
    const passwordHash =
      '$argon2id$v=19$m=19456,t=2,p=1$MDEyMzQ1Njc4OWFiY2RlZg$vF/Rv/yypHrxl3cBci8vY7WTfYbROYp6sn0wr7oxGKQ';
    const refreshToken = newRefreshToken();
    const now = Math.floor(Date.now() / 1000);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)').bind(
        'legacy-user',
        'legacy@example.com',
        passwordHash,
        1,
        1,
      ),
      env.DB.prepare(
        'INSERT INTO auth_sessions VALUES (?, ?, ?, ?, ?, ?)',
      ).bind(
        'legacy-user',
        'legacy-session',
        hashRefreshToken(refreshToken),
        (now + 86400) * 1000,
        1,
        1,
      ),
    ]);
    // Matches the legacy jsonwebtoken/Nest HS256 wire format, signed independently of Hono.
    const encoded = [
      { alg: 'HS256', typ: 'JWT' },
      {
        sub: 'legacy-user',
        sid: 'legacy-session',
        iat: now,
        exp: now + 900,
        iss: 'rebirth-dungeon-server',
        aud: 'rebirth-dungeon-game',
      },
    ]
      .map((part) => Buffer.from(JSON.stringify(part)).toString('base64url'))
      .join('.');
    const token = `${encoded}.${createHmac('sha256', env.JWT_ACCESS_SECRET).update(encoded).digest('base64url')}`;
    expect((await request('/auth/me', undefined, token)).status).toBe(200);
    expect((await request('/auth/refresh', { refreshToken })).status).toBe(200);
    const login = await request('/auth/login', {
      email: 'legacy@example.com',
      password,
    });
    expect(login.status).toBe(200);
    const result = await login.json<AuthResponse>();
    expect(result.user.id).toBe('legacy-user');
    expect(result.user.createdAt).toBe('1970-01-01T00:00:00.001Z');
    expect(
      await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
        .bind('legacy-user')
        .first('password_hash'),
    ).toBe(passwordHash);
  });

  it('rotates once under concurrent refresh, preserving the fixed session expiry', async () => {
    const first = await register();
    const before = await currentSession();
    const responses = await Promise.all([
      request('/auth/refresh', { refreshToken: first.refreshToken }),
      request('/auth/refresh', { refreshToken: first.refreshToken }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 401,
    ]);
    const winner = await responses
      .find((response) => response.status === 200)!
      .json<AuthResponse>();
    expect(winner.refreshToken).not.toBe(first.refreshToken);
    expect(winner.refreshTokenExpiresAt).toBe(first.refreshTokenExpiresAt);
    const after = await currentSession();
    expect(after!.session_id).toBe(before!.session_id);
    expect(after!.created_at).toBe(before!.created_at);
    expect(after!.expires_at).toBe(before!.expires_at);
    expect(after!.refresh_token_hash).toBe(
      hashRefreshToken(winner.refreshToken),
    );
    expect(
      (await request('/auth/refresh', { refreshToken: first.refreshToken }))
        .status,
    ).toBe(401);
    expect(
      (await request('/auth/refresh', { refreshToken: winner.refreshToken }))
        .status,
    ).toBe(200);
    expect(
      (await request('/auth/me', undefined, first.accessToken)).status,
    ).toBe(200);
  });

  it('rejects random and expired refresh tokens and caps access expiry', async () => {
    const auth = await register();
    expect(
      (await request('/auth/refresh', { refreshToken: newRefreshToken() }))
        .status,
    ).toBe(401);
    await env.DB.prepare('UPDATE auth_sessions SET expires_at = ?')
      .bind(Date.now() + 45000)
      .run();
    const refreshed = await request('/auth/refresh', {
      refreshToken: auth.refreshToken,
    });
    expect(refreshed.status).toBe(200);
    const data = await refreshed.json<AuthResponse>();
    expect(data.expiresIn).toBeGreaterThan(0);
    expect(data.expiresIn).toBeLessThanOrEqual(45);
    await env.DB.prepare('UPDATE auth_sessions SET expires_at = ?')
      .bind(Date.now() - 1)
      .run();
    expect(
      (await request('/auth/refresh', { refreshToken: data.refreshToken }))
        .status,
    ).toBe(401);
    expect(
      (await request('/auth/me', undefined, data.accessToken)).status,
    ).toBe(401);
  });

  it('logout revokes both tokens and stale logout cannot delete a replacement session', async () => {
    const first = await register();
    const login = await request('/auth/login', {
      email: EMAIL,
      password: PASSWORD,
    });
    const current = await login.json<AuthResponse>();
    // Simulate a logout that passed authentication before the new login committed.
    await createRepository(env.DB).deleteSession(
      first.user.id,
      String(decode(first.accessToken).payload.sid),
    );
    expect(
      (await request('/auth/me', undefined, current.accessToken)).status,
    ).toBe(200);
    expect(
      (await request('/auth/logout', undefined, first.accessToken)).status,
    ).toBe(401);
    const logout = await request(
      '/auth/logout',
      undefined,
      current.accessToken,
    );
    expect(logout.status).toBe(204);
    expect(await logout.text()).toBe('');
    expect(
      (await request('/auth/me', undefined, current.accessToken)).status,
    ).toBe(401);
    expect(
      (await request('/auth/refresh', { refreshToken: current.refreshToken }))
        .status,
    ).toBe(401);
  });

  it('does not allow a refresh read before replacement to overwrite the new login', async () => {
    const old = await register();
    const repository = createRepository(env.DB);
    const previous = await repository.findRefresh(
      hashRefreshToken(old.refreshToken),
    );
    const login = await request('/auth/login', {
      email: EMAIL,
      password: PASSWORD,
    });
    const current = await login.json<AuthResponse>();
    expect(
      await repository.rotate(
        previous!.session,
        hashRefreshToken(old.refreshToken),
        hashRefreshToken(newRefreshToken()),
      ),
    ).toEqual([]);
    expect(
      (await request('/auth/refresh', { refreshToken: current.refreshToken }))
        .status,
    ).toBe(200);
  });

  it('cascades sessions on user deletion', async () => {
    const auth = await register();
    await env.DB.prepare('DELETE FROM users WHERE id = ?')
      .bind(auth.user.id)
      .run();
    expect(await currentSession()).toBeNull();
    expect(
      (await request('/auth/me', undefined, auth.accessToken)).status,
    ).toBe(401);
  });

  it('rejects invalid signatures, algorithms, claims, and expired tokens', async () => {
    const auth = await register();
    const now = Math.floor(Date.now() / 1000);
    const invalid = [
      'not-a-jwt',
      await customJwt(
        auth.accessToken,
        {},
        'another-test-secret-at-least-thirty-two-bytes',
      ),
      await customJwt(auth.accessToken, { exp: now - 1 }),
      await customJwt(auth.accessToken, { iat: now + 100 }),
      await customJwt(auth.accessToken, { nbf: now + 100 }),
      await customJwt(auth.accessToken, { iss: 'wrong' }),
      await customJwt(auth.accessToken, { aud: 'wrong' }),
      await customJwt(auth.accessToken, { sub: undefined }),
      await customJwt(auth.accessToken, { sid: undefined }),
      await customJwt(auth.accessToken, { iat: undefined }),
      await customJwt(auth.accessToken, { exp: undefined }),
      await sign(
        decode(auth.accessToken).payload,
        env.JWT_ACCESS_SECRET,
        'HS384',
      ),
    ];
    for (const token of invalid) {
      const response = await request('/auth/me', undefined, token);
      expect(response.status).toBe(401);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
    expect((await request('/auth/me')).status).toBe(401);
  });

  it('validates bodies including Unicode lengths, unknown fields, and malformed JSON', async () => {
    const invalid = [
      {},
      { email: 'invalid', password: PASSWORD },
      { email: EMAIL, password: 'short' },
      { email: EMAIL, password: '🔐'.repeat(11) },
      { email: EMAIL, password: 'a'.repeat(129) },
      { email: EMAIL, password: PASSWORD, admin: true },
    ];
    for (const body of invalid)
      expect((await request('/auth/register', body)).status).toBe(400);
    const unicode = await request('/auth/register', {
      email: EMAIL,
      password: '🔐'.repeat(12),
    });
    expect(unicode.status).toBe(201);
    const malformed = await exports.default.fetch(
      'https://example.com/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      },
    );
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toHaveProperty('statusCode', 400);
    expect(
      (await request('/auth/refresh', { refreshToken: 'bad' })).status,
    ).toBe(400);
    expect(
      (
        await request('/auth/register', {
          email: EMAIL,
          password: 'x'.repeat(5000),
        })
      ).status,
    ).toBe(413);
  });

  it('rate limits requests and fails closed when the limiter fails', async () => {
    for (let index = 0; index < 10; index++)
      expect((await request('/auth/login', {})).status).toBe(400);
    const response = await request('/auth/login', {});
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    const brokenLimiter = {
      limit: async () => {
        throw new Error('private failure');
      },
    };
    const failed = await app.request(
      '/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      },
      { ...env, AUTH_RATE_LIMIT: brokenLimiter },
    );
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain('private failure');
  });

  it('fails closed on D1 failure without exposing stored data or SQL errors', async () => {
    const auth = await register();
    await env.DB.prepare('DROP TABLE auth_sessions').run();
    const response = await request('/auth/me', undefined, auth.accessToken);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Authentication storage unavailable',
    });
  });

  it('rejects a missing signing secret without creating an account', async () => {
    const response = await app.request(
      '/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      },
      { ...env, JWT_ACCESS_SECRET: '' },
    );
    expect(response.status).toBe(503);
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first(
        'count',
      ),
    ).toBe(0);
  });

  it('provides OpenAPI schemas and Scalar docs for authentication and queues', async () => {
    const response = await request('/openapi.json');
    expect(response.status).toBe(200);
    const document = await response.json<{
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    }>();
    expect(Object.keys(document.paths).sort()).toEqual([
      '/auth/login',
      '/auth/logout',
      '/auth/me',
      '/auth/refresh',
      '/auth/register',
      '/cache/entries',
      '/cache/entries/{name}',
      '/queues/example',
    ]);
    expect(document.components.schemas).toHaveProperty('AuthResponse');
    const docs = await request('/docs');
    expect(docs.status).toBe(200);
    expect(await docs.text()).toContain('/openapi.json');
  });

  it('hashes and verifies passwords with bounded Workers runtime cost', async () => {
    const start = performance.now();
    const hash = await hashPassword(PASSWORD);
    expect(await verifyPassword(hash, PASSWORD)).toBe(true);
    expect(await verifyPassword(hash, 'another long password')).toBe(false);
    expect(await verifyPassword(DUMMY_PASSWORD_HASH, PASSWORD)).toBe(false);
    console.log(
      JSON.stringify({
        event: 'password_benchmark',
        operations: 4,
        elapsedMs: performance.now() - start,
      }),
    );
  });

  it('documents exact operation security, statuses, headers, and resolvable references', async () => {
    const spec = await document();
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.servers).toEqual([
      { url: '/', description: 'Current server (same origin as these docs)' },
    ]);
    const cases = [
      ['register', 'post', ['201', '400', '409', '413', '429', '500', '503']],
      ['login', 'post', ['200', '400', '401', '413', '429', '500', '503']],
      ['refresh', 'post', ['200', '400', '401', '413', '429', '500', '503']],
      ['me', 'get', ['200', '401', '413', '500', '503']],
      ['logout', 'post', ['204', '401', '413', '500', '503']],
    ] as const;
    const ids = [];
    for (const [name, method, statuses] of cases) {
      const operation = spec.paths[`/auth/${name}`]![method]!;
      ids.push(operation.operationId);
      expect(operation.operationId).toBe(name);
      expect(operation.security).toEqual(
        ['me', 'logout'].includes(name) ? [{ bearerAuth: [] }] : [],
      );
      expect(Object.keys(operation.responses).sort()).toEqual(statuses);
      for (const [status, response] of Object.entries(operation.responses)) {
        expect(response.headers).toHaveProperty('Cache-Control');
        expect(response.headers).toHaveProperty('X-Request-Id');
        expect(Object.hasOwn(response.headers, 'Retry-After')).toBe(
          status === '429',
        );
        if (status === '204') expect(response).not.toHaveProperty('content');
      }
    }
    expect(new Set(ids).size).toBe(5);
    checkReferences(spec, spec);
    const html = await (await request('/docs')).text();
    expect(html).toContain('<title>Rebirth Dungeon API Reference</title>');
    expect(html).toMatch(/"persistAuth"\s*:\s*false/);
  });

  it('keeps all documented authentication request and response examples valid', async () => {
    const spec = await document();
    for (const [path, methods] of Object.entries(spec.paths)) {
      if (!path.startsWith('/auth/')) continue;
      for (const operation of Object.values(methods)) {
        const body = operation.requestBody?.content['application/json'];
        if (body) {
          expect(Object.keys(body.examples ?? {}).length).toBeGreaterThan(0);
          for (const example of Object.values(body.examples!)) {
            expect(
              (path === '/auth/refresh'
                ? refreshSchema
                : credentialsSchema
              ).safeParse(example.value).success,
            ).toBe(true);
          }
        }
        for (const [status, response] of Object.entries(operation.responses)) {
          if (status === '204') continue;
          const media = response.content!['application/json'];
          const values = media.examples
            ? Object.values(media.examples).map((example) => example.value)
            : [media.example];
          expect(values.length).toBeGreaterThan(0);
          for (const value of values) {
            if (Number(status) >= 400) {
              expect(errorSchema.parse(value).statusCode).toBe(Number(status));
            } else if (path === '/auth/me') {
              expect(
                userSchema.safeParse((value as { user: unknown }).user).success,
              ).toBe(true);
            } else
              expect(authResponseSchema.safeParse(value).success).toBe(true);
          }
        }
      }
    }
  });

  it('matches the documented success/error shapes and headers against actual responses', async () => {
    const spec = await document();
    const credentials =
      spec.paths['/auth/register']!.post!.requestBody!.content[
        'application/json'
      ].examples!.credentials!.value;
    const registered = await request('/auth/register', credentials);
    expect(registered.status).toBe(201);
    checkDocumentedHeaders(
      registered,
      spec.paths['/auth/register']!.post!.responses['201']!,
    );
    const registeredBody = authResponseSchema.parse(await registered.json());
    expect(Object.keys(registeredBody).sort()).toEqual(
      Object.keys(spec.components.schemas.AuthResponse!.properties).sort(),
    );
    expect(Object.keys(registeredBody.user).sort()).toEqual(
      [...spec.components.schemas.User!.required].sort(),
    );

    const duplicate = await request('/auth/register', credentials);
    expect(duplicate.status).toBe(409);
    const duplicateDefinition =
      spec.paths['/auth/register']!.post!.responses['409']!;
    checkDocumentedHeaders(duplicate, duplicateDefinition);
    expect(await duplicate.json()).toEqual(
      duplicateDefinition.content!['application/json'].examples!.duplicateEmail!
        .value,
    );

    const login = await request('/auth/login', credentials);
    checkDocumentedHeaders(
      login,
      spec.paths['/auth/login']!.post!.responses['200']!,
    );
    const loggedIn = authResponseSchema.parse(await login.json());
    const refreshed = await request('/auth/refresh', {
      refreshToken: loggedIn.refreshToken,
    });
    checkDocumentedHeaders(
      refreshed,
      spec.paths['/auth/refresh']!.post!.responses['200']!,
    );
    const auth = authResponseSchema.parse(await refreshed.json());
    const me = await request('/auth/me', undefined, auth.accessToken);
    checkDocumentedHeaders(me, spec.paths['/auth/me']!.get!.responses['200']!);
    expect(await me.json()).toEqual({ user: auth.user });
    const logout = await request('/auth/logout', undefined, auth.accessToken);
    expect(logout.status).toBe(204);
    checkDocumentedHeaders(
      logout,
      spec.paths['/auth/logout']!.post!.responses['204']!,
    );
    expect(await logout.text()).toBe('');

    const malformed = await exports.default.fetch(
      'https://example.com/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      },
    );
    const malformedDefinition =
      spec.paths['/auth/login']!.post!.responses['400']!;
    checkDocumentedHeaders(malformed, malformedDefinition);
    expect(await malformed.json()).toEqual(
      malformedDefinition.content!['application/json'].examples!.malformedJson!
        .value,
    );
  });
});
