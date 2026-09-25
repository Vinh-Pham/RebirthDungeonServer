import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPlatformProxy } from 'wrangler';
import { migrateLocal } from '../tools/migrate-local.mjs';

test('local migrations are idempotent and preserve accounts and history', async (t) => {
  const proxy = await getPlatformProxy({
    configPath: 'wrangler.jsonc',
    remoteBindings: false,
    persist: false,
  });
  t.after(() => proxy.dispose());
  const db = proxy.env.DB;
  await migrateLocal(db);
  const history = await db.prepare('SELECT * FROM __drizzle_migrations').all();
  assert.equal(history.results.length, 1);
  await db
    .prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)')
    .bind('preserved', 'preserved@example.invalid', 'test-hash', 123, 456)
    .run();
  const user = await db.prepare('SELECT * FROM users').first();
  await migrateLocal(db);
  assert.deepEqual(
    (await db.prepare('SELECT * FROM __drizzle_migrations').all()).results,
    history.results,
  );
  assert.deepEqual(await db.prepare('SELECT * FROM users').first(), user);
});

test('baselining requires explicit opt-in and exact schema, and preserves account data', async (t) => {
  const proxy = await getPlatformProxy({
    configPath: 'wrangler.jsonc',
    remoteBindings: false,
    persist: false,
  });
  t.after(() => proxy.dispose());
  const db = proxy.env.DB;
  await migrateLocal(db);
  await db
    .prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)')
    .bind('preserved', 'preserved@example.invalid', 'test-hash', 123, 456)
    .run();
  const user = await db.prepare('SELECT * FROM users').first();
  await db.prepare('DELETE FROM __drizzle_migrations').run();
  await assert.rejects(() => migrateLocal(db), /no migration history/);
  await migrateLocal(db, true);
  assert.deepEqual(await db.prepare('SELECT * FROM users').first(), user);
  assert.equal(
    await db
      .prepare('SELECT COUNT(*) AS count FROM __drizzle_migrations')
      .first('count'),
    1,
  );
  await db.prepare('DELETE FROM __drizzle_migrations').run();
  await db.prepare('ALTER TABLE users ADD COLUMN extra TEXT').run();
  await assert.rejects(
    () => migrateLocal(db, true),
    /differs from the original migration/,
  );
  assert.equal(
    await db
      .prepare('SELECT COUNT(*) AS count FROM __drizzle_migrations')
      .first('count'),
    0,
  );
  assert.equal(
    await db.prepare('SELECT id FROM users').first('id'),
    'preserved',
  );
});
