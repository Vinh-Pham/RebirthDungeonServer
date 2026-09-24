export const QUEUE_BINDINGS = Symbol('QUEUE_BINDINGS');

/** Native bindings stay nested so Nest lifecycle probes never reach them. */
export interface QueueBindings {
  example: Queue;
  rateLimit: RateLimit;
}
