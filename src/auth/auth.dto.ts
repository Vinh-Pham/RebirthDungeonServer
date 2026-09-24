import { z } from 'zod';

export const credentialsSchema = z.strictObject({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email())
    .meta({
      format: 'email',
      description: 'Trimmed and lowercased before validation.',
      example: 'player@example.com',
    }),
  // Count Unicode characters, matching the previous password length rules.
  password: z
    .string()
    .refine((value) => {
      const length = Array.from(value).length;
      return length >= 12 && length <= 128;
    }, 'Password must contain between 12 and 128 characters')
    .meta({
      minLength: 12,
      maxLength: 128,
      writeOnly: true,
      description: '12–128 Unicode characters. Whitespace is preserved.',
      example: 'a long secure password',
    }),
});

export const refreshSchema = z.strictObject({
  refreshToken: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/, 'Invalid refresh token format'),
});

export type CredentialsDto = z.output<typeof credentialsSchema>;
export type RefreshDto = z.output<typeof refreshSchema>;
