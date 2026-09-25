import { and, eq, gt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { HTTPException } from 'hono/http-exception';
import { authSessions, users } from './schema.js';

export type User = typeof users.$inferSelect;
export type Session = typeof authSessions.$inferSelect;

async function query<T>(
  operation: () => Promise<T>,
  registration = false,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    let cause: unknown = error;
    while (cause instanceof Error) {
      if (
        registration &&
        /UNIQUE constraint failed: users\.email\b/.test(cause.message)
      ) {
        throw new HTTPException(409, { message: 'Email already registered' });
      }
      cause = cause.cause;
    }
    throw new HTTPException(503, {
      message: 'Authentication storage unavailable',
    });
  }
}

export function createRepository(binding: D1Database) {
  // Direct bindings query the primary. Do not cache auth reads or use read replicas.
  const db = drizzle(binding);
  return {
    findUser(email: string) {
      return query(
        async () =>
          (await db.select().from(users).where(eq(users.email, email)))[0],
      );
    },
    register(user: User, session: Session) {
      return query(
        () =>
          db.batch([
            db.insert(users).values(user),
            db.insert(authSessions).values(session),
          ]),
        true,
      );
    },
    replaceSession(session: Session) {
      return query(() =>
        db
          .insert(authSessions)
          .values(session)
          .onConflictDoUpdate({ target: authSessions.userId, set: session })
          .run(),
      );
    },
    findRefresh(hash: string) {
      return query(
        async () =>
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
    },
    rotate(session: Session, oldHash: string, newHash: string) {
      return query(() =>
        db
          .update(authSessions)
          .set({ refreshTokenHash: newHash, updatedAt: new Date() })
          .where(
            and(
              eq(authSessions.userId, session.userId),
              eq(authSessions.sessionId, session.sessionId),
              eq(authSessions.refreshTokenHash, oldHash),
              gt(authSessions.expiresAt, new Date()),
            ),
          )
          .returning({ userId: authSessions.userId }),
      );
    },
    activeUser(userId: string, sessionId: string) {
      return query(
        async () =>
          (
            await db
              .select({ user: users })
              .from(authSessions)
              .innerJoin(users, eq(users.id, authSessions.userId))
              .where(
                and(
                  eq(authSessions.userId, userId),
                  eq(authSessions.sessionId, sessionId),
                  gt(authSessions.expiresAt, new Date()),
                ),
              )
          )[0]?.user,
      );
    },
    deleteSession(userId: string, sessionId: string) {
      return query(() =>
        db
          .delete(authSessions)
          .where(
            and(
              eq(authSessions.userId, userId),
              eq(authSessions.sessionId, sessionId),
            ),
          )
          .run(),
      );
    },
  };
}
