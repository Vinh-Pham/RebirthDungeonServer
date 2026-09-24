import type { ReactElement } from 'react';
import { z } from 'zod';

export const emailMessageSchema = z.strictObject({
  to: z.email(),
  subject: z
    .string()
    .min(1)
    .regex(/^[^\r\n]+$/),
  text: z.string().refine((value) => value.trim().length > 0),
  html: z.string().refine((value) => value.trim().length > 0),
  replyTo: z.email().optional(),
});
export const emailEnvelopeSchema = emailMessageSchema.omit({
  text: true,
  html: true,
});
export type EmailTemplateMessage = z.infer<typeof emailEnvelopeSchema> & {
  template: ReactElement;
};
export type EmailMessage = z.infer<typeof emailMessageSchema>;

export const emailAcceptanceSchema = z.object({ messageId: z.string().min(1) });
export interface EmailSendResult {
  status: 'accepted';
  messageId: string;
}
