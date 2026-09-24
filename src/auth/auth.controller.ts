import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiAuthErrors, noStoreHeaders, schemaRef } from './auth.openapi.js';
import {
  Body,
  Controller,
  Header,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthRateLimitGuard, RefreshRateLimit } from './rate-limit.guard.js';
import { AuthService } from './auth.service.js';
import {
  credentialsSchema,
  refreshSchema,
  type CredentialsDto,
  type RefreshDto,
} from './auth.dto.js';
import { ZodValidationPipe } from '../validation/zod-validation.pipe.js';
import { Public } from './public.decorator.js';

@ApiTags('Authentication')
@ApiAuthErrors()
@Public()
@UseGuards(AuthRateLimitGuard)
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @ApiOperation({
    summary: 'Register and sign in',
    operationId: 'register',
    security: [],
    description:
      'Atomically creates a user and session. Email is normalized and must be unique. Limit: 10 requests per IP per minute per Cloudflare location (approximate).',
  })
  @ApiBody({ required: true, schema: schemaRef('Credentials') })
  @ApiResponse({
    status: 201,
    description: 'Account created and signed in.',
    schema: schemaRef('AuthResponse'),
    headers: noStoreHeaders,
  })
  @ApiResponse({
    status: 409,
    description: 'The normalized email is already registered.',
    schema: schemaRef('ApiError'),
    headers: noStoreHeaders,
  })
  @Post('register')
  @Header('Cache-Control', 'no-store')
  register(
    @Body(new ZodValidationPipe(credentialsSchema)) dto: CredentialsDto,
  ) {
    return this.auth.register(dto);
  }

  @ApiOperation({
    summary: 'Sign in',
    operationId: 'login',
    security: [],
    description:
      'Replaces the active session, invalidating previous access and refresh tokens. Limit: 10 requests per IP per minute per Cloudflare location (approximate).',
  })
  @ApiBody({ required: true, schema: schemaRef('Credentials') })
  @ApiResponse({
    status: 200,
    description: 'Signed in with a new session.',
    schema: schemaRef('AuthResponse'),
    headers: noStoreHeaders,
  })
  @ApiResponse({
    status: 401,
    description:
      'Invalid credentials; unknown email and wrong password produce the same error.',
    schema: schemaRef('ApiError'),
    headers: noStoreHeaders,
  })
  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  login(@Body(new ZodValidationPipe(credentialsSchema)) dto: CredentialsDto) {
    return this.auth.login(dto);
  }

  @ApiOperation({
    summary: 'Rotate a refresh token',
    operationId: 'refresh',
    security: [],
    description:
      'Exchanges the current refresh token for a new token pair. Preserves session ID and absolute expiry. Only one concurrent use succeeds; replay returns 401. If the response is lost, sign in again. Limit: 30 requests per IP per minute per Cloudflare location (approximate).',
  })
  @ApiBody({ required: true, schema: schemaRef('RefreshRequest') })
  @ApiResponse({
    status: 200,
    description: 'Token pair refreshed. Replace the stored refresh token.',
    schema: schemaRef('AuthResponse'),
    headers: noStoreHeaders,
  })
  @ApiResponse({
    status: 401,
    description:
      'Refresh token is invalid, expired, consumed, or belongs to a replaced session.',
    schema: schemaRef('ApiError'),
    headers: noStoreHeaders,
  })
  @Post('refresh')
  @HttpCode(200)
  @RefreshRateLimit()
  @Header('Cache-Control', 'no-store')
  refresh(@Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
}
