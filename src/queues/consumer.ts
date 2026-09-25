import { jobSchema, type Job } from './schemas.js';

export async function processJob(job: Job): Promise<void> {
  switch (job.type) {
    case 'example':
      // Harmless example: completion is recorded by the consumer below.
      return;
  }
}

export async function consumeJobs(
  batch: MessageBatch<unknown>,
  process: (job: Job) => Promise<void> = processJob,
): Promise<void> {
  for (const message of batch.messages) {
    const metadata = {
      queue: batch.queue,
      messageId: message.id,
      attempt: message.attempts,
    };
    const parsed = jobSchema.safeParse(message.body);
    if (!parsed.success) {
      console.error(
        JSON.stringify({
          event: 'queue_job_failed',
          ...metadata,
          category: 'invalid_message',
        }),
      );
      message.retry();
      continue;
    }
    const job = parsed.data;
    const context = {
      ...metadata,
      jobId: job.jobId,
      requestId: job.requestId,
      type: job.type,
    };
    try {
      await process(job);
      console.log(JSON.stringify({ event: 'queue_job_completed', ...context }));
      message.ack();
    } catch {
      console.error(
        JSON.stringify({
          event: 'queue_job_failed',
          ...context,
          category: 'processing_failed',
        }),
      );
      message.retry();
    }
  }
}
