import request from 'supertest';
import { configureApp } from '../src/configure-app.js';
import { Test, TestingModule } from '@nestjs/testing';
import { PRIMARY_DATABASE } from '../src/db/primary-database.js';
import { authConfig } from '../src/auth/auth.config.js';
import {
  ExpressAdapter,
  NestExpressApplication,
} from '@nestjs/platform-express';
import { AuthModule } from '../src/auth/auth.module.js';

describe('Application routes (e2e)', () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AuthModule.register({
          config: authConfig('test-secret-at-least-thirty-two-bytes-long'),
          passwords: {
            hash: async () => 'unused-hash',
            verify: async () => false,
          },
          database: () => {
            throw new Error('Unexpected database operation');
          },
          limits: {
            credentials: { limit: async () => ({ success: true }) },
            refresh: { limit: async () => ({ success: true }) },
          },
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>(
      new ExpressAdapter(),
    );
    configureApp(app);
    await app.init();
  });

  it('registers D1 and leaves the removed root route unavailable', async () => {
    expect(app.get(PRIMARY_DATABASE)).toBeTypeOf('function');
    const response = await request(app.getHttpServer()).get('/');
    expect(response.statusCode).toBe(404);
  });

  it.each(['register', 'login', 'refresh'])(
    'validates /auth/%s with Zod',
    async (route) => {
      const response = await request(app.getHttpServer())
        .post(`/auth/${route}`)
        .send({});
      expect(response.statusCode).toBe(400);
      expect(response.body).toMatchObject({
        message: 'Validation failed',
        issues: expect.any(Array),
      });
      expect(response.headers['cache-control']).toBe('no-store');
    },
  );

  it('serves Scalar referencing the public static asset without authentication', async () => {
    const redirect = await request(app.getHttpServer()).get('/docs');
    expect(redirect.statusCode).toBe(301);
    expect(redirect.headers.location).toBe('/docs/');
    const response = await request(app.getHttpServer()).get('/docs/');
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('src="/docs/js/scalar.js"');
    expect(response.text).toContain('Scalar.createApiReference');
    expect(response.text).toContain('<title>Rebirth Dungeon API</title>');
    expect(response.text).toContain('/openapi.json');
    expect(response.text).not.toContain('swagger-ui');
  });

  it('exports all auth operations with Zod input constraints and public security overrides', async () => {
    const response = await request(app.getHttpServer()).get('/openapi.json');
    expect(response.statusCode).toBe(200);
    const document = response.body;
    expect(document.openapi).toMatch(/^3\./);
    expect(Object.keys(document.paths).sort()).toEqual([
      '/auth/login',
      '/auth/refresh',
      '/auth/register',
    ]);
    expect(document.components.securitySchemes['access-token']).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    expect(document.security).toEqual([{ 'access-token': [] }]);
    for (const [route, success, failure] of [
      ['register', '201', '409'],
      ['login', '200', '401'],
      ['refresh', '200', '401'],
    ]) {
      const operation = document.paths[`/auth/${route}`].post;
      expect(operation.security).toEqual([]);
      expect(operation.operationId).toBe(route);
      expect(operation.requestBody.required).toBe(true);
      expect(
        operation.responses[success].content['application/json'].schema.$ref,
      ).toBe('#/components/schemas/AuthResponse');
      for (const status of ['400', '429', '503', failure])
        expect(operation.responses[status]).toBeDefined();
      expect(
        operation.responses[success].headers['Cache-Control'].schema.example,
      ).toBe('no-store');
    }
    const schemas = document.components.schemas;
    expect(schemas.Credentials).toMatchObject({
      required: ['email', 'password'],
      additionalProperties: false,
      properties: {
        email: { format: 'email', maxLength: 254 },
        password: { minLength: 12, maxLength: 128, writeOnly: true },
      },
    });
    expect(schemas.RefreshRequest.properties.refreshToken.pattern).toBe(
      '^[A-Za-z0-9_-]{43}$',
    );
    expect(schemas.AuthResponse.properties.user.properties).not.toHaveProperty(
      'passwordHash',
    );
    expect(schemas.AuthResponse.properties.expiresIn.maximum).toBe(900);
    const yaml = await request(app.getHttpServer()).get('/openapi.yaml');
    expect(yaml.statusCode).toBe(200);
    expect(yaml.text).toContain('/auth/register:');
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });
});
