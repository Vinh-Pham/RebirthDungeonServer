import {
  Inject,
  Injectable,
  UnauthorizedException,
  type OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import * as argon2 from 'argon2';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import { AuthRepository, type User, type Session } from './auth.repository.js';
import type { CredentialsDto } from './auth.dto.js';

const PASSWORD_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;
export const hashRefresh = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash!: string;
  constructor(
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async onModuleInit() {
    this.dummyHash = await argon2.hash(randomBytes(32), PASSWORD_OPTIONS);
  }

  private newSession(userId: string) {
    const refreshToken = randomBytes(32).toString('base64url');
    const now = new Date();
    const session: Session = {
      userId,
      sessionId: randomUUID(),
      refreshTokenHash: hashRefresh(refreshToken),
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now,
    };
    return { session, refreshToken };
  }

  private async response(user: User, session: Session, refreshToken: string) {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = Math.min(
      900,
      Math.floor(session.expiresAt.getTime() / 1000) - now,
    );
    if (expiresIn <= 0) throw new UnauthorizedException('Session expired');
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, sid: session.sessionId, iat: now, exp: now + expiresIn },
      {
        secret: this.config.secret,
        algorithm: 'HS256',
        issuer: this.config.issuer,
        audience: this.config.audience,
      },
    );
    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn,
      refreshTokenExpiresAt: session.expiresAt.toISOString(),
    };
  }

  async register(dto: CredentialsDto) {
    const now = new Date();
    const user: User = {
      id: randomUUID(),
      email: dto.email,
      passwordHash: await argon2.hash(dto.password, PASSWORD_OPTIONS),
      createdAt: now,
      updatedAt: now,
    };
    const { session, refreshToken } = this.newSession(user.id);
    const response = await this.response(user, session, refreshToken);
    await this.repository.register(user, session);
    return response;
  }

  async login(dto: CredentialsDto) {
    const user = await this.repository.findUser(dto.email);
    const valid = await argon2.verify(
      user?.passwordHash ?? this.dummyHash,
      dto.password,
    );
    if (!user || !valid) throw new UnauthorizedException('Invalid credentials');
    const { session, refreshToken } = this.newSession(user.id);
    const response = await this.response(user, session, refreshToken);
    await this.repository.replaceSession(session);
    return response;
  }

  async refresh(refreshToken: string) {
    const oldHash = hashRefresh(refreshToken);
    const current = await this.repository.findRefresh(oldHash);
    if (!current) throw new UnauthorizedException('Invalid refresh token');
    const nextToken = randomBytes(32).toString('base64url');
    const response = await this.response(
      current.user,
      current.session,
      nextToken,
    );
    const updated = await this.repository.rotate(
      oldHash,
      hashRefresh(nextToken),
    );
    if (updated.length !== 1)
      throw new UnauthorizedException('Invalid refresh token');
    return response;
  }
}
