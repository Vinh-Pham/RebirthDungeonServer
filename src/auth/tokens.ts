import { createHash, randomBytes } from 'node:crypto';
import { sign, verify } from 'hono/jwt';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Session, User } from '../db/repository.js';

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ACCESS_TTL_SECONDS = 15 * 60;
const ISSUER = 'rebirth-dungeon-server';
const AUDIENCE = 'rebirth-dungeon-game';
const claimsSchema = z
  .object({
    sub: z.string().min(1),
    sid: z.string().min(1),
    iat: z.int().nonnegative(),
    exp: z.int().positive(),
    iss: z.literal(ISSUER),
    aud: z.literal(AUDIENCE),
  })
  .refine((claims) => claims.exp > claims.iat);

function signingSecret(secret: string): string {
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new HTTPException(503, {
      message: 'Authentication configuration unavailable',
    });
  }
  return secret;
}

export function newRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function authResponse(
  user: User,
  session: Session,
  refreshToken: string,
  secret: string,
) {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = Math.min(
    ACCESS_TTL_SECONDS,
    Math.floor(session.expiresAt.getTime() / 1000) - now,
  );
  if (expiresIn <= 0)
    throw new HTTPException(401, { message: 'Session expired' });
  const accessToken = await sign(
    {
      sub: user.id,
      sid: session.sessionId,
      iat: now,
      exp: now + expiresIn,
      iss: ISSUER,
      aud: AUDIENCE,
    },
    signingSecret(secret),
    'HS256',
  );
  return {
    user: publicUser(user),
    accessToken,
    refreshToken,
    tokenType: 'Bearer' as const,
    expiresIn,
    refreshTokenExpiresAt: session.expiresAt.toISOString(),
  };
}

export async function verifyAccessToken(token: string, secret: string) {
  const key = signingSecret(secret);
  try {
    return claimsSchema.parse(
      await verify(token, key, { alg: 'HS256', iss: ISSUER, aud: AUDIENCE }),
    );
  } catch {
    throw new HTTPException(401, { message: 'Invalid access token' });
  }
}
