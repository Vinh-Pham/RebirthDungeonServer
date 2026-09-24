import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, eq, gt } from 'drizzle-orm';
import type { D1Database } from '../db/d1-proxy.js';
import { D1ProxyError } from '../db/d1-proxy.js';
import { authSessions, users } from '../db/schema.js';

export type User = typeof users.$inferSelect;
export type Session = typeof authSessions.$inferSelect;

@Injectable()
export class AuthRepository {
  constructor(@InjectDrizzle() private readonly db: D1Database) {}

  private async query<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      let cause: unknown = error;
      for (let i = 0; i < 8 && cause instanceof Error; i++) {
        if (cause instanceof D1ProxyError && cause.code === 'EMAIL_EXISTS') {
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
      async () =>
        (await this.db.select().from(users).where(eq(users.email, email)))[0],
    );
  }

  register(user: User, session: Session) {
    return this.query(() =>
      this.db.batch([
        this.db.insert(users).values(user),
        this.db.insert(authSessions).values(session),
      ]),
    );
  }

  replaceSession(session: Session) {
    return this.query(() =>
      this.db
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
      async () =>
        (
          await this.db
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
    return this.query(() =>
      this.db
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
      async () =>
        (
          await this.db
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
