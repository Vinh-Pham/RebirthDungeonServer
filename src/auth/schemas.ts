import { z } from '@hono/zod-openapi';

export const credentialsSchema = z
  .strictObject({
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()).openapi({
      format: 'email',
      description:
        'Trimmed and lowercased before validation and uniqueness checks. Maximum 254 characters.',
      example: 'player@example.com',
    }),
    password: z
      .string()
      .refine((value) => {
        const length = Array.from(value).length;
        return length >= 12 && length <= 128;
      }, 'Password must contain between 12 and 128 characters')
      .openapi({
        minLength: 12,
        maxLength: 128,
        writeOnly: true,
        description:
          '12–128 Unicode characters; whitespace is preserved. The example is fictional, not a real password.',
        example: 'example-only long password',
      }),
  })
  .openapi('Credentials');

export const refreshSchema = z
  .strictObject({
    refreshToken: z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/, 'Invalid refresh token format')
      .openapi({
        description:
          'Latest opaque 43-character base64url refresh token returned by the API. Single-use; replace after every successful refresh. Not a JWT.',
        example: 'r'.repeat(43),
      }),
  })
  .openapi('RefreshRequest');

export const userSchema = z
  .object({
    id: z.string().openapi({
      description: 'Stable user identifier.',
      example: '6ce024c5-5c3d-4fa3-9288-3f86f5d47566',
    }),
    email: z.email().openapi({
      description: 'Normalized email address.',
      example: 'adventurer@example.com',
    }),
    createdAt: z.iso.datetime().openapi({
      description: 'Account creation time as a UTC ISO 8601 timestamp.',
      example: '2026-09-24T12:00:00.000Z',
    }),
    updatedAt: z.iso.datetime().openapi({
      description:
        'Last account update time as a UTC ISO 8601 timestamp; refreshing does not update the account.',
      example: '2026-09-24T12:00:00.000Z',
    }),
  })
  .openapi('User');

export const authResponseSchema = z
  .object({
    user: userSchema,
    accessToken: z.string().openapi({
      description:
        'HS256 JWT for the Authorization bearer header. Valid for at most 15 minutes, subject to session revocation. Example is a placeholder.',
      example: 'REPLACE_WITH_ACCESS_TOKEN_FROM_RESPONSE',
    }),
    refreshToken: z.string().openapi({
      description:
        'Opaque single-use token for POST /auth/refresh. Store securely and replace after refresh. Example is a placeholder.',
      example: 'r'.repeat(43),
    }),
    tokenType: z
      .literal('Bearer')
      .openapi({ description: 'Authorization header scheme.' }),
    expiresIn: z.int().positive().max(900).openapi({
      description:
        'Access-token lifetime in seconds, capped by the remaining session lifetime.',
      example: 900,
    }),
    refreshTokenExpiresAt: z.iso.datetime().openapi({
      description:
        'Absolute session deadline in UTC, seven days after login. Refresh does not extend it.',
      example: '2026-10-01T12:00:00.000Z',
    }),
  })
  .openapi('AuthResponse');

export const errorSchema = z
  .object({
    statusCode: z.int().openapi({
      description: 'HTTP status code, matching the response status.',
    }),
    message: z.string().openapi({
      description:
        'Human-readable failure explanation. Use HTTP status codes for client control flow.',
    }),
    error: z.string().openapi({
      description: 'HTTP error category, for example Unauthorized.',
    }),
  })
  .openapi('ApiError');

export type Credentials = z.infer<typeof credentialsSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
