import { configureApp } from '../src/configure-app.js';
import { Test, TestingModule } from '@nestjs/testing';
import { getDrizzleToken } from '@nestjs/drizzle';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './../src/app.module.js';

describe('Application routes (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    vi.stubEnv('D1_PROXY_URL', 'http://localhost:8787/query');
    vi.stubEnv('KV_PROXY_URL', 'http://localhost:8787/cache');
    vi.stubEnv('D1_PROXY_TOKEN', 'test-token');
    vi.stubEnv(
      'JWT_ACCESS_SECRET',
      'test-secret-at-least-thirty-two-bytes-long',
    );
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it('registers D1 and leaves the removed root route unavailable', async () => {
    expect(app.get(getDrizzleToken())).toHaveProperty('select');
    const response = await app.inject({ method: 'GET', url: '/' });
    expect(response.statusCode).toBe(404);
  });

  it.each(['register', 'login', 'refresh'])(
    'validates /auth/%s with Zod',
    async (route) => {
      const response = await app.inject({
        method: 'POST',
        url: `/auth/${route}`,
        payload: {},
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        message: 'Validation failed',
        issues: expect.any(Array),
      });
      expect(response.headers['cache-control']).toBe('no-store');
    },
  );

  it('serves Swagger UI and its browser assets without authentication', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('swagger-ui');
    const asset = await app.inject({
      method: 'GET',
      url: '/docs/swagger-ui-bundle.js',
    });
    expect(asset.statusCode).toBe(200);
    expect(asset.headers['content-type']).toMatch(/javascript/);
  });

  it('exports all auth operations with Zod input constraints and public security overrides', async () => {
    const response = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(response.statusCode).toBe(200);
    const document = response.json();
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
    const yaml = await app.inject({ method: 'GET', url: '/openapi.yaml' });
    expect(yaml.statusCode).toBe(200);
    expect(yaml.body).toContain('/auth/register:');
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });
});
