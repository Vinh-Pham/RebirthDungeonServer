import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';
import { credentialsSchema, refreshSchema } from './auth.dto.js';

const authResponseSchema = z.object({
  user: z.object({
    id: z.uuid(),
    email: z.email(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
  accessToken: z
    .string()
    .describe(
      'HS256 JWT; use as a Bearer token. Valid for at most 15 minutes.',
    ),
  refreshToken: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .describe('Store securely and replace after every successful refresh.'),
  tokenType: z.literal('Bearer'),
  expiresIn: z
    .number()
    .int()
    .min(1)
    .max(900)
    .describe('Access token lifetime in seconds, capped by session expiry.'),
  refreshTokenExpiresAt: z.iso
    .datetime()
    .describe(
      'Absolute session expiry, seven days after sign-in. Refresh does not extend it.',
    ),
});
const errorSchema = z.object({
  statusCode: z.number().int(),
  message: z.string(),
  error: z.string(),
});
const validationErrorSchema = errorSchema.extend({
  issues: z.array(
    z.object({
      path: z.array(z.union([z.string(), z.number()])),
      code: z.string(),
      message: z.string(),
    }),
  ),
});

export const authOpenApiSchemas: Record<string, SchemaObject> =
  Object.fromEntries(
    Object.entries({
      Credentials: credentialsSchema,
      RefreshRequest: refreshSchema,
      AuthResponse: authResponseSchema,
      ApiError: errorSchema,
      ValidationError: validationErrorSchema,
    }).map(([name, schema]) => [
      name,
      z.toJSONSchema(schema, {
        target: 'openapi-3.0',
        io: 'input',
      }) as SchemaObject,
    ]),
  );
export const schemaRef = (name: keyof typeof authOpenApiSchemas) => ({
  $ref: `#/components/schemas/${name}`,
});

export const noStoreHeaders = {
  'Cache-Control': {
    schema: { type: 'string', example: 'no-store' },
    description: 'Authentication responses must not be cached.',
  },
};

export function ApiAuthErrors() {
  return applyDecorators(
    ApiResponse({
      status: 400,
      description:
        'Invalid request body. Zod failures include field issues; malformed JSON uses the standard error shape.',
      schema: { anyOf: [schemaRef('ValidationError'), schemaRef('ApiError')] },
      headers: noStoreHeaders,
    }),
    ApiResponse({
      status: 429,
      description: 'Per-IP, per-process rate limit exceeded.',
      schema: schemaRef('ApiError'),
      headers: noStoreHeaders,
    }),
    ApiResponse({
      status: 503,
      description:
        'Authentication storage unavailable. No database details are exposed.',
      schema: schemaRef('ApiError'),
      headers: noStoreHeaders,
    }),
  );
}
