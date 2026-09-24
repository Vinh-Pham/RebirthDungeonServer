import { PASSWORD_HASHER, type PasswordHasher } from './password-hasher.js';
import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import {
  ThrottlerModule,
  type ThrottlerStorage,
  type ThrottlerGetTrackerFunction,
} from '@nestjs/throttler';
import { AUTH_CONFIG, authConfig } from './auth.config.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    AuthService,
    { provide: AUTH_CONFIG, useFactory: authConfig },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {
  static register(
    passwords: PasswordHasher,
    getTracker?: ThrottlerGetTrackerFunction,
    storage?: ThrottlerStorage,
  ): DynamicModule {
    return {
      module: AuthModule,
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: 60000, limit: 10 }],
          getTracker,
          storage,
        }),
      ],
      providers: [{ provide: PASSWORD_HASHER, useValue: passwords }],
    };
  }
}
