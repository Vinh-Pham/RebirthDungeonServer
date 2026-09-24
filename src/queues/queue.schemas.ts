import { z } from 'zod';

export const EXAMPLE_QUEUE_NAME = 'rebirth-dungeon-example';
export const examplePayloadSchema = z.strictObject({
  value: z.number().int().min(-1_000_000).max(1_000_000),
});
export const exampleJobSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('example.square'),
  jobId: z.uuid(),
  createdAt: z.iso.datetime(),
  payload: examplePayloadSchema,
});
export const queueAcceptanceSchema = z.strictObject({
  status: z.literal('accepted'),
  jobId: z.uuid(),
});
export type ExamplePayload = z.infer<typeof examplePayloadSchema>;
export type ExampleJob = z.infer<typeof exampleJobSchema>;
export type QueueAcceptance = z.infer<typeof queueAcceptanceSchema>;
