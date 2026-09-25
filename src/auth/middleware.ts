import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../env.js';
import { createRepository } from '../db/repository.js';
import { verifyAccessToken } from './tokens.js';

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const match = /^Bearer ([^\s]+)$/i.exec(c.req.header('Authorization') ?? '');
  if (!match)
    throw new HTTPException(401, { message: 'Bearer access token required' });
  const claims = await verifyAccessToken(match[1]!, c.env.JWT_ACCESS_SECRET);
  const user = await createRepository(c.env.DB).activeUser(
    claims.sub,
    claims.sid,
  );
  if (!user)
    throw new HTTPException(401, { message: 'Session expired or revoked' });
  c.set('user', user);
  c.set('sessionId', claims.sid);
  await next();
});

export const rateLimitAuth = createMiddleware<AppEnv>(async (c, next) => {
  const limiter =
    c.req.path === '/auth/refresh'
      ? c.env.REFRESH_RATE_LIMIT
      : c.env.AUTH_RATE_LIMIT;
  // Cloudflare ingress owns this header. Do not trust X-Forwarded-For.
  const ip = c.req.header('CF-Connecting-IP') ?? 'local';
  let allowed: boolean;
  try {
    ({ success: allowed } = await limiter.limit({
      key: `${c.req.path}:${ip}`,
    }));
  } catch {
    throw new HTTPException(503, { message: 'Rate limiting unavailable' });
  }
  if (!allowed) {
    c.header('Retry-After', '60');
    throw new HTTPException(429, { message: 'Too many requests' });
  }
  await next();
});
