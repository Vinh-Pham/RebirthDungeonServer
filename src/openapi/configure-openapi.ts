import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Express } from 'express';
import { apiReference } from '@scalar/express-api-reference';
import { configureDocument } from './configure-document.js';

export function configureOpenApi(app: NestExpressApplication): void {
  configureDocument(app);
  const server: Express = app.getHttpAdapter().getInstance();
  const reference = apiReference({
    title: 'Rebirth Dungeon API',
    pageTitle: 'Rebirth Dungeon API',
    url: '/openapi.json',
    cdn: '/docs/js/scalar.js',
    theme: 'default',
    persistAuth: false,
    withDefaultFonts: false,
    telemetry: false,
  });
  server.get(
    '/docs',
    (request, response, next) => {
      if (request.path === '/docs') {
        response.redirect(301, '/docs/');
        return;
      }
      next();
    },
    reference,
  );
}
