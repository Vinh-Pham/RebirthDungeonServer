import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  type SchemaObject,
} from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../validation/zod-validation.pipe.js';
import { QueueProducerService } from './queue-producer.service.js';
import { QueueRateLimitGuard } from './queue-rate-limit.guard.js';
import {
  examplePayloadSchema,
  queueAcceptanceSchema,
  type ExamplePayload,
} from './queue.schemas.js';

const noStoreHeaders = {
  'Cache-Control': { schema: { type: 'string', example: 'no-store' } },
};

@ApiTags('Queues')
@UseGuards(QueueRateLimitGuard)
@Controller('queues')
export class QueuesController {
  constructor(
    @Inject(QueueProducerService)
    private readonly producer: QueueProducerService,
  ) {}

  @Post('example')
  @HttpCode(202)
  @ApiOperation({
    operationId: 'enqueueExample',
    summary: 'Queue an example calculation',
    description:
      'Squares a number asynchronously and logs the result under the returned job ID. Acceptance does not mean completion. Limit: 10 requests per user per minute per Cloudflare location (approximate). Duplicate processing is possible.',
  })
  @ApiBody({
    required: true,
    schema: z.toJSONSchema(examplePayloadSchema, {
      target: 'openapi-3.0',
      io: 'input',
    }) as SchemaObject,
  })
  @ApiResponse({
    status: 202,
    description:
      'Accepted by the queue; completion is recorded in Worker logs.',
    schema: z.toJSONSchema(queueAcceptanceSchema, {
      target: 'openapi-3.0',
    }) as SchemaObject,
    headers: noStoreHeaders,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid body. Validation failures include field issues.',
    schema: {
      anyOf: [
        { $ref: '#/components/schemas/ValidationError' },
        { $ref: '#/components/schemas/ApiError' },
      ],
    },
    headers: noStoreHeaders,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing, invalid, or expired session.',
    schema: { $ref: '#/components/schemas/ApiError' },
    headers: noStoreHeaders,
  })
  @ApiResponse({
    status: 429,
    description: 'Per-user rate limit exceeded.',
    schema: { $ref: '#/components/schemas/ApiError' },
    headers: {
      ...noStoreHeaders,
      'Retry-After': { schema: { type: 'integer', example: 60 } },
    },
  })
  @ApiResponse({
    status: 503,
    description:
      'Queue, authentication storage, or rate limiting unavailable. A publishing failure can have an uncertain outcome; do not automatically resubmit.',
    schema: { $ref: '#/components/schemas/ApiError' },
    headers: noStoreHeaders,
  })
  enqueue(
    @Body(new ZodValidationPipe(examplePayloadSchema)) payload: ExamplePayload,
  ) {
    return this.producer.enqueueExample(payload);
  }
}
