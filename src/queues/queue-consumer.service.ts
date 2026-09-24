import { Inject, Injectable } from '@nestjs/common';
import { ExampleProcessorService } from './example-processor.service.js';
import { EXAMPLE_QUEUE_NAME, exampleJobSchema } from './queue.schemas.js';

@Injectable()
export class QueueConsumerService {
  constructor(
    @Inject(ExampleProcessorService)
    private readonly example: ExampleProcessorService,
  ) {}

  async consume(batch: MessageBatch<unknown>): Promise<void> {
    if (batch.queue !== EXAMPLE_QUEUE_NAME) {
      // The Worker boundary retries the entire batch on routing failures.
      throw new Error('Unsupported queue');
    }
    for (const message of batch.messages) {
      const started = Date.now();
      const parsed = exampleJobSchema.safeParse(message.body);
      if (!parsed.success) {
        console.warn(
          JSON.stringify({
            code: 'QUEUE_INVALID_MESSAGE',
            messageId: message.id,
            attempt: message.attempts,
          }),
        );
        message.retry();
        continue;
      }
      const job = parsed.data;
      try {
        const result = await this.example.process(job.payload);
        console.log(
          JSON.stringify({
            code: 'QUEUE_COMPLETED',
            jobId: job.jobId,
            messageId: message.id,
            attempt: message.attempts,
            result,
            durationMs: Date.now() - started,
          }),
        );
        message.ack();
      } catch {
        console.warn(
          JSON.stringify({
            code: 'QUEUE_PROCESSING_FAILED',
            jobId: job.jobId,
            messageId: message.id,
            attempt: message.attempts,
          }),
        );
        message.retry();
      }
    }
  }
}
