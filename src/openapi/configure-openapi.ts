import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { authOpenApiSchemas } from '../auth/auth.openapi.js';

export function configureOpenApi(app: NestFastifyApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Rebirth Dungeon API')
    .setDescription(
      'Game server API. Authentication endpoints return JSON tokens. One active session is allowed per user; signing in replaces the previous session. Protected routes require a Bearer access token and an active D1 session.',
    )
    .setVersion('1.0.0')
    .addTag('Authentication', 'Register, sign in, and rotate refresh tokens.')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Paste the accessToken returned by registration, login, or refresh.',
      },
      'access-token',
    )
    .addSecurityRequirements('access-token')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  document.components = {
    ...document.components,
    schemas: { ...document.components?.schemas, ...authOpenApiSchemas },
  };
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: '/openapi.json',
    yamlDocumentUrl: '/openapi.yaml',
    customSiteTitle: 'Rebirth Dungeon API',
    swaggerOptions: { persistAuthorization: false, validatorUrl: null },
  });
}
