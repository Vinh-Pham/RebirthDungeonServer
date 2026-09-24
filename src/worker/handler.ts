import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  ExpressAdapter,
  type NestExpressApplication,
} from '@nestjs/platform-express';
import { handleAsNodeRequest } from 'cloudflare:node';
import { configureApp } from '../configure-app.js';
import type { DynamicModule } from '@nestjs/common';

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
  return {
    async fetch(
      request: Request,
      env: Env,
      ctx: ExecutionContext,
    ): Promise<Response> {
      try {
        application ??= bootstrap(moduleFactory(env)).catch(
          (error: unknown) => {
            application = undefined;
            throw error;
          },
        );
        await application;
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
  } satisfies ExportedHandler<Env>;
}
