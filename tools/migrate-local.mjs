import { getPlatformProxy } from 'wrangler';
import { drizzle } from 'drizzle-orm/d1';
import { migrate } from 'drizzle-orm/d1/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { pathToFileURL } from 'node:url';

function normalizeSql(sql) {
  return sql.trim().replace(/;$/, '').replace(/\s+/g, ' ');
}

async function baselineExistingTables(db, allowBaseline) {
  const { results: tables } = await db
    .prepare(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name IN ('users', 'auth_sessions', '__drizzle_migrations')",
    )
    .all();
  const hasHistory = tables.some(
    (table) => table.name === '__drizzle_migrations',
  );
  if (
    hasHistory &&
    (await db
      .prepare('SELECT COUNT(*) AS count FROM __drizzle_migrations')
      .first('count')) > 0
  )
    return;
  const existing = tables.filter(
    (table) => table.name !== '__drizzle_migrations',
  );
  if (!existing.length) return;
  if (!allowBaseline) {
    throw new Error(
      'Existing local tables have no migration history. Run pnpm db:baseline:local to verify and record the original migration without changing account data.',
    );
  }
  const [baseline] = readMigrationFiles({ migrationsFolder: 'drizzle' });
  const expectedSql = baseline.sql.map(normalizeSql);
  if (
    existing.length !== expectedSql.length ||
    !existing.every((table) => expectedSql.includes(normalizeSql(table.sql)))
  ) {
    throw new Error(
      'Local schema differs from the original migration; refusing to baseline it.',
    );
  }
  await db.batch([
    db.prepare(
      'CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY, hash text NOT NULL, created_at numeric, name text, applied_at TEXT)',
    ),
    db
      .prepare(
        'INSERT INTO __drizzle_migrations (hash, created_at, name, applied_at) VALUES (?, ?, ?, ?)',
      )
      .bind(
        baseline.hash,
        baseline.folderMillis,
        baseline.name,
        new Date().toISOString(),
      ),
  ]);
  console.log(
    'Verified the existing local schema and recorded its baseline. Account data was not modified.',
  );
}

export async function migrateLocal(db, allowBaseline = false) {
  await baselineExistingTables(db, allowBaseline);
  await migrate(drizzle(db), { migrationsFolder: 'drizzle' });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const proxy = await getPlatformProxy({
    configPath: 'wrangler.jsonc',
    remoteBindings: false,
    persist: process.env.LOCAL_D1_STATE
      ? { path: process.env.LOCAL_D1_STATE }
      : true,
  });
  try {
    await migrateLocal(proxy.env.DB, process.argv.includes('--baseline'));
    console.log('Local D1 migrations applied using __drizzle_migrations.');
  } finally {
    await proxy.dispose();
  }
}
