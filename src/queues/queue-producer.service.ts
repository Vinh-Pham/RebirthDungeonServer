import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { QUEUE_BINDINGS, type QueueBindings } from './queue.bindings.js';
import {
  examplePayloadSchema,
  type ExampleJob,
  type ExamplePayload,
  type QueueAcceptance,
} from './queue.schemas.js';

@Injectable()
export class QueueProducerService {
  constructor(
    @Inject(QUEUE_BINDINGS) private readonly bindings: QueueBindings,
  ) {}

  async enqueueExample(payload: ExamplePayload): Promise<QueueAcceptance> {
    const job: ExampleJob = {
      version: 1,
      type: 'example.square',
      jobId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      payload: examplePayloadSchema.parse(payload),
    };
    try {
      await this.bindings.example.send(job, { contentType: 'json' });
    } catch {
      console.error(
        JSON.stringify({ code: 'QUEUE_PUBLISH_FAILED', jobId: job.jobId }),
      );
      throw new ServiceUnavailableException('Queue unavailable');
    }
    console.log(JSON.stringify({ code: 'QUEUE_ACCEPTED', jobId: job.jobId }));
    return { status: 'accepted', jobId: job.jobId };
  }
}
