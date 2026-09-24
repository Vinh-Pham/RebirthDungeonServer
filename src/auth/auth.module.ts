import { PASSWORD_HASHER, type PasswordHasher } from './password-hasher.js';
import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import {
  AUTH_RATE_LIMITS,
  AuthRateLimitGuard,
  type AuthRateLimits,
} from './rate-limit.guard.js';
import {
  PRIMARY_DATABASE,
  type PrimaryDatabaseFactory,
} from '../db/primary-database.js';

@Module({})
export class AuthModule {
  static register(options: {
    passwords: PasswordHasher;
    config: AuthConfig;
    database: PrimaryDatabaseFactory;
    limits: AuthRateLimits;
  }): DynamicModule {
    return {
      module: AuthModule,
      imports: [JwtModule.register({})],
      controllers: [AuthController],
      providers: [
        AuthRepository,
        AuthService,
        AuthRateLimitGuard,
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: PASSWORD_HASHER, useValue: options.passwords },
        { provide: AUTH_CONFIG, useValue: options.config },
        { provide: PRIMARY_DATABASE, useValue: options.database },
        { provide: AUTH_RATE_LIMITS, useValue: options.limits },
      ],
    };
  }
}
