import { z } from 'zod';
import { EmailSendError } from './email.error.js';

export const EMAIL_CONFIG = Symbol('EMAIL_CONFIG');
export const emailConfigSchema = z.object({
  accountId: z.string().regex(/^[a-f0-9]{32}$/i),
  apiToken: z.string().min(1).regex(/^\S+$/),
  from: z.email(),
  fromName: z
    .string()
    .trim()
    .min(1)
    .regex(/^[^\r\n]+$/),
});
export type EmailConfig = z.infer<typeof emailConfigSchema>;

export function emailConfig(): EmailConfig {
  const result = emailConfigSchema.safeParse({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_EMAIL_API_TOKEN,
    from: process.env.EMAIL_FROM,
    fromName: process.env.EMAIL_FROM_NAME ?? 'Rebirth Dungeon',
  });
  if (!result.success) throw new EmailSendError('CONFIGURATION');
  return result.data;
}
