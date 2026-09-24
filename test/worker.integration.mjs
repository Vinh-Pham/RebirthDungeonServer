import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { createServer } from 'node:net';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';

await test(
  'Nest API runs inside workerd with native D1/KV',
  { timeout: 180000 },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'rebirth-worker-'));
    let worker;
    t.after(async () => {
      if (worker && worker.exitCode === null) {
        const exited = once(worker, 'exit');
        worker.kill('SIGTERM');
        await exited;
      }
      await rm(directory, { recursive: true, force: true });
    });
    const config = JSON.parse(
      (await readFile('wrangler.jsonc', 'utf8'))
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/,\s*([}\]])/g, '$1'),
    );
    assert.equal(config.main, 'dist/worker/main.js');
    config.main = resolve('test/worker-fixture.mjs');
    delete config.build;
    assert.ok(
      config.send_email.every((binding) => binding.remote !== true),
      'tests must never send real mail',
    );
    config.assets.directory = resolve(config.assets.directory);
    config.alias = Object.fromEntries(
      Object.entries(config.alias).map(([key, value]) => [key, resolve(value)]),
    );
    await writeFile(
      join(directory, '.dev.vars'),
      `JWT_ACCESS_SECRET=test-only-secret-at-least-thirty-two-bytes\n`,
    );
    const configFile = join(directory, 'wrangler.json');
    await writeFile(configFile, JSON.stringify(config));
    const wrangler = resolve('node_modules/.bin/wrangler');
    const persist = join(directory, 'state');
    function sql(command) {
      const output = execFileSync(
        wrangler,
        [
          'd1',
          'execute',
          'DB',
          '--config',
          configFile,
          '--local',
          '--persist-to',
          persist,
          '--command',
          command,
          '--json',
        ],
        { encoding: 'utf8' },
      );
      return JSON.parse(output)[0].results;
    }
    for (const migration of (await readdir('drizzle')).sort()) {
      execFileSync(
        wrangler,
        [
          'd1',
          'execute',
          'DB',
          '--config',
          configFile,
          '--local',
          '--persist-to',
          persist,
          '--file',
          resolve('drizzle', migration, 'migration.sql'),
        ],
        { stdio: 'pipe' },
      );
    }
    // Existing native-Argon2 hashes, including Unicode, must survive the migration.
    const password = '  🔐pässword漢字\u0000a long password  ';
    const existingHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    sql(
      `INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES ('existing', 'existing@example.com', '${existingHash}', 1, 1)`,
    );
    const socket = createServer().listen(0, '127.0.0.1');
    await once(socket, 'listening');
    const port = socket.address().port;
    await new Promise((done) => socket.close(done));
    worker = spawn(
      wrangler,
      [
        'dev',
        '--config',
        configFile,
        '--local',
        '--port',
        String(port),
        '--persist-to',
        persist,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let output = '';
    worker.stdout.on('data', (chunk) => {
      output += chunk;
    });
    worker.stderr.on('data', (chunk) => {
      output += chunk;
      if (process.env.WORKER_TEST_DEBUG) process.stderr.write(chunk);
    });
    const origin = `http://127.0.0.1:${port}`;
    let ready = false;
    let startupFailures = 0;
    for (let i = 0; i < 20; i++) {
      try {
        const response = await fetch(`${origin}/openapi.json`, {
          signal: AbortSignal.timeout(2000),
        });
        if (response.status === 503) {
          startupFailures++;
          assert.deepEqual(await response.json(), {
            statusCode: 503,
            message: 'API unavailable',
          });
        }
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {}
      if (worker.exitCode !== null) break;
      await setTimeout(250);
    }
    assert.ok(ready, output.slice(-12000));
    assert.equal(
      startupFailures,
      1,
      'failed initialization must recover on the next request',
    );
    assert.ok(!output.includes('private-startup-fixture-error'));
    const post = (route, body, ip = '192.0.2.1') =>
      fetch(`${origin}/auth/${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
    await t.test(
      'auth routes and docs exist; old proxy routes are absent',
      async () => {
        for (const route of ['register', 'login', 'refresh']) {
          const response = await post(route, {});
          assert.equal(response.status, 400, await response.text());
          assert.equal(response.headers.get('cache-control'), 'no-store');
        }
        assert.equal((await fetch(`${origin}/auth/register`)).status, 404); // POST only
        assert.equal(
          (await fetch(`${origin}/query`, { method: 'POST' })).status,
          404,
        );
        assert.equal(
          (await fetch(`${origin}/cache`, { method: 'POST' })).status,
          404,
        );
        assert.match(await (await fetch(`${origin}/docs/`)).text(), /scalar/i);
        const asset = await fetch(`${origin}/docs/js/scalar.js`);
        assert.equal(asset.status, 200);
        assert.match(asset.headers.get('content-type'), /javascript/);
        assert.equal(
          await asset.text(),
          await readFile('dist/assets/docs/js/scalar.js', 'utf8'),
        );
        assert.equal((await fetch(`${origin}/openapi.yaml`)).status, 200);
      },
    );
    await t.test(
      'native KV and React Email rendering work without proxy or network delivery',
      async () => {
        const cache = await fetch(`${origin}/__test/kv`);
        assert.equal(cache.status, 200);
        assert.deepEqual(await cache.json(), {
          value: { count: 7 },
          wrapped: { count: 7 },
          expiring: true,
          missing: true,
        });
        const email = await fetch(`${origin}/__test/render-email`);
        assert.equal(email.status, 200);
        const content = await email.json();
        assert.match(content.html, /&lt;Adventurer&gt;/);
        assert.match(content.text, /Adventurer/);
        const sent = await fetch(`${origin}/__test/send-email`);
        assert.equal(sent.status, 200);
        const result = await sent.json();
        assert.equal(result.status, 'accepted');
        assert.ok(result.messageId);
        assert.deepEqual(Object.keys(result).sort(), ['messageId', 'status']);
      },
    );
    await t.test(
      'login verifies existing native Argon2 hashes including Unicode and NUL',
      async () => {
        const response = await post('login', {
          email: 'existing@example.com',
          password,
        });
        assert.equal(response.status, 200, await response.text());
        assert.equal(
          (
            await post('login', {
              email: 'existing@example.com',
              password: password + 'x',
            })
          ).status,
          401,
        );
      },
    );
    let registered;
    await t.test(
      'registration stores compatible hashes and returns tokens',
      async () => {
        const response = await post('register', {
          email: ' Player@Example.com ',
          password,
        });
        assert.equal(response.status, 201);
        registered = await response.json();
        assert.equal(registered.user.email, 'player@example.com');
        assert.equal(registered.refreshToken.length, 43);
        assert.equal(registered.expiresIn, 900);
        assert.equal(registered.tokenType, 'Bearer');
        assert.deepEqual(Object.keys(registered.user).sort(), [
          'createdAt',
          'email',
          'id',
          'updatedAt',
        ]);
        const [session] = sql(
          `SELECT refresh_token_hash FROM auth_sessions WHERE user_id = '${registered.user.id}'`,
        );
        assert.match(session.refresh_token_hash, /^[a-f0-9]{64}$/);
        assert.notEqual(session.refresh_token_hash, registered.refreshToken);
        const [stored] = sql(
          "SELECT password_hash FROM users WHERE email = 'player@example.com'",
        );
        assert.ok(await argon2.verify(stored.password_hash, password));
        assert.equal(
          (await post('register', { email: 'player@example.com', password }))
            .status,
          409,
        );
      },
    );
    await t.test(
      'concurrent refresh has one winner and login invalidates its refresh',
      async () => {
        const responses = await Promise.all(
          [1, 2].map(() =>
            post('refresh', { refreshToken: registered.refreshToken }),
          ),
        );
        assert.deepEqual(
          responses.map((r) => r.status).sort((a, b) => a - b),
          [200, 401],
        );
        const rotated = await responses.find((r) => r.status === 200).json();
        const login = await post('login', {
          email: 'player@example.com',
          password,
        });
        assert.equal(login.status, 200);
        assert.equal(
          (await post('refresh', { refreshToken: rotated.refreshToken }))
            .status,
          401,
        );
      },
    );
    await t.test(
      'registration races preserve uniqueness and failed batches roll back',
      async () => {
        const responses = await Promise.all(
          [1, 2].map(() =>
            post(
              'register',
              { email: 'race@example.com', password },
              '192.0.2.4',
            ),
          ),
        );
        assert.deepEqual(
          responses.map((response) => response.status).sort((a, b) => a - b),
          [201, 409],
        );
        sql(
          "CREATE TRIGGER fail_session BEFORE INSERT ON auth_sessions BEGIN SELECT RAISE(ABORT, 'test-only-failure'); END",
        );
        const response = await post(
          'register',
          { email: 'rollback@example.com', password },
          '192.0.2.5',
        );
        assert.equal(response.status, 503);
        assert.equal(
          (await response.json()).message,
          'Authentication storage unavailable',
        );
        assert.deepEqual(
          sql("SELECT id FROM users WHERE email = 'rollback@example.com'"),
          [],
        );
        sql('DROP TRIGGER fail_session');
      },
    );
    await t.test(
      'native rate limits separate routes and clients without leaking errors',
      async () => {
        let limited;
        for (let i = 0; i < 100; i++) {
          const response = await post('login', {}, '192.0.2.8');
          if (response.status === 429) {
            limited = response;
            break;
          }
          assert.equal(response.status, 400);
        }
        assert.ok(limited, 'local limiter should eventually reject a burst');
        assert.equal(limited.headers.get('retry-after'), '60');
        assert.equal(limited.headers.get('cache-control'), 'no-store');
        assert.equal(limited.headers.get('x-ratelimit-remaining'), null);
        assert.equal((await post('register', {}, '192.0.2.8')).status, 400);
        assert.equal((await post('login', {}, '192.0.2.9')).status, 400);
        assert.ok(!output.includes(password));
        assert.ok(!output.includes(existingHash));
        assert.ok(!output.includes(registered.accessToken));
        assert.ok(!output.includes(registered.refreshToken));
      },
    );
    const access = (token) =>
      fetch(`${origin}/__test/protected`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
    await t.test(
      'generic login errors, session replacement, JWT claims, and absolute expiry',
      async () => {
        const login = async (body) => post('login', body, '192.0.2.30');
        const wrong = await login({
          email: 'player@example.com',
          password: 'another long password',
        });
        const unknown = await login({ email: 'unknown@example.com', password });
        assert.equal(wrong.status, 401);
        assert.equal(unknown.status, 401);
        assert.deepEqual(await wrong.json(), await unknown.json());
        const first = await (
          await login({ email: 'player@example.com', password })
        ).json();
        assert.equal((await access(first.accessToken)).status, 200);
        const second = await (
          await login({ email: 'player@example.com', password })
        ).json();
        assert.equal((await access(first.accessToken)).status, 401);
        assert.equal(
          (
            await post(
              'refresh',
              { refreshToken: first.refreshToken },
              '192.0.2.31',
            )
          ).status,
          401,
        );
        assert.equal((await access(second.accessToken)).status, 200);
        assert.equal((await access()).status, 401);
        assert.equal((await access('not-a-jwt')).status, 401);
        const jwt = new JwtService();
        const payload = jwt.decode(second.accessToken);
        for (const overrides of [
          { exp: 1 },
          { aud: 'wrong' },
          { iss: 'wrong' },
          { sid: randomUUID() },
          { sub: null },
        ]) {
          const token = jwt.sign(
            { ...payload, ...overrides },
            {
              secret: 'test-only-secret-at-least-thirty-two-bytes',
              algorithm: 'HS256',
            },
          );
          assert.equal((await access(token)).status, 401);
        }
        assert.equal(
          (await access(jwt.sign(payload, { secret: 'wrong-secret' }))).status,
          401,
        );
        assert.equal(
          (
            await access(
              jwt.sign(payload, {
                secret: 'test-only-secret-at-least-thirty-two-bytes',
                noTimestamp: true,
              }),
            )
          ).status,
          401,
        );
        const expiry = Date.now() + 60000;
        sql(
          `UPDATE auth_sessions SET expires_at = ${expiry} WHERE user_id = '${second.user.id}'`,
        );
        const refreshed = await post(
          'refresh',
          { refreshToken: second.refreshToken },
          '192.0.2.31',
        );
        assert.equal(refreshed.status, 200);
        const rotated = await refreshed.json();
        assert.ok(rotated.expiresIn > 0 && rotated.expiresIn <= 60);
        assert.equal(
          rotated.refreshTokenExpiresAt,
          new Date(expiry).toISOString(),
        );
        assert.equal((await access(second.accessToken)).status, 200);
        assert.equal((await access(rotated.accessToken)).status, 200);
        assert.equal(
          (
            await post(
              'refresh',
              { refreshToken: second.refreshToken },
              '192.0.2.31',
            )
          ).status,
          401,
        );
        // Replaying the old refresh must not revoke its successful replacement.
        const next = await post(
          'refresh',
          { refreshToken: rotated.refreshToken },
          '192.0.2.31',
        );
        assert.equal(next.status, 200);
        const final = await next.json();
        assert.equal(
          final.refreshTokenExpiresAt,
          rotated.refreshTokenExpiresAt,
        );
        sql(
          `UPDATE auth_sessions SET expires_at = 1 WHERE user_id = '${second.user.id}'`,
        );
        assert.equal((await access(final.accessToken)).status, 401);
        assert.equal(
          (
            await post(
              'refresh',
              { refreshToken: final.refreshToken },
              '192.0.2.31',
            )
          ).status,
          401,
        );
        sql('ALTER TABLE auth_sessions RENAME TO unavailable_sessions');
        try {
          assert.equal((await access(final.accessToken)).status, 503);
        } finally {
          sql('ALTER TABLE unavailable_sessions RENAME TO auth_sessions');
        }
      },
    );
    await t.test(
      'invalid startup configuration fails closed with a sanitized response',
      async () => {
        const exited = once(worker, 'exit');
        worker.kill('SIGTERM');
        await exited;
        config.vars.EMAIL_FROM = 'invalid-email';
        await writeFile(configFile, JSON.stringify(config));
        worker = spawn(
          wrangler,
          [
            'dev',
            '--config',
            configFile,
            '--local',
            '--port',
            String(port),
            '--persist-to',
            persist,
          ],
          { stdio: ['ignore', 'pipe', 'pipe'] },
        );
        output = '';
        worker.stdout.on('data', (chunk) => {
          output += chunk;
        });
        worker.stderr.on('data', (chunk) => {
          output += chunk;
        });
        let response;
        for (let i = 0; i < 40; i++) {
          try {
            response = await fetch(`${origin}/openapi.json`, {
              signal: AbortSignal.timeout(2000),
            });
            break;
          } catch {}
          if (worker.exitCode !== null) break;
          await setTimeout(100);
        }
        assert.ok(response, output);
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), {
          statusCode: 503,
          message: 'API unavailable',
        });
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.ok(
          !output.includes('test-only-secret-at-least-thirty-two-bytes'),
        );
        assert.equal(
          (await fetch(`${origin}/docs/js/scalar.js`)).status,
          200,
          'assets do not require Nest startup',
        );
      },
    );
    await t.test(
      'production entrypoint exposes no fixture routes',
      async () => {
        const exited = once(worker, 'exit');
        worker.kill('SIGTERM');
        await exited;
        config.main = resolve('dist/worker/main.js');
        config.vars.EMAIL_FROM = 'noreply@rebirthdungeon.com';
        await writeFile(configFile, JSON.stringify(config));
        worker = spawn(
          wrangler,
          [
            'dev',
            '--config',
            configFile,
            '--local',
            '--port',
            String(port),
            '--persist-to',
            persist,
          ],
          { stdio: ['ignore', 'pipe', 'pipe'] },
        );
        output = '';
        worker.stdout.on('data', (chunk) => {
          output += chunk;
        });
        worker.stderr.on('data', (chunk) => {
          output += chunk;
        });
        let response;
        for (let i = 0; i < 40; i++) {
          try {
            response = await fetch(`${origin}/openapi.json`, {
              signal: AbortSignal.timeout(2000),
            });
            if (response.ok) break;
          } catch {}
          if (worker.exitCode !== null) break;
          await setTimeout(100);
        }
        assert.equal(response?.status, 200, output.slice(-12000));
        const document = await response.json();
        assert.deepEqual(Object.keys(document.paths).sort(), [
          '/auth/login',
          '/auth/refresh',
          '/auth/register',
        ]);
        // Missing routes may be rejected by the global auth guard before Nest's 404 handler.
        // Check with a valid session so authorization cannot conceal an exposed test endpoint.
        const login = await post(
          'login',
          { email: 'existing@example.com', password },
          '192.0.2.99',
        );
        assert.equal(login.status, 200);
        const { accessToken } = await login.json();
        for (const path of [
          '/__test/send-email',
          '/__test/render-email',
          '/__test/kv',
          '/__test/protected',
          '/query',
          '/cache',
        ]) {
          assert.equal(
            (
              await fetch(`${origin}${path}`, {
                headers: { authorization: `Bearer ${accessToken}` },
              })
            ).status,
            404,
          );
        }
        assert.equal((await post('register', {}, '192.0.2.100')).status, 400);
      },
    );
  },
);
