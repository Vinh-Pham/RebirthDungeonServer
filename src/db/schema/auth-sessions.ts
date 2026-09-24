import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { users } from './users.js';

export const authSessions = sqliteTable('auth_sessions', {
  userId: text('user_id')
    .primaryKey()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull().unique(),
  refreshTokenHash: text('refresh_token_hash').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
