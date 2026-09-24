import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  ExpressAdapter,
  type NestExpressApplication,
} from '@nestjs/platform-express';
import { handleAsNodeRequest } from 'cloudflare:node';
import { configureApp } from '../configure-app.js';
import type { DynamicModule } from '@nestjs/common';
import { QueueConsumerService } from '../queues/queue-consumer.service.js';

async function bootstrap(module: DynamicModule) {
  const app = await NestFactory.create<NestExpressApplication>(
    module,
    new ExpressAdapter(),
    { abortOnError: false, logger: ['log', 'warn'] },
  );
  try {
    configureApp(app);
    await app.listen(3000);
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
export function createWorkerHandler(
  moduleFactory: (env: Env) => DynamicModule,
) {
  // Share only the initialized application, never request data or D1 sessions.
  let application: Promise<NestExpressApplication> | undefined;
  const getApplication = (env: Env): Promise<NestExpressApplication> => {
    application ??= Promise.resolve()
      .then(() => bootstrap(moduleFactory(env)))
      .catch((error: unknown) => {
        application = undefined;
        throw error;
      });
    return application;
  };
  return {
    async fetch(
      request: Request,
      env: Env,
      ctx: ExecutionContext,
    ): Promise<Response> {
      try {
        await getApplication(env);
        return await handleAsNodeRequest(3000, request, env, ctx);
      } catch {
        console.error(JSON.stringify({ code: 'WORKER_API_UNAVAILABLE' }));
        return Response.json(
          { statusCode: 503, message: 'API unavailable' },
          {
            status: 503,
            headers: { 'Cache-Control': 'no-store' },
          },
        );
      }
    },
    async queue(
      batch: MessageBatch<unknown>,
      env: Env,
      _ctx: ExecutionContext,
    ): Promise<void> {
      try {
        const app = await getApplication(env);
        await app.get(QueueConsumerService).consume(batch);
      } catch {
        console.error(JSON.stringify({ code: 'WORKER_QUEUE_UNAVAILABLE' }));
        batch.retryAll();
      }
    },
  } satisfies ExportedHandler<Env>;
}
