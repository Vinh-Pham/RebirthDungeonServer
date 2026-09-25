import { jobSchema, type ExampleRequest, type Job } from './schemas.js';

export async function enqueueExampleJob(
  queue: Queue<Job>,
  payload: ExampleRequest,
  userId: string,
  requestId: string,
): Promise<string> {
  const job = jobSchema.parse({
    version: 1,
    type: 'example',
    jobId: crypto.randomUUID(),
    userId,
    requestId,
    createdAt: new Date().toISOString(),
    payload,
  });
  await queue.send(job, { contentType: 'json' });
  return job.jobId;
}
