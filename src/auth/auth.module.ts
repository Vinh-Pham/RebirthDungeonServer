import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AUTH_CONFIG, authConfig } from './auth.config.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
@Module({
  imports: [
    JwtModule.register({}),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    AuthService,
    { provide: AUTH_CONFIG, useFactory: authConfig },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
