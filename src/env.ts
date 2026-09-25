import type { Job } from './queues/schemas.js';
import type { User } from './db/repository.js';

export type AppEnv = {
  Bindings: Omit<CloudflareBindings, 'APP_QUEUE'> & { APP_QUEUE: Queue<Job> };
  Variables: { user: User; sessionId: string; requestId: string };
};
