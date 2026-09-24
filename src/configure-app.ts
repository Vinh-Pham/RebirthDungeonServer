import { configureOpenApi } from './openapi/configure-openapi.js';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';

export function configureApp(app: NestFastifyApplication): void {
  configureOpenApi(app);
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', (request, reply, done) => {
      if (request.url.split('?')[0].startsWith('/auth/'))
        reply.header('Cache-Control', 'no-store');
      done();
    });
}
