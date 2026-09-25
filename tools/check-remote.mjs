import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { readMigrationFiles } from 'drizzle-orm/migrator';

export async function checkRemote() {
  const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
  const {
    CLOUDFLARE_ACCOUNT_ID: account,
    CLOUDFLARE_DATABASE_ID: database,
    CLOUDFLARE_D1_TOKEN: token,
  } = process.env;
  if (!account || !database || !token)
    throw new Error(
      'Set the three CLOUDFLARE_* migration credentials in .env.',
    );
  if (database !== config.d1_databases[0].database_id)
    throw new Error('Migration database differs from the Worker DB binding.');
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql: 'SELECT name, hash, created_at FROM __drizzle_migrations ORDER BY created_at',
      }),
    },
  );
  const data = await response.json();
  if (!response.ok || !data.success || !data.result?.[0]?.success) {
    throw new Error(
      'Cannot verify the existing D1 migration history. No migrations were applied.',
    );
  }
  const local = readMigrationFiles({ migrationsFolder: 'drizzle' });
  const applied = data.result[0].results;
  if (!applied.length)
    throw new Error(
      'Expected the existing database migration history; refusing to initialize remote D1.',
    );
  for (const [index, row] of applied.entries()) {
    const expected = local[index];
    if (
      !expected ||
      row.name !== expected.name ||
      row.hash !== expected.hash ||
      Number(row.created_at) !== expected.folderMillis
    ) {
      throw new Error(
        'Remote migration history does not match the unchanged local migration prefix.',
      );
    }
  }
  const pending = local
    .slice(applied.length)
    .map((migration) => migration.name);
  console.log(
    JSON.stringify({
      database: config.d1_databases[0].database_name,
      applied: applied.length,
      pending,
    }),
  );
  return pending;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href)
  await checkRemote();
