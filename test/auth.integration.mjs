import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { Controller, Get } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/configure-app.js';
import { AuthRepository } from '../dist/auth/auth.repository.js';
import { authConfig } from '../dist/auth/auth.config.js';

class ProtectedController {
  get() {
    return { ok: true };
  }
}
Controller('protected-test')(ProtectedController);
Get()(
  ProtectedController.prototype,
  'get',
  Object.getOwnPropertyDescriptor(ProtectedController.prototype, 'get'),
);

// Use compiled Nest code so DTO decorator metadata matches production.
await test(
  'Fastify authentication with an isolated local D1 database',
  { timeout: 120000 },
  async (t) => {
    const persistence = await mkdtemp(join(tmpdir(), 'rebirth-auth-'));
    const wrangler = join(process.cwd(), 'node_modules/.bin/wrangler');
    const server = createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;
    await new Promise((resolve) => server.close(resolve));
    const origin = `http://127.0.0.1:${port}`;
    const token = 'local-integration-test-only';
    process.env.D1_PROXY_URL = `${origin}/query`;
    process.env.KV_PROXY_URL = `${origin}/cache`;
    process.env.D1_PROXY_TOKEN = token;
    process.env.JWT_ACCESS_SECRET =
      'local-integration-secret-with-more-than-32-bytes';
    let worker;
    let app;
    let workerOutput = '';
    t.after(async () => {
      if (app) await app.close();
      if (worker && worker.exitCode === null) {
        const exited = once(worker, 'exit');
        worker.kill('SIGTERM');
        await exited;
      }
      await rm(persistence, { recursive: true, force: true });
    });
    const migrations = (await readdir('drizzle')).sort();
    for (const migration of migrations) {
      execFileSync(
        wrangler,
        [
          'd1',
          'execute',
          'DB',
          '--local',
          '--persist-to',
          persistence,
          '--file',
          `drizzle/${migration}/migration.sql`,
        ],
        { stdio: 'pipe' },
      );
    }
    worker = spawn(
      wrangler,
      [
        'dev',
        '--local',
        '--port',
        String(port),
        '--persist-to',
        persistence,
        '--var',
        `D1_PROXY_TOKEN:${token}`,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    worker.stdout.on('data', (chunk) => {
      workerOutput += chunk;
    });
    worker.stderr.on('data', (chunk) => {
      workerOutput += chunk;
    });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(`${origin}/query`)).status === 405) {
          ready = true;
          break;
        }
      } catch {}
      if (worker.exitCode !== null) break;
      await setTimeout(100);
    }
    assert.ok(ready, workerOutput);
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProtectedController],
    }).compile();
    app = fixture.createNestApplication(new FastifyAdapter(), {
      logger: false,
    });
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    const repository = app.get(AuthRepository);
    let client = 1;
    const post = (path, payload, remoteAddress = `127.0.0.${client++}`) =>
      app.inject({
        method: 'POST',
        url: `/auth/${path}`,
        payload,
        remoteAddress,
      });
    const access = (token) =>
      app.inject({
        method: 'GET',
        url: '/protected-test',
        headers: { authorization: `Bearer ${token}` },
      });
    const sql = async (sql, params = []) => {
      const result = await fetch(`${origin}/query`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ sql, params }),
      });
      assert.equal(result.status, 200);
      return (await result.json()).results[0].rows;
    };
    const credentials = {
      email: ' Player@Example.com ',
      password: 'a long secure password',
    };
    let registered;
    let loggedIn;
    let rotated;

    await t.test(
      'validates inputs and registers with sanitized user, hashed credentials, and no-store',
      async () => {
        for (const payload of [
          {},
          { ...credentials, extra: true },
          { ...credentials, password: 'short' },
          { ...credentials, email: 'invalid' },
        ]) {
          const response = await post('register', payload);
          assert.equal(response.statusCode, 400, response.body);
          assert.equal(response.headers['cache-control'], 'no-store');
        }
        const response = await post('register', credentials);
        assert.equal(response.statusCode, 201, response.body);
        assert.equal(response.headers['cache-control'], 'no-store');
        registered = response.json();
        assert.equal(registered.user.email, 'player@example.com');
        assert.equal(registered.expiresIn, 900);
        assert.equal(registered.refreshToken.length, 43);
        assert.equal(registered.tokenType, 'Bearer');
        assert.deepEqual(Object.keys(registered.user).sort(), [
          'createdAt',
          'email',
          'id',
          'updatedAt',
        ]);
        assert.equal((await access(registered.accessToken)).statusCode, 200);
        const [[passwordHash, refreshHash]] = await sql(
          'SELECT password_hash, refresh_token_hash FROM users JOIN auth_sessions ON users.id = auth_sessions.user_id',
        );
        assert.match(passwordHash, /^\$argon2id\$v=19\$/);
        assert.deepEqual(passwordHash.split('$')[3].split(',').sort(), [
          'm=19456',
          'p=1',
          't=2',
        ]);
        assert.match(refreshHash, /^[a-f0-9]{64}$/);
        assert.notEqual(refreshHash, registered.refreshToken);
      },
    );
    await t.test(
      'rejects normalized duplicates and concurrent registration creates one account',
      async () => {
        assert.equal((await post('register', credentials)).statusCode, 409);
        const responses = await Promise.all(
          [1, 2].map(() =>
            post('register', { ...credentials, email: 'race@example.com' }),
          ),
        );
        assert.deepEqual(responses.map((r) => r.statusCode).sort(), [201, 409]);
        assert.equal(
          (
            await sql(
              "SELECT count(*) FROM users WHERE email = 'race@example.com'",
            )
          )[0][0],
          1,
        );
      },
    );
    await t.test(
      'registration batch rolls back when the session insert fails',
      async () => {
        const now = new Date();
        const id = randomUUID();
        await assert.rejects(
          repository.register(
            {
              id,
              email: 'rollback@example.com',
              passwordHash: 'test',
              createdAt: now,
              updatedAt: now,
            },
            {
              userId: registered.user.id,
              sessionId: randomUUID(),
              refreshTokenHash: randomUUID(),
              expiresAt: now,
              createdAt: now,
              updatedAt: now,
            },
          ),
          /storage unavailable/,
        );
        assert.equal(
          await repository.findUser('rollback@example.com'),
          undefined,
        );
      },
    );
    await t.test(
      'wrong credentials are generic and login invalidates both previous tokens',
      async () => {
        const wrong = await post('login', {
          ...credentials,
          password: 'a different password',
        });
        const unknown = await post('login', {
          ...credentials,
          email: 'unknown@example.com',
        });
        assert.equal(wrong.statusCode, 401);
        assert.deepEqual(wrong.json(), unknown.json());
        const response = await post('login', credentials);
        assert.equal(response.statusCode, 200, response.body);
        loggedIn = response.json();
        assert.equal((await access(registered.accessToken)).statusCode, 401);
        assert.equal(
          (await post('refresh', { refreshToken: registered.refreshToken }))
            .statusCode,
          401,
        );
        assert.equal((await access(loggedIn.accessToken)).statusCode, 200);
      },
    );
    await t.test(
      'concurrent refresh has one winner, preserves expiry, and rejects replay',
      async () => {
        const responses = await Promise.all(
          [1, 2].map(() =>
            post('refresh', { refreshToken: loggedIn.refreshToken }),
          ),
        );
        assert.deepEqual(responses.map((r) => r.statusCode).sort(), [200, 401]);
        rotated = responses.find((r) => r.statusCode === 200).json();
        assert.equal(
          rotated.refreshTokenExpiresAt,
          loggedIn.refreshTokenExpiresAt,
        );
        assert.equal(
          (await post('refresh', { refreshToken: loggedIn.refreshToken }))
            .statusCode,
          401,
        );
        assert.equal((await access(rotated.accessToken)).statusCode, 200);
        assert.equal((await access(loggedIn.accessToken)).statusCode, 200);
      },
    );
    await t.test(
      'guard rejects missing, forged, expired and incorrectly scoped access tokens',
      async () => {
        assert.equal(
          (await app.inject({ method: 'GET', url: '/protected-test' }))
            .statusCode,
          401,
        );
        assert.equal((await access('not-a-jwt')).statusCode, 401);
        const jwt = new JwtService();
        const config = authConfig();
        const payload = jwt.decode(rotated.accessToken);
        for (const overrides of [
          { exp: 1 },
          { aud: 'wrong' },
          { iss: 'wrong' },
          { sid: randomUUID() },
        ]) {
          const token = jwt.sign(
            { ...payload, ...overrides },
            { secret: config.secret, algorithm: 'HS256' },
          );
          assert.equal((await access(token)).statusCode, 401);
        }
        assert.equal(
          (await access(jwt.sign(payload, { secret: 'wrong-secret' })))
            .statusCode,
          401,
        );
      },
    );
    await t.test(
      'absolute session expiry caps access tokens and prevents refresh or access afterward',
      async () => {
        const expiry = Date.now() + 60000;
        await sql('UPDATE auth_sessions SET expires_at = ? WHERE user_id = ?', [
          expiry,
          registered.user.id,
        ]);
        const response = await post('refresh', {
          refreshToken: rotated.refreshToken,
        });
        assert.equal(response.statusCode, 200);
        rotated = response.json();
        assert.ok(rotated.expiresIn <= 60);
        assert.equal(
          rotated.refreshTokenExpiresAt,
          new Date(expiry).toISOString(),
        );
        await sql('UPDATE auth_sessions SET expires_at = ? WHERE user_id = ?', [
          Date.now() - 1000,
          registered.user.id,
        ]);
        assert.equal((await access(rotated.accessToken)).statusCode, 401);
        assert.equal(
          (await post('refresh', { refreshToken: rotated.refreshToken }))
            .statusCode,
          401,
        );
      },
    );
    await t.test(
      'IP rate limits apply and auth errors are not cacheable',
      async () => {
        for (let i = 0; i < 10; i++)
          assert.equal((await post('login', {}, '192.0.2.1')).statusCode, 400);
        const response = await post('login', {}, '192.0.2.1');
        assert.equal(response.statusCode, 429);
        assert.equal(response.headers['cache-control'], 'no-store');
        for (let i = 0; i < 30; i++)
          assert.equal(
            (await post('refresh', {}, '192.0.2.2')).statusCode,
            400,
          );
        assert.equal((await post('refresh', {}, '192.0.2.2')).statusCode, 429);
      },
    );
    await t.test('worker outages return a sanitized 503', async () => {
      const exited = once(worker, 'exit');
      worker.kill('SIGTERM');
      await exited;
      const response = await post('login', credentials);
      assert.equal(response.statusCode, 503, response.body);
      assert.equal(
        response.json().message,
        'Authentication storage unavailable',
      );
      assert.equal((await access(loggedIn.accessToken)).statusCode, 503);
    });
  },
);
