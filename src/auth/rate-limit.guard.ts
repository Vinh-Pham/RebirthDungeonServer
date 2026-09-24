import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const AUTH_RATE_LIMITS = Symbol('AUTH_RATE_LIMITS');
const RATE_LIMIT_POLICY = 'auth-rate-limit-policy';
export interface AuthRateLimits {
  credentials: RateLimit;
  refresh: RateLimit;
}
export const RefreshRateLimit = () => SetMetadata(RATE_LIMIT_POLICY, 'refresh');

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(
    @Inject(AUTH_RATE_LIMITS) private readonly limits: AuthRateLimits,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<{
      headers: Record<string, string | string[] | undefined>;
      ip?: string;
    }>();
    const response = http.getResponse<{
      setHeader(name: string, value: string): void;
    }>();
    // Only the Worker ingress owns this header; never trust X-Forwarded-For.
    const address = request.headers['cf-connecting-ip'];
    const ip =
      typeof address === 'string' ? address : (request.ip ?? 'unknown');
    const policy =
      this.reflector.get<'refresh' | undefined>(
        RATE_LIMIT_POLICY,
        context.getHandler(),
      ) ?? 'credentials';
    const key = `${context.getClass().name}:${context.getHandler().name}:${ip}`;
    let success: boolean;
    try {
      ({ success } = await this.limits[policy].limit({ key }));
    } catch {
      throw new ServiceUnavailableException('Rate limiting unavailable');
    }
    if (!success) {
      response.setHeader('Retry-After', '60');
      throw new HttpException(
        {
          statusCode: 429,
          message: 'ThrottlerException: Too Many Requests',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
