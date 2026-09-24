import { AppModule } from '../app.module.js';
import { workerPasswordHasher } from './password-hasher.js';
import { createWorkerHandler } from './handler.js';

export default createWorkerHandler((env) =>
  AppModule.register(env, workerPasswordHasher),
);
