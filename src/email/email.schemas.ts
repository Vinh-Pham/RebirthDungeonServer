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
export type EmailMessage = z.infer<typeof emailMessageSchema>;

export const deliveryResultSchema = z
  .object({
    delivered: z.array(z.email()),
    queued: z.array(z.email()),
    permanent_bounces: z.array(z.email()),
    suppressed_recipients: z.array(z.email()).default([]),
    message_id: z.string().min(1).optional(),
  })
  .transform((result) => ({
    delivered: result.delivered,
    queued: result.queued,
    permanentBounces: result.permanent_bounces,
    suppressedRecipients: result.suppressed_recipients,
    ...(result.message_id ? { messageId: result.message_id } : {}),
  }));
export type EmailSendResult = z.output<typeof deliveryResultSchema>;
export const emailSuccessSchema = z.object({
  success: z.literal(true),
  result: deliveryResultSchema,
});
export const emailFailureSchema = z.object({
  errors: z.array(z.object({ code: z.number().int() })),
});
