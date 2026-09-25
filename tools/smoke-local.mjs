import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { getPlatformProxy } from 'wrangler';

const origin = new URL(process.env.LOCAL_API_ORIGIN ?? 'http://127.0.0.1:8787');
if (
  !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) ||
  origin.protocol !== 'http:'
) {
  throw new Error('The smoke test only accepts a local HTTP server.');
}
const email = `smoke-${randomUUID()}@example.invalid`;
const password = `local-only-${randomUUID()}`;
const timings = {};

async function request(path, body, token) {
  const start = performance.now();
  const response = await fetch(new URL(path, origin), {
    method: body !== undefined || path === '/auth/logout' ? 'POST' : 'GET',
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  timings[path] = Math.round(performance.now() - start);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  return response;
}

try {
  const registered = await request('/auth/register', { email, password });
  assert.equal(registered.status, 201);
  const first = await registered.json();
  const login = await request('/auth/login', { email, password });
  assert.equal(login.status, 200);
  const current = await login.json();
  assert.equal(
    (await request('/auth/me', undefined, first.accessToken)).status,
    401,
  );
  const refreshed = await request('/auth/refresh', {
    refreshToken: current.refreshToken,
  });
  assert.equal(refreshed.status, 200);
  const next = await refreshed.json();
  assert.equal(next.refreshTokenExpiresAt, current.refreshTokenExpiresAt);
  assert.equal(
    (await request('/auth/me', undefined, next.accessToken)).status,
    200,
  );
  assert.equal(
    (await request('/auth/logout', undefined, next.accessToken)).status,
    204,
  );
  assert.equal(
    (await request('/auth/me', undefined, next.accessToken)).status,
    401,
  );
  console.log(
    JSON.stringify({
      result: 'Local HTTP authentication flow passed',
      elapsedMs: timings,
    }),
  );
} finally {
  // Only remove this run's synthetic account from local storage.
  const proxy = await getPlatformProxy({
    configPath: 'wrangler.jsonc',
    remoteBindings: false,
  });
  try {
    await proxy.env.DB.prepare('DELETE FROM users WHERE email = ?')
      .bind(email)
      .run();
  } finally {
    await proxy.dispose();
  }
}
