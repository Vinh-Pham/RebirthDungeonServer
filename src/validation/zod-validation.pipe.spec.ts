import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { credentialsSchema, refreshSchema } from '../auth/auth.dto.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

describe('Zod request validation', () => {
  const credentials = {
    email: ' Player@Example.com ',
    password: '  correct password  ',
  };
  const pipe = new ZodValidationPipe(credentialsSchema);

  it('normalizes email without changing the password', async () => {
    await expect(pipe.transform(credentials)).resolves.toEqual({
      ...credentials,
      email: 'player@example.com',
    });
  });

  it.each([
    null,
    [],
    'text',
    {},
    { ...credentials, email: 123 },
    { ...credentials, email: 'invalid' },
    { ...credentials, password: 'short' },
    { ...credentials, password: 'x'.repeat(129) },
    { ...credentials, password: 123 },
    { ...credentials, extra: true },
  ])('rejects malformed credentials: %j', async (value) => {
    await expect(pipe.transform(value)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('keeps Unicode password length measured in characters', async () => {
    await expect(
      pipe.transform({ ...credentials, password: '😀'.repeat(12) }),
    ).resolves.toHaveProperty('password', '😀'.repeat(12));
    await expect(
      pipe.transform({ ...credentials, password: '😀'.repeat(6) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    {},
    { refreshToken: 123 },
    { refreshToken: 'a'.repeat(42) },
    { refreshToken: '!'.repeat(43) },
    { refreshToken: 'a'.repeat(43), extra: true },
  ])('rejects malformed refresh bodies: %j', async (body) => {
    await expect(
      new ZodValidationPipe(refreshSchema).transform(body),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns field issues without submitted secrets', async () => {
    try {
      await pipe.transform({ ...credentials, password: 'secret' });
      expect.fail('Expected validation failure');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse();
      expect(response).toMatchObject({
        statusCode: 400,
        issues: [
          { path: ['password'], code: 'custom', message: expect.any(String) },
        ],
      });
      expect(JSON.stringify(response)).not.toContain('secret');
    }
  });

  it('awaits async refinements', async () => {
    const schema = z.string().refine(async (value) => value === 'valid');
    await expect(
      new ZodValidationPipe(schema).transform('invalid'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      new ZodValidationPipe(schema).transform('valid'),
    ).resolves.toBe('valid');
  });
});
