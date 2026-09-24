import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Controller, Post, UseGuards } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  AUTH_RATE_LIMITS,
  AuthRateLimitGuard,
  RefreshRateLimit,
} from './rate-limit.guard.js';

@Controller('auth')
@UseGuards(AuthRateLimitGuard)
class TestController {
  @Post('login') login() {
    return { ok: true };
  }
  @Post('register') register() {
    return { ok: true };
  }
  @Post('refresh') @RefreshRateLimit() refresh() {
    return { ok: true };
  }
}
describe('Native rate limit guard', () => {
  let app: INestApplication;
  const credentials = { limit: vi.fn<RateLimit['limit']>() };
  const refresh = { limit: vi.fn<RateLimit['limit']>() };
  beforeEach(async () => {
    credentials.limit.mockReset().mockResolvedValue({ success: true });
    refresh.limit.mockReset().mockResolvedValue({ success: true });
    const module = await Test.createTestingModule({
      controllers: [TestController],
      providers: [
        AuthRateLimitGuard,
        { provide: AUTH_RATE_LIMITS, useValue: { credentials, refresh } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(
      '/auth',
      (
        _req: unknown,
        res: { setHeader(name: string, value: string): void },
        next: () => void,
      ) => {
        res.setHeader('Cache-Control', 'no-store');
        next();
      },
    );
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });
  it('selects policies and separates route/client keys', async () => {
    for (const route of ['login', 'register', 'refresh']) {
      expect(
        (
          await request(app.getHttpServer())
            .post(`/auth/${route}`)
            .set('cf-connecting-ip', '192.0.2.1')
        ).status,
      ).toBe(201);
    }
    expect(credentials.limit.mock.calls).toEqual([
      [{ key: 'TestController:login:192.0.2.1' }],
      [{ key: 'TestController:register:192.0.2.1' }],
    ]);
    expect(refresh.limit).toHaveBeenCalledWith({
      key: 'TestController:refresh:192.0.2.1',
    });
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('cf-connecting-ip', '192.0.2.2')
      .set('x-forwarded-for', 'spoofed');
    expect(credentials.limit).toHaveBeenLastCalledWith({
      key: 'TestController:login:192.0.2.2',
    });
  });
  it('returns no-store 429 and a conservative retry interval without invented counts', async () => {
    credentials.limit.mockResolvedValue({ success: false });
    const res = await request(app.getHttpServer()).post('/auth/login');
    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      statusCode: 429,
      message: 'ThrottlerException: Too Many Requests',
      error: 'Too Many Requests',
    });
    expect(res.headers['retry-after']).toBe('60');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-ratelimit-remaining']).toBeUndefined();
  });
  it('fails closed and hides binding errors', async () => {
    credentials.limit.mockRejectedValue(new Error('private binding failure'));
    const res = await request(app.getHttpServer()).post('/auth/login');
    expect(res.status).toBe(503);
    expect(res.body.message).toBe('Rate limiting unavailable');
    expect(JSON.stringify(res.body)).not.toContain('private');
  });
});
