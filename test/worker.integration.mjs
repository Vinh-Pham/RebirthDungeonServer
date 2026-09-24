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
    config.alias = Object.fromEntries(
      Object.entries(config.alias).map(([key, value]) => [key, resolve(value)]),
    );
    await writeFile(
      join(directory, '.dev.vars'),
      `JWT_ACCESS_SECRET=test-only-secret-at-least-thirty-two-bytes\nCLOUDFLARE_ACCOUNT_ID=${'a'.repeat(32)}\nCLOUDFLARE_EMAIL_API_TOKEN=test-only-no-email-sending\n`,
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
    for (let i = 0; i < 20; i++) {
      try {
        const response = await fetch(`${origin}/openapi.json`, {
          signal: AbortSignal.timeout(2000),
        });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {}
      if (worker.exitCode !== null) break;
      await setTimeout(250);
    }
    assert.ok(ready, output);
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
        assert.equal((await fetch(`${origin}/docs/js/scalar.js`)).status, 200);
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
          deleted: true,
          missing: true,
        });
        const email = await fetch(`${origin}/__test/render-email`);
        assert.equal(email.status, 200);
        const content = await email.json();
        assert.match(content.html, /&lt;Adventurer&gt;/);
        assert.match(content.text, /Adventurer/);
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
      'Cloudflare client IPs have separate rate limits and errors stay private',
      async () => {
        for (let i = 0; i < 10; i++)
          assert.equal((await post('login', {}, '192.0.2.8')).status, 400);
        const response = await post('login', {}, '192.0.2.8');
        assert.equal(response.status, 429);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal((await post('login', {}, '192.0.2.9')).status, 400);
        assert.ok(!output.includes(password));
        assert.ok(!output.includes(existingHash));
        assert.ok(!output.includes(registered.accessToken));
        assert.ok(!output.includes(registered.refreshToken));
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
        assert.ok(!output.includes('test-only-no-email-sending'));
      },
    );
  },
);
