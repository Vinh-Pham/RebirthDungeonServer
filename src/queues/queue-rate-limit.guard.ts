import {
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.guard.js';
import { QUEUE_BINDINGS, type QueueBindings } from './queue.bindings.js';

@Injectable()
export class QueueRateLimitGuard implements CanActivate {
  constructor(
    @Inject(QUEUE_BINDINGS) private readonly bindings: QueueBindings,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    // The global auth guard has already verified this session.
    const { user } = http.getRequest<{ user: AuthenticatedUser }>();
    let success: boolean;
    try {
      ({ success } = await this.bindings.rateLimit.limit({
        key: `queues:example:${user.userId}`,
      }));
    } catch {
      throw new ServiceUnavailableException('Rate limiting unavailable');
    }
    if (!success) {
      http
        .getResponse<{ setHeader(name: string, value: string): void }>()
        .setHeader('Retry-After', '60');
      throw new HttpException(
        {
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Queue rate limit exceeded',
        },
        429,
      );
    }
    return true;
  }
}
