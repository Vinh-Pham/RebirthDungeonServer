import {
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import {
  PRIMARY_DATABASE,
  type PrimaryDatabaseFactory,
} from '../db/primary-database.js';
import { authSessions, users } from '../db/schema.js';

export type User = typeof users.$inferSelect;
export type Session = typeof authSessions.$inferSelect;

@Injectable()
export class AuthRepository {
  constructor(
    @Inject(PRIMARY_DATABASE) private readonly database: PrimaryDatabaseFactory,
  ) {}

  private async query<T>(
    operation: (db: DrizzleD1Database) => Promise<T>,
  ): Promise<T> {
    try {
      return await operation(this.database());
    } catch (error) {
      let cause: unknown = error;
      for (let i = 0; i < 8 && cause instanceof Error; i++) {
        if (
          /UNIQUE constraint failed: users\.email(?:\b|$)/.test(cause.message)
        ) {
          throw new ConflictException('Email already registered');
        }
        cause = cause.cause;
      }
      throw new ServiceUnavailableException(
        'Authentication storage unavailable',
      );
    }
  }

  findUser(email: string) {
    return this.query(
      async (db) =>
        (await db.select().from(users).where(eq(users.email, email)))[0],
    );
  }

  register(user: User, session: Session) {
    return this.query((db) =>
      db.batch([
        db.insert(users).values(user),
        db.insert(authSessions).values(session),
      ]),
    );
  }

  replaceSession(session: Session) {
    return this.query((db) =>
      db
        .insert(authSessions)
        .values(session)
        .onConflictDoUpdate({
          target: authSessions.userId,
          set: session,
        })
        .run(),
    );
  }

  findRefresh(hash: string) {
    return this.query(
      async (db) =>
        (
          await db
            .select({ user: users, session: authSessions })
            .from(authSessions)
            .innerJoin(users, eq(users.id, authSessions.userId))
            .where(
              and(
                eq(authSessions.refreshTokenHash, hash),
                gt(authSessions.expiresAt, new Date()),
              ),
            )
        )[0],
    );
  }

  rotate(oldHash: string, newHash: string) {
    return this.query((db) =>
      db
        .update(authSessions)
        .set({ refreshTokenHash: newHash, updatedAt: new Date() })
        .where(
          and(
            eq(authSessions.refreshTokenHash, oldHash),
            gt(authSessions.expiresAt, new Date()),
          ),
        )
        .returning({ userId: authSessions.userId }),
    );
  }

  activeSession(userId: string, sessionId: string) {
    return this.query(
      async (db) =>
        (
          await db
            .select({ userId: authSessions.userId })
            .from(authSessions)
            .where(
              and(
                eq(authSessions.userId, userId),
                eq(authSessions.sessionId, sessionId),
                gt(authSessions.expiresAt, new Date()),
              ),
            )
        )[0],
    );
  }
}
