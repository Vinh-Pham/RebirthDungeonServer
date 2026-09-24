import { z } from 'zod';
import { EmailSendError } from './email.error.js';

export const EMAIL_CONFIG = Symbol('EMAIL_CONFIG');
export const emailConfigSchema = z.object({
  from: z.email(),
  fromName: z
    .string()
    .trim()
    .min(1)
    .regex(/^[^\r\n]+$/)
    .default('Rebirth Dungeon'),
});
export type EmailConfig = z.infer<typeof emailConfigSchema>;

export function emailConfig(input: unknown): EmailConfig {
  const result = emailConfigSchema.safeParse(input);
  if (!result.success) throw new EmailSendError('CONFIGURATION');
  return result.data;
}
