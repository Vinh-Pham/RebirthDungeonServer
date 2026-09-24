import { Injectable } from '@nestjs/common';
import type { ExamplePayload } from './queue.schemas.js';

@Injectable()
export class ExampleProcessorService {
  process(payload: ExamplePayload): Promise<number> {
    return Promise.resolve(payload.value * payload.value);
  }
}
