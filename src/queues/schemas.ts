import { z } from '@hono/zod-openapi';

export const exampleRequestSchema = z
  .strictObject({
    message: z.string().min(1).max(256),
  })
  .openapi('ExampleJobRequest');

export const queuedResponseSchema = z
  .object({
    jobId: z.uuid(),
    status: z.literal('queued'),
  })
  .openapi('QueuedJobResponse');

export const jobSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('example'),
  jobId: z.uuid(),
  userId: z.string().min(1),
  requestId: z.uuid(),
  createdAt: z.iso.datetime(),
  payload: exampleRequestSchema,
});

export type Job = z.infer<typeof jobSchema>;
export type ExampleRequest = z.infer<typeof exampleRequestSchema>;
