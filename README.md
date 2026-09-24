# Rebirth Dungeon server

NestJS API deployed to Cloudflare Workers using the Express adapter, native D1 through `drizzle-orm/d1`, and native KV. Authentication, Zod validation, React Email templates, and Scalar/OpenAPI are shared with an optional Node/Express runtime.

## Run the full API on Workers

The previous `worker/d1-proxy.ts` deployment only served `/query` and `/cache`, so `/auth/*` returned 404. The default `wrangler.jsonc` now targets **rebirth-dungeon-server** and boots Nest through `src/worker/main.ts`. Local Node and Workers both use the Express adapter and shared HTTP setup. The Worker uses Cloudflare’s [Node HTTP bridge](https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/) with Express.

1. Run `npm ci`.
2. Copy `.dev.vars.example` to `.dev.vars` and fill `JWT_ACCESS_SECRET` (at least 32 bytes), `CLOUDFLARE_ACCOUNT_ID`, and the dedicated `CLOUDFLARE_EMAIL_API_TOKEN`. Generate a JWT secret with `openssl rand -base64 48`. Never commit these values. Sender defaults live in `wrangler.jsonc`.
3. Apply the existing migrations to **local** D1:

   ```bash
   npx wrangler d1 execute DB --local --file drizzle/20260923195301_chunky_sumo/migration.sql
   ```

   Apply subsequent committed migrations in timestamp order when present.

4. Run `npm run worker:dev`. Open `http://localhost:8787/docs`. No separate Nest process is needed.

`npm run build` compiles with TypeScript to preserve Nest decorator metadata, then builds the local Scalar browser asset. Wrangler bundles the compiled Worker entrypoint plus Argon2 Wasm modules. Optional unused Nest integrations are mapped to explicit error modules; enable/install them deliberately before use. `import.meta.url` has a synthetic file URL solely for Nest’s unused optional-package loaders, not filesystem access.

## Deploy

The existing D1 database and KV namespace IDs are retained. This deployment uses the native `DB` and `CACHE` bindings and **does not require `D1_PROXY_TOKEN` or proxy URLs**.

Set the required secrets on `rebirth-dungeon-server`:

```bash
npx wrangler secret put JWT_ACCESS_SECRET
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID
npx wrangler secret put CLOUDFLARE_EMAIL_API_TOKEN
```

Use the existing JWT secret if active sessions must remain valid. Secret commands affect the deployed Worker; `.dev.vars` and `.env` are not uploaded automatically. Missing required secrets block deployment. Email and JWT configuration are validated when Nest bootstraps on the first request, without contacting the email API.

Before deploying, ensure the remote D1 schema has all committed migrations. `npm run db:migrate` uses `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, and a separate `CLOUDFLARE_D1_TOKEN` from `.env` and changes **remote D1**. Do not rerun raw migration SQL against an existing schema. This runtime migration adds no database migration.

```bash
npm run worker:dry-run
npm run worker:deploy
```

`npm run deploy` also deploys the full API Worker. In Cloudflare Builds, use `npm run worker:deploy` as the deploy command. Wrangler invokes the build itself. The expected URL is `https://rebirth-dungeon-server.zenp.workers.dev`.

Use **POST** for `/auth/register`, `/auth/login`, and `/auth/refresh`. Opening `/auth/register` in a browser sends GET and still returns 404. Open `/docs` for an interactive client. A harmless routing check (no account created) is:

```bash
curl -i https://rebirth-dungeon-server.zenp.workers.dev/auth/register \
  -H 'Content-Type: application/json' -d '{}'
```

Expected: **400** with Zod validation issues, not 404. A 503 indicates startup/configuration or storage failure; check Worker logs for sanitized failure codes.

Use a Workers Paid plan for this password-hashing workload: Argon2 intentionally consumes CPU, and local tests do not enforce production CPU limits. Keep the existing 19 MiB/two-iteration security settings and measure production CPU before tuning limits. See [Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/). Worker logs/traces are enabled; Node Observe instrumentation is not loaded into the Worker.

## Cloudflare D1 and optional Node runtime

The Worker injects native Drizzle D1 through `@nestjs/drizzle`. Each query starts a fresh `first-primary` session; bookmarks and request data are never shared through the singleton Nest container. Use parameterized queries and `db.batch()` for atomic statements; D1 does not support interactive transactions.

Tables live under `src/db/schema/` and are exported from `src/db/schema.ts`. Use `npm run db:generate` and review/commit generated migrations. Timestamps use SQLite `timestamp_ms`, application `Date`, and ISO response strings.

For optional Node development, fill `.env` from `.env.example`, use the same `D1_PROXY_TOKEN` in `.dev.vars`, then run `npm run proxy:dev` and `npm run start:dev` in separate terminals. The retained `wrangler.proxy.jsonc` targets the separate `rebirth-dungeon-d1` proxy. It is not the API deployment config. Never deploy the proxy entrypoint over the API Worker.

## Checks

```bash
npm run build
npm run lint
npm test
npm run test:e2e
npm run test:auth
npm run test:worker
npm run worker:check
npm run worker:dry-run
```

Integration checks use temporary local databases and dummy email configuration. They do not migrate remote databases, deploy Workers, or send real email.

## Authentication

The Nest server exposes JSON authentication for the game client:

| Endpoint              | Request body                                                              | Success                              |
| --------------------- | ------------------------------------------------------------------------- | ------------------------------------ |
| `POST /auth/register` | `{ "email": "player@example.com", "password": "a long secure password" }` | `201`, creates the user and signs in |
| `POST /auth/login`    | Same email/password body                                                  | `200`, replaces the previous session |
| `POST /auth/refresh`  | `{ "refreshToken": "<current refresh token>" }`                           | `200`, rotates the refresh token     |

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

Follow the Workers setup above. The optional Node setup uses `.env` and the proxy. Both runtimes share the same users, password format, and token contracts.

### Session rules

Send access tokens as `Authorization: Bearer <accessToken>`. Routes are protected by default; use `@Public()` for intentionally public handlers. The three authentication endpoints are public; `GET /` is intentionally absent. The guard attaches `{ userId, sessionId }` to `request.user` on protected requests.

Access JWTs use HS256, issuer `rebirth-dungeon-server`, audience `rebirth-dungeon-game`, and a maximum lifetime of 15 minutes. Every protected request also checks the current session through a D1 `first-primary` session. A new login replaces the user's single session and invalidates both previous tokens immediately for subsequent checks. Already authorized in-flight requests may finish. KV does not store authentication state.

Refresh sessions expire seven days after login. Refresh rotates a 32-byte random token but preserves the session ID and absolute expiration; access JWT expiry is capped by that expiration. Store the latest refresh token after each success and serialize refresh calls in the client. Only one concurrent use of a refresh token succeeds. Consumed tokens return `401` without revoking the replacement; if the rotation response is lost, sign in again. Passwords use Argon2id (19 MiB, two iterations, one lane), and only SHA-256 refresh token hashes are stored. User and session timestamps are UTC milliseconds in D1 and ISO strings in JSON. Future user updates must also set `updatedAt`.

Email is trimmed and lowercased, validated, and unique. Passwords require 12–128 characters and are never trimmed. Unknown fields are rejected. Responses use `Cache-Control: no-store`; Node Observe request capture is disabled. Worker logs retain safe email outcome counts and sanitized startup failures; do not enable raw exception/request logging. Do not add request/token logging or response caching to these endpoints.

Errors: `400` invalid input, `401` invalid credentials or token, `409` duplicate email, `429` rate limited, and `503` unavailable authentication storage. Login errors do not distinguish unknown email from incorrect password. Register/login allow 10 requests per IP per minute per endpoint; refresh allows 30. Limits are in memory per Nest process/Worker isolate, not globally coordinated. Workers use Cloudflare’s ingress `CF-Connecting-IP` header and timestamp-based counters without background timers. Do not expose that trust policy on a non-Cloudflare host. Node Express proxy trust is disabled by default. Distributed protection needs a separate edge rate-limit policy.

### Verification

`npm run test:worker` runs the compiled Express/Nest API inside local workerd with an isolated D1 database. It verifies routes, docs, native/Worker Argon2 compatibility (including Unicode), and refresh races.

`npm run test:auth` builds the real Nest application and runs Express integration tests against a temporary local Wrangler/D1 instance, then removes that test database. It verifies validation, password hashing, duplicate registration races, atomic registration rollback, session replacement, refresh races and replay, JWT validation, expiry, throttling, and sanitized outages. `npm test`, `npm run test:e2e`, `npm run worker:check`, and `npm run worker:dry-run` cover the existing server and Worker checks.

## Cloudflare KV cache

The Worker’s global `CacheModule` uses the native `CACHE` binding. The namespace ID is configured in `wrangler.jsonc`; the binding name must remain `CACHE`. The optional Node runtime uses `KV_PROXY_URL` and `D1_PROXY_TOKEN` through `wrangler.proxy.jsonc`.

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

## Request validation with Zod

All authentication request bodies use strict Zod object schemas in `src/auth/auth.dto.ts` and the reusable `ZodValidationPipe` in `src/validation/zod-validation.pipe.ts`. Types are inferred from the schemas. The pipe supports async refinements, returns parsed/transformed data, and reports HTTP 400 with `{ statusCode, error, message, issues: [{ path, code, message }] }`. Submitted values are not included in validation errors.

For new route inputs, declare a Zod schema and attach `new ZodValidationPipe(schema)` to `@Body()`, `@Query()`, or `@Param()`. Use `z.strictObject()` to reject unknown fields. Validation is explicit on route parameters and does not depend on reflected DTO classes or a global class-validator pipe. Email is normalized before validation; passwords are preserved exactly. See the [Zod object documentation](https://zod.dev/api#zstrictobject).

## Scalar and OpenAPI

With `npm run worker:dev`, use port **8787**. The optional Node runtime uses port **3000**. The same paths are served on the deployed Worker:

- Scalar API reference: [http://localhost:8787/docs](http://localhost:8787/docs)
- OpenAPI JSON: [http://localhost:8787/openapi.json](http://localhost:8787/openapi.json)
- OpenAPI YAML: [http://localhost:8787/openapi.yaml](http://localhost:8787/openapi.yaml)

These documentation URLs are publicly accessible. Scalar's API client sends real requests to this server. Register, login, and refresh are documented with request constraints, token/user response fields, status codes, rate limits, and session replacement/rotation behavior. Request schemas are generated from Zod; custom password refinements carry explicit JSON Schema metadata.

Use Scalar’s **Authentication** controls to enter an access token for protected routes. The OpenAPI default is Bearer authentication; existing public auth operations explicitly override it. Authorization is not persisted across browser reloads. For a new public route, add both `@Public()` and `@ApiOperation({ security: [] })`; add operation, body, and response documentation to new routes. Shared OpenAPI generation lives in `src/openapi/configure-document.ts`; both runtimes use `configureApp()` and the same Express Scalar adapter.

Scalar uses `@scalar/express-api-reference` in both runtimes and serves its JavaScript at `/docs/js/scalar.js` from the application. `tools/build-worker-assets.mjs` copies the locked `@scalar/api-reference` standalone browser bundle at build time, so both runtimes serve the same local UI without a runtime CDN dependency. Default external fonts and telemetry are disabled, and authorization is not persisted. `@nestjs/swagger` remains responsible for generating the OpenAPI document from route annotations; its Swagger UI is disabled.

References: [Scalar Express integration](https://scalar.com/products/api-references/integrations/express), [Nest OpenAPI generation](https://docs.nestjs.com/openapi/introduction).

## Cloudflare Email Sending

`EmailModule` exports an injectable `EmailService` for internal transactional sends. Import `EmailModule` in each module that needs the service. It calls Cloudflare directly through the REST transport from either runtime; it does not use the D1/KV proxy. Registration, login, refresh, and the public OpenAPI routes do not send email.

### Required configuration

The Nest application now refuses to start without valid email configuration, even if no email is being sent. Set these variables in `.dev.vars` for local Workers, `.env` for Node/email CLI, and Worker secrets/vars in production:

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
