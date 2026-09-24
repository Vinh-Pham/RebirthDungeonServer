import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Express } from 'express';
import { configureOpenApi } from './openapi/configure-openapi.js';

export function configureApp(app: NestExpressApplication): void {
  const server: Express = app.getHttpAdapter().getInstance();
  server.disable('x-powered-by');
  server.use(['/auth', '/queues'], (_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  configureOpenApi(app);
}
