import { Module, type DynamicModule } from '@nestjs/common';
import { QUEUE_BINDINGS, type QueueBindings } from './queue.bindings.js';
import { QueueProducerService } from './queue-producer.service.js';
import { QueueConsumerService } from './queue-consumer.service.js';
import { ExampleProcessorService } from './example-processor.service.js';
import { QueueRateLimitGuard } from './queue-rate-limit.guard.js';
import { QueuesController } from './queues.controller.js';

@Module({})
export class QueuesModule {
  static register(bindings: QueueBindings): DynamicModule {
    return {
      module: QueuesModule,
      controllers: [QueuesController],
      providers: [
        { provide: QUEUE_BINDINGS, useValue: bindings },
        QueueProducerService,
        QueueConsumerService,
        ExampleProcessorService,
        QueueRateLimitGuard,
      ],
      exports: [QueueProducerService, QueueConsumerService],
    };
  }
}
