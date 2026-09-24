<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Cloudflare D1 database

The Fastify server runs on Node.js, so it cannot receive a native D1 binding. A small Cloudflare Worker in `worker/d1-proxy.ts` owns that binding through the `drizzle-orm/d1` adapter. Nest registers its HTTP client with `@nestjs/drizzle` in `src/app.module.ts`. This follows [Cloudflare's guidance for accessing D1 outside Workers](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/).

1. Create a D1 database with `npx wrangler d1 create rebirth-dungeon`. Put its database ID in `wrangler.jsonc` in place of `REPLACE_WITH_D1_DATABASE_ID`.
2. Generate a random shared token. Copy `.dev.vars.example` to `.dev.vars` and put the token in `D1_PROXY_TOKEN`. Copy `.env.example` to `.env` and put the same token in its `D1_PROXY_TOKEN`. For local development, leave `D1_PROXY_URL` as `http://127.0.0.1:8787/query`.
3. Start the local Worker with `npm run worker:dev`, then start Nest with `npm run start:dev`. The Worker uses a local D1 database in this mode. The Worker endpoint accepts only authenticated, parameterized SQL requests.
4. Define tables in `src/db/schema.ts` with `sqliteTable()`. Create migration files with `npm run db:generate`. For remote migrations, fill `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, and `CLOUDFLARE_D1_TOKEN` in `.env` with a token that has D1 edit permission, then run `npm run db:migrate`. Commit the generated `drizzle/` files with the schema.
5. To use the deployed database at runtime, deploy the Worker with `npm run worker:deploy`, set its `D1_PROXY_TOKEN` with `npx wrangler secret put D1_PROXY_TOKEN`, and set Nest's `D1_PROXY_URL` to the deployed Worker's `/query` URL. Supply the same token to Nest as `D1_PROXY_TOKEN`.

Inject the database in Nest services with `@InjectDrizzle()` from `@nestjs/drizzle` and the `D1Database` type from `src/db/d1-proxy.ts`. `db.batch()` sends a group of statements to D1's native batch API. Interactive `db.transaction()` calls are unavailable across HTTP requests; use `db.batch()` for a fixed group of statements. `npm run db:studio` connects to the remote database using the Drizzle Kit credentials in `.env`.

## Authentication

The Nest server exposes JSON authentication for the game client:

| Endpoint | Request body | Success |
| --- | --- | --- |
| `POST /auth/register` | `{ "email": "player@example.com", "password": "a long secure password" }` | `201`, creates the user and signs in |
| `POST /auth/login` | Same email/password body | `200`, replaces the previous session |
| `POST /auth/refresh` | `{ "refreshToken": "<current refresh token>" }` | `200`, rotates the refresh token |

All three return:

```json
{
  "user": {
    "id": "<uuid>",
    "email": "player@example.com",
    "createdAt": "2026-09-23T12:00:00.000Z",
    "updatedAt": "2026-09-23T12:00:00.000Z"
  },
  "accessToken": "<jwt>",
  "refreshToken": "<opaque token>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "refreshTokenExpiresAt": "2026-09-30T12:00:00.000Z"
}
```

### Setup

1. Copy `.env.example` to `.env` and configure the existing D1/KV proxy URLs and shared proxy token. Set `JWT_ACCESS_SECRET` to a cryptographically random value of at least 32 bytes (`openssl rand -base64 48`). Keep the JWT secret on the Nest server; use the same secret across its replicas.
2. For local development, configure `.dev.vars` from `.dev.vars.example`. Apply the initial migration once to local D1:

   ```bash
   npx wrangler d1 execute DB --local --file drizzle/20260923195301_chunky_sumo/migration.sql
   ```

3. Run `npm run worker:dev` and `npm run start:dev` in separate terminals.
4. For production, replace the D1/KV placeholder IDs, configure the Worker secret, and set remote Drizzle credentials in `.env`. Apply migrations with `npm run db:migrate`, deploy the Worker, and point Nest at its HTTPS URLs. Deploy the updated Worker together with authentication: it supplies primary reads and sanitized duplicate-email errors. No remote resources or migrations are created by the tests.

### Session rules

Send access tokens as `Authorization: Bearer <accessToken>`. Routes are protected by default; use `@Public()` for intentionally public handlers. The existing `GET /` health/example route and the three authentication endpoints are public. The guard attaches `{ userId, sessionId }` to `request.user` on protected requests.

Access JWTs use HS256, issuer `rebirth-dungeon-server`, audience `rebirth-dungeon-game`, and a maximum lifetime of 15 minutes. Every protected request also checks the current session through a D1 `first-primary` session. A new login replaces the user's single session and invalidates both previous tokens immediately for subsequent checks. Already authorized in-flight requests may finish. KV does not store authentication state.

Refresh sessions expire seven days after login. Refresh rotates a 32-byte random token but preserves the session ID and absolute expiration; access JWT expiry is capped by that expiration. Store the latest refresh token after each success and serialize refresh calls in the client. Only one concurrent use of a refresh token succeeds. Consumed tokens return `401` without revoking the replacement; if the rotation response is lost, sign in again. Passwords use Argon2id (19 MiB, two iterations, one lane), and only SHA-256 refresh token hashes are stored. User and session timestamps are UTC milliseconds in D1 and ISO strings in JSON. Future user updates must also set `updatedAt`.

Email is trimmed and lowercased, validated, and unique. Passwords require 12–128 characters and are never trimmed. Unknown fields are rejected. Responses use `Cache-Control: no-store`; Observe request capture is disabled and authentication routes are excluded from tracing, with sensitive-field redaction configured. Do not add request/token logging or response caching to these endpoints.

Errors: `400` invalid input, `401` invalid credentials or token, `409` duplicate email, `429` rate limited, and `503` unavailable authentication storage. Login errors do not distinguish unknown email from incorrect password. Register/login allow 10 requests per IP per minute per endpoint; refresh allows 30. Limits are in memory per Nest process. Multiple replicas need shared or edge rate limiting. Fastify proxy trust is unchanged, so configure trusted proxies deliberately before relying on forwarded client IPs.

### Verification

`npm run test:auth` builds the real Nest application and runs Fastify integration tests against a temporary local Wrangler/D1 instance, then removes that test database. It verifies validation, password hashing, duplicate registration races, atomic registration rollback, session replacement, refresh races and replay, JWT validation, expiry, throttling, and sanitized outages. `npm test`, `npm run test:e2e`, `npm run worker:check`, and `npm run worker:dry-run` cover the existing server and Worker checks.

## Cloudflare KV cache

Nest's global `CacheModule` uses Cloudflare KV through the existing authenticated Worker at `/cache`. Configure `KV_PROXY_URL` in `.env` (locally `http://127.0.0.1:8787/cache`); it shares the Worker's `D1_PROXY_TOKEN`. Create a remote namespace with `npx wrangler kv namespace create CACHE` and replace `REPLACE_WITH_KV_NAMESPACE_ID` in `wrangler.jsonc` with its ID before deploying. Local `worker:dev` uses local KV automatically.

Inject `CACHE_MANAGER` to cache selected data:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class ExampleService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async example() {
    await this.cache.set('example', { value: 1 }, 60_000);
    return this.cache.get<{ value: number }>('example');
  }
}
```

TTLs are milliseconds and default to 60,000; `0` means no expiration. Keyv checks the serialized expiration on reads, so shorter TTLs still expire logically even though KV's physical TTL is rounded up to its 60-second minimum. `del()` removes one key; `clear()` paginates through the `nest-cache:` prefix and leaves unrelated KV keys intact. Clearing is not atomic with concurrent writes. HTTP responses are cached only if you explicitly apply Nest's `CacheInterceptor`.

KV is eventually consistent: updates and deletions can take 60 seconds or longer to appear elsewhere, and each key supports at most one write per second. Use this for reusable, read-heavy data that can tolerate stale reads; keep authoritative game state and coordination outside this cache. See the [Nest caching docs](https://docs.nestjs.com/techniques/caching) and [KV write and expiration rules](https://developers.cloudflare.com/kv/api/write-key-value-pairs/).

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

This project is already instrumented. Create a free account at [observe.nestjs.com](https://observe.nestjs.com), add an application, and paste the generated app key and secret into the `ObserveModule.forRoot()` call in `src/app.module.ts`.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## Request validation with Zod

All authentication request bodies use strict Zod object schemas in `src/auth/auth.dto.ts` and the reusable `ZodValidationPipe` in `src/validation/zod-validation.pipe.ts`. Types are inferred from the schemas. The pipe supports async refinements, returns parsed/transformed data, and reports HTTP 400 with `{ statusCode, error, message, issues: [{ path, code, message }] }`. Submitted values are not included in validation errors.

For new route inputs, declare a Zod schema and attach `new ZodValidationPipe(schema)` to `@Body()`, `@Query()`, or `@Param()`. Use `z.strictObject()` to reject unknown fields. Validation is explicit on route parameters and does not depend on reflected DTO classes or a global class-validator pipe. Email is normalized before validation; passwords are preserved exactly. See the [Zod object documentation](https://zod.dev/api#zstrictobject).

## Scalar and OpenAPI

With Nest running (default port 3000), open:

- Scalar API reference: [http://localhost:3000/docs](http://localhost:3000/docs)
- OpenAPI JSON: [http://localhost:3000/openapi.json](http://localhost:3000/openapi.json)
- OpenAPI YAML: [http://localhost:3000/openapi.yaml](http://localhost:3000/openapi.yaml)

These documentation URLs are publicly accessible. Scalar's API client sends real requests to this server. Register, login, and refresh are documented with request constraints, token/user response fields, status codes, rate limits, and session replacement/rotation behavior. Request schemas are generated from Zod; custom password refinements carry explicit JSON Schema metadata.

Use Scalar’s **Authentication** controls to enter an access token for protected routes. The OpenAPI default is Bearer authentication; existing public auth operations explicitly override it. Authorization is not persisted across browser reloads. For a new public route, add both `@Public()` and `@ApiOperation({ security: [] })`; add operation, body, and response documentation to new routes. Configuration lives in `src/openapi/configure-openapi.ts` and is shared by production and tests through `configureApp()`.

Scalar is registered with `@scalar/fastify-api-reference` and serves its JavaScript at `/docs/js/scalar.js` from the application. Default external fonts and telemetry are disabled, and authorization is not persisted. `@nestjs/swagger` remains responsible for generating the OpenAPI document from route annotations; its Swagger UI is disabled.

References: [Scalar Fastify integration](https://guides.scalar.com/scalar/scalar-api-references/integrations/fastify), [Nest OpenAPI generation](https://docs.nestjs.com/openapi/introduction).

## Cloudflare Email Sending

`EmailModule` exports an injectable `EmailService` for internal transactional sends. Import `EmailModule` in each module that needs the service. It calls Cloudflare directly from Node.js; it does not use the D1/KV proxy. Registration, login, refresh, and the public OpenAPI routes do not send email.

### Required configuration

The Nest application now refuses to start without valid email configuration, even if no email is being sent. Set these variables in `.env` locally and in your host's secret/environment configuration in production:

```dotenv
CLOUDFLARE_ACCOUNT_ID=<32-character Cloudflare account ID>
CLOUDFLARE_EMAIL_API_TOKEN=<dedicated API token with permission to send email>
EMAIL_FROM=noreply@rebirthdungeon.com
EMAIL_FROM_NAME=Rebirth Dungeon
```

`EMAIL_FROM_NAME` defaults to `Rebirth Dungeon` when absent. The other three values are required. Reuse the account ID already configured for Cloudflare; create a dedicated email API token for that account and keep it separate from `CLOUDFLARE_D1_TOKEN` and `D1_PROXY_TOKEN`. Configuration validation is local and does not test token authorization or DNS during startup.

Email Sending was confirmed enabled for `rebirthdungeon.com`. Before production, check the Cloudflare Email Sending dashboard for sender DNS verification and account eligibility/limits. `npx wrangler email sending list` shows enabled domains; `npx wrangler email sending dns get rebirthdungeon.com` shows the required records to compare against public DNS (SPF, DKIM, bounce MX, and DMARC). Listing required records alone does not prove DNS propagation or delivery. See the [sending API](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/) and [Cloudflare setup guide](https://developers.cloudflare.com/email-service/get-started/send-emails/) for token and domain setup.

### Internal API

```ts
import { Inject, Injectable } from '@nestjs/common';
import { EmailService } from './email/email.service.js';

@Injectable()
export class NotificationService {
  constructor(@Inject(EmailService) private readonly email: EmailService) {}

  sendNotification(to: string) {
    return this.email.send({
      to,
      subject: 'Rebirth Dungeon notification',
      text: 'Your notification is ready.',
      html: '<p>Your notification is ready.</p>',
      // replyTo: 'support@rebirthdungeon.com',
    });
  }
}
```

The strict Zod input accepts one recipient, a subject, nonempty text and HTML, and an optional reply address. The configured sender is applied internally. Callers are responsible for escaping user-provided values when constructing HTML.

`send()` returns `{ delivered, queued, permanentBounces, suppressedRecipients, messageId? }`; each outcome field contains recipient addresses. Queued means accepted for later delivery. Bounces and suppression are reported as outcomes even when the provider returns HTTP 200. Callers must handle them rather than equating a resolved promise with delivery.

Errors are `EmailSendError` instances with a stable `code`, optional HTTP `status`, and numeric `providerCodes`. Codes are `CONFIGURATION`, `INVALID_MESSAGE`, `REJECTED`, `AUTHORIZATION`, `RATE_LIMITED`, `PROVIDER_FAILURE`, and `UNCERTAIN_OUTCOME`, and `TEMPLATE_RENDER_FAILED`. Raw provider messages and causes are not propagated. A timeout, broken connection, or unusable successful response can leave delivery uncertain. Sends have a 10-second timeout and no automatic retry; retrying may duplicate an accepted email. Logs contain outcome counts, duration, and safe error codes, never recipient addresses, subjects, bodies, or credentials. Do not log the returned recipient arrays.

### Manual delivery test

After configuring the credentials, send only to an address you control:

```bash
npm run email:test -- --to you@your-domain.com
```

This builds the app and starts only the email module, so no D1/KV connection or JWT configuration is needed. It sends a fixed text-and-HTML message and prints outcome counts. Queued or delivered results exit successfully; errors, permanent bounces, and suppression exit unsuccessfully. Confirm arrival in the inbox and inspect SPF/DKIM/DMARC results in the received message; queued status alone is not delivery confirmation.

Automated tests use fake transports or mocked fetch responses and never send real email. Existing app/auth tests supply dummy email configuration and reject unexpected sends. Attachments, multiple recipients, queues, delivery webhooks, email verification, and password resets are not part of this module.

## React Email templates

Templates live in `src/email/templates/` as `.tsx` components. The sample `test-email.tsx` includes a preview snippet, email-compatible components, inline styles, and an optional `recipientName`. React Email rendering runs on the Nest server before Cloudflare receives the resulting HTML and plain text.

Use `EmailService.sendTemplate()` from a service whose module imports `EmailModule`:

```ts
import { createElement } from 'react';
import TestEmail, { TEST_EMAIL_SUBJECT } from './email/templates/test-email.js';

await this.email.sendTemplate({
  to: 'recipient@example.com',
  subject: TEST_EMAIL_SUBJECT,
  template: createElement(TestEmail, { recipientName: 'Adventurer' }),
});
```

The service validates the envelope, renders HTML once, derives plain text with `toPlainText()`, and delegates to the same validated `send()` method and Cloudflare transport. It returns the existing typed delivery result. Template rendering failures raise `TEMPLATE_RENDER_FAILED` before sending; the original error and props are not exposed. `send({ to, subject, html, text })` remains available for callers that already have content.

### Preview and test

```bash
# Local template preview; does not need Cloudflare credentials or send email
npm run email:dev

# Real send using the sample template (requires email configuration)
npm run email:test -- --to you@your-domain.com
```

The preview runs at [http://localhost:3001](http://localhost:3001), separately from Nest on port 3000. The React Email CLI and preview UI are installed in the project; preview artifacts are ignored by Git. The test-email command now renders the sample template rather than embedding raw HTML.

For a new template, add a default-exported component with typed props under `src/email/templates/` and provide `PreviewProps` for realistic, non-sensitive sample data. Keep helpers outside that folder so they do not appear as templates in the preview. Use the installed `react-email` package for components and rendering. Interpolate dynamic text through JSX so React escapes it; avoid raw HTML injection. Use inline, email-compatible styles and absolute URLs for any links or images. Keep sending/network calls out of components and do not place credentials or real recipient data in preview props.

The Nest TypeScript configuration supports JSX with `react-jsx`, and the compiled templates are included in `dist/email/templates/`. Node.js can render them without a frontend runtime or a separate template-file copy step. Automated tests render the template, check HTML/text content and escaping, and exercise `sendTemplate()` through a fake transport without sending email. See the [React Email rendering documentation](https://react.email/docs/utilities/render).
