import { randomUUID } from 'node:crypto';
import { HTTPException } from 'hono/http-exception';
import { createRepository, type Session, type User } from '../db/repository.js';
import {
  hashPassword,
  verifyPassword,
  DUMMY_PASSWORD_HASH,
} from './password.js';
import {
  authResponse,
  hashRefreshToken,
  newRefreshToken,
  SESSION_TTL_MS,
} from './tokens.js';
import type { Credentials } from './schemas.js';

function newSession(userId: string) {
  const now = new Date();
  const refreshToken = newRefreshToken();
  const session: Session = {
    userId,
    sessionId: randomUUID(),
    refreshTokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    createdAt: now,
    updatedAt: now,
  };
  return { session, refreshToken };
}

export function createAuthService(env: CloudflareBindings) {
  const repository = createRepository(env.DB);
  return {
    async register(credentials: Credentials) {
      const now = new Date();
      const user: User = {
        id: randomUUID(),
        email: credentials.email,
        passwordHash: await hashPassword(credentials.password),
        createdAt: now,
        updatedAt: now,
      };
      const { session, refreshToken } = newSession(user.id);
      // Sign before mutation, but release credentials only after the atomic write succeeds.
      const response = await authResponse(
        user,
        session,
        refreshToken,
        env.JWT_ACCESS_SECRET,
      );
      await repository.register(user, session);
      return response;
    },
    async login(credentials: Credentials) {
      const user = await repository.findUser(credentials.email);
      const valid = await verifyPassword(
        user?.passwordHash ?? DUMMY_PASSWORD_HASH,
        credentials.password,
      );
      if (!user || !valid)
        throw new HTTPException(401, { message: 'Invalid credentials' });
      const { session, refreshToken } = newSession(user.id);
      const response = await authResponse(
        user,
        session,
        refreshToken,
        env.JWT_ACCESS_SECRET,
      );
      await repository.replaceSession(session);
      return response;
    },
    async refresh(refreshToken: string) {
      const oldHash = hashRefreshToken(refreshToken);
      const current = await repository.findRefresh(oldHash);
      if (!current)
        throw new HTTPException(401, { message: 'Invalid refresh token' });
      const nextToken = newRefreshToken();
      const response = await authResponse(
        current.user,
        current.session,
        nextToken,
        env.JWT_ACCESS_SECRET,
      );
      const updated = await repository.rotate(
        current.session,
        oldHash,
        hashRefreshToken(nextToken),
      );
      if (updated.length !== 1)
        throw new HTTPException(401, { message: 'Invalid refresh token' });
      return response;
    },
  };
}
