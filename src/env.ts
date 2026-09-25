import type { User } from './db/repository.js';

export type AppEnv = {
  Bindings: CloudflareBindings;
  Variables: { user: User; sessionId: string; requestId: string };
};
