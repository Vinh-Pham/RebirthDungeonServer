import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';

export const PRIMARY_DATABASE = Symbol('PRIMARY_DATABASE');
export type PrimaryDatabaseFactory = () => DrizzleD1Database;

/** Call once per repository operation. Never share a session or bookmark. */
export function createPrimaryDatabaseFactory(
  binding: Pick<D1Database, 'withSession'>,
): PrimaryDatabaseFactory {
  return () => drizzle(binding.withSession('first-primary'));
}
