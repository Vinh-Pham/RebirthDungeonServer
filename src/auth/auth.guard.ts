import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { FastifyRequest } from 'fastify';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import { AuthRepository } from './auth.repository.js';
import { PUBLIC_ROUTE } from './public.decorator.js';

export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: AuthenticatedUser }>();
    const match = /^Bearer ([^ ]+)$/i.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException();
    let payload: { sub: string; sid: string; exp: number; iat: number };
    try {
      payload = await this.jwt.verifyAsync(match[1], {
        secret: this.config.secret,
        algorithms: ['HS256'],
        issuer: this.config.issuer,
        audience: this.config.audience,
      });
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string' ||
        typeof payload.exp !== 'number' ||
        typeof payload.iat !== 'number'
      )
        throw new Error('Invalid claims');
    } catch {
      throw new UnauthorizedException();
    }
    if (!(await this.repository.activeSession(payload.sub, payload.sid)))
      throw new UnauthorizedException();
    request.user = { userId: payload.sub, sessionId: payload.sid };
    return true;
  }
}
