import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';
import { readMigrationFiles } from 'drizzle-orm/migrator';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          JWT_ACCESS_SECRET: 'test-only-secret-at-least-thirty-two-bytes',
          TEST_MIGRATIONS: readMigrationFiles({
            migrationsFolder: 'drizzle',
          }).map((migration) => ({
            name: migration.name,
            queries: migration.sql,
          })),
        },
      },
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
