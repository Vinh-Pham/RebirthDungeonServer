import { z } from '@hono/zod-openapi';

const entryNameSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'Invalid entry name format')
  .openapi({
    description:
      'Lowercase 1–64 characters: letters, digits, and hyphens; starts with a letter or digit. Entries are private to the authenticated user.',
    example: 'daily-greeting',
  });

const entryValueSchema = z.string().min(1).max(2048).openapi({
  description:
    'Value to cache, 1–2048 characters, stored as JSON with the requested TTL. Not encrypted; never store credentials, tokens, or session data.',
  example: 'Hello from the game client',
});

export const cachePutSchema = z
  .strictObject({
    name: entryNameSchema,
    value: entryValueSchema,
    ttlSeconds: z.int().min(60).max(2_592_000).default(300).openapi({
      description:
        'Time to live in seconds, 60–2,592,000 (one minute to 30 days). Defaults to 300. Writing an existing name overwrites its value and restarts the TTL.',
      example: 300,
    }),
  })
  .openapi('CachePutRequest');

export const cacheEntryParams = z.object({ name: entryNameSchema });

export const storedResponseSchema = z
  .object({
    name: entryNameSchema,
    ttlSeconds: z.int().min(60).max(2_592_000).openapi({
      description: 'Applied time to live in seconds.',
      example: 300,
    }),
    status: z
      .literal('stored')
      .openapi({ description: 'The entry was written to the cache.' }),
  })
  .openapi('CachePutResponse');

export const cacheEntryResponseSchema = z
  .object({
    name: entryNameSchema,
    value: z.string().min(1).max(2048).openapi({
      description: 'Stored value exactly as written.',
      example: 'Hello from the game client',
    }),
  })
  .openapi('CacheEntryResponse');

export type CachePutInput = z.output<typeof cachePutSchema>;
export type CacheEntryResponse = z.infer<typeof cacheEntryResponseSchema>;
