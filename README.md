# Rebirth Dungeon server

NestJS/Express API running on **Cloudflare Workers**, locally through Wrangler and in production. It uses native D1, KV, rate-limit, and email bindings. Node.js is used for build/test tooling, not as a second application server. The legacy HTTP database/cache proxy has been removed.

## Local development

Use Node 24.15+ in the 24.x line (tested with 24.21.0), or another version allowed by `package.json`, and npm.

1. Run `npm ci`.
2. Copy `.dev.vars.example` to `.dev.vars` and set `JWT_ACCESS_SECRET` to a random value of at least 32 bytes. Never commit it. Sender defaults are in `wrangler.jsonc`.
3. Apply committed migrations to **local** D1 in timestamp order. For the initial migration:

   ```bash
   npx wrangler d1 execute DB --local --file drizzle/20260923195301_chunky_sumo/migration.sql
   ```

4. Run `npm run start:dev` (or `npm run worker:dev`). Open [the API reference](http://localhost:8787/docs).

Wrangler supplies local D1, KV, rate-limit, and email bindings. Email delivery is simulated; keep `remote: true` out of local test configuration. No proxy URLs or email API token are needed.

## Runtime and build

`src/worker/main.ts` composes the application. `createWorkerHandler()` lazily initializes Nest on the first request and uses Cloudflare's supported [Node HTTP bridge](https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/). Failed initialization can be retried. Only the application is cached; request-specific data and database sessions are not.

`npm run build` compiles TypeScript before Wrangler bundles `dist/worker/main.js`, preserving Nest decorator metadata. The build also copies Scalar's locked browser bundle to `dist/assets/docs/js/scalar.js`; Workers Static Assets serves it separately from server code. Never configure all of `dist/` as public assets.

The pinned Nest packages still need the optional-package aliases and synthetic `import.meta.url` in Wrangler configuration. The aliases fail explicitly if an unsupported optional integration is used. The synthetic URL initializes unused optional filesystem loaders; it does not provide package/filesystem resolution. Do not patch dependencies or enable runtime evaluation to bypass these constraints.

`argon2-wasm-edge` is statically bundled and retains Argon2id at 19 MiB, two iterations, one lane. Native `argon2` is a development-only interoperability test dependency. Native Worker `node:crypto` Argon2 remains unsupported. Existing Unicode/NUL/whitespace passwords and hashes remain compatible.

The `PRIMARY_DATABASE` Nest token supplies a factory. Each repository operation calls it once to create `drizzle(DB.withSession('first-primary'))` and uses that session for all its statements. This replaces reflective interception with explicit ownership. Keep atomic `db.batch()` registration and conditional refresh updates; D1 does not support interactive transactions.

## Deploy and rollback

This change requires **no schema migration or password reset**. Preserve existing D1/KV resource IDs and the existing JWT secret so active sessions remain valid.

- Use Workers Paid; verify Email Sending is enabled and the sender domain is verified in the target account.
- The only runtime secret is `JWT_ACCESS_SECRET`. Configure it with `npx wrangler secret put JWT_ACCESS_SECRET` if not already set. `.dev.vars` is not uploaded.
- `EMAIL`, `AUTH_RATE_LIMIT`, and `REFRESH_RATE_LIMIT` are configured bindings. The rate-limit namespace IDs `2026092301` and `2026092302` must be reserved for this application's policies in the account; staging should use separate IDs and resources.
- D1 migration credentials remain in `.env` for tooling only. `npm run db:migrate` affects **remote D1**; check existing migration history before running it. Do not rerun initial raw SQL against an existing schema.
- Run the checks below before `npm run worker:deploy` (or `npm run deploy`). Wrangler runs the build automatically.
- In staging, measure cold-start and authentication CPU/latency under concurrent requests and check for CPU/memory failures before setting production limits. Local workerd success does not establish production CPU limits or inbox delivery.
- Logs and traces are enabled. Monitor sanitized startup/storage errors, 429 rates, email acceptance/failure codes, and resource-limit errors. Retain the previous Worker version for code rollback; rollback does not roll back D1 data.

The existing external legacy proxy deployment is not deleted by these source changes. Retire it separately after confirming it has no remaining consumers. Obsolete deployed email API secrets can likewise be removed separately; this application no longer reads them.

## Checks

```bash
npm run worker:types
npm run worker:check
npm run lint
npm test
npm run test:e2e
npm run test:worker
npm run worker:dry-run
```

`worker:check` builds/type-checks the API. `test:auth` and `email:test` are aliases for the Worker integration suite. That suite uses compiled Nest code, isolated local D1/KV/rate-limit bindings, fake secrets, and simulated email delivery. It checks password interoperability, session replacement, JWT rejection, expiry, concurrent refresh, replay, registration races and rollback, docs/assets, startup failures, and redaction. Tests do not deploy, migrate remote data, or send real mail. The `__test/*` routes exist only in the local fixture, never in the production entrypoint.

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

Follow the Workers setup above. Existing users, password hashes, and token contracts are preserved.

### Session rules

Send access tokens as `Authorization: Bearer <accessToken>`. Routes are protected by default; use `@Public()` for intentionally public handlers. The three authentication endpoints are public; `GET /` is intentionally absent. The guard attaches `{ userId, sessionId }` to `request.user` on protected requests.

Access JWTs use HS256, issuer `rebirth-dungeon-server`, audience `rebirth-dungeon-game`, and a maximum lifetime of 15 minutes. Every protected request also checks the current session through a D1 `first-primary` session. A new login replaces the user's single session and invalidates both previous tokens immediately for subsequent checks. Already authorized in-flight requests may finish. KV does not store authentication state.

Refresh sessions expire seven days after login. Refresh rotates a 32-byte random token but preserves the session ID and absolute expiration; access JWT expiry is capped by that expiration. Store the latest refresh token after each success and serialize refresh calls in the client. Only one concurrent use of a refresh token succeeds. Consumed tokens return `401` without revoking the replacement; if the rotation response is lost, sign in again. Passwords use Argon2id (19 MiB, two iterations, one lane), and only SHA-256 refresh token hashes are stored. User and session timestamps are UTC milliseconds in D1 and ISO strings in JSON. Future user updates must also set `updatedAt`.

Email is trimmed and lowercased, validated, and unique. Passwords require 12–128 characters and are never trimmed. Unknown fields are rejected. Responses use `Cache-Control: no-store`. Worker logs retain safe email acceptance/failure codes and sanitized startup failures; do not enable raw exception/request logging. Do not add request/token logging or response caching to these endpoints.

Errors: `400` invalid input, `401` invalid credentials or token, `409` duplicate email, `429` rate limited, and `503` unavailable authentication storage or rate limiting. Login errors do not distinguish unknown email from incorrect password. Register/login allow 10 requests per IP per minute per endpoint; refresh allows 30. Limits use native Cloudflare rate-limit bindings and are approximate, eventually consistent, and local to each Cloudflare location. Keys separate each route and client IP. This is abuse protection, not a strict global quota. The guard uses ingress `CF-Connecting-IP`, never `X-Forwarded-For`. Rejections include `Retry-After: 60`; remaining/reset counters are omitted because the native API does not supply them. See [Cloudflare rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

## Cloudflare KV cache

The Worker’s global `CacheModule` uses the native `CACHE` binding. The namespace ID is configured in `wrangler.jsonc`; the binding name must remain `CACHE`. The cache foundation remains available for future consumers; auth/session state is never cached.

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

The small native adapter stays on Keyv 5. The official [`@keyv/cloudflare-kv`](https://github.com/jaredwray/keyv/tree/main/storage/cloudflare-kv) adapter currently requires prerelease Keyv 6; upgrade only when a compatible stable combination is available and expiration/namespace tests pass.

## Request validation with Zod

All authentication request bodies use strict Zod object schemas in `src/auth/auth.dto.ts` and the reusable `ZodValidationPipe` in `src/validation/zod-validation.pipe.ts`. Types are inferred from the schemas. The pipe supports async refinements, returns parsed/transformed data, and reports HTTP 400 with `{ statusCode, error, message, issues: [{ path, code, message }] }`. Submitted values are not included in validation errors.

For new route inputs, declare a Zod schema and attach `new ZodValidationPipe(schema)` to `@Body()`, `@Query()`, or `@Param()`. Use `z.strictObject()` to reject unknown fields. Validation is explicit on route parameters and does not depend on reflected DTO classes or a global class-validator pipe. Email is normalized before validation; passwords are preserved exactly. See the [Zod object documentation](https://zod.dev/api#zstrictobject).

## Scalar and OpenAPI

Local and deployed Workers serve the same public paths:

- `/docs` redirects to `/docs/`, which displays Scalar.
- `/openapi.json` and `/openapi.yaml` contain the generated API definition.
- `/docs/js/scalar.js` is served by Workers Static Assets before the Worker runs.

`@nestjs/swagger` generates the document from route annotations and Zod schemas; Swagger UI is disabled. `@scalar/express-api-reference` renders the UI. The locked browser asset is local, without a runtime CDN dependency. Default external fonts, telemetry, and persisted authorization are disabled. Scalar's interactive client sends actual API requests.

Public operations need both `@Public()` and `@ApiOperation({ security: [] })`. All other operations inherit Bearer authentication. Preserve explicit request schemas, operation IDs, error responses, and cache headers when adding routes.

## Cloudflare Email Sending

`EmailModule.register(config, binding)` exports `EmailService`. Import the configured module in features that need it. Auth routes currently do not send email. The native `EMAIL` binding uses the structured [Workers Email API](https://developers.cloudflare.com/email-service/api/send-emails/workers-api/) rather than authenticated REST calls.

Startup validates `EMAIL_FROM` and `EMAIL_FROM_NAME` (default `Rebirth Dungeon`) without network calls. Runtime configuration comes from Worker bindings through Nest providers. Account IDs and email API tokens are unnecessary at runtime; D1 tooling still uses its separate credentials.

Call `send({ to, subject, html, text, replyTo? })` or `sendTemplate({ to, subject, template, replyTo? })`. Both return:

```ts
{ status: 'accepted', messageId: string }
```

Acceptance does not confirm inbox delivery. The native binding does not return the old delivered/queued/bounce/suppression arrays. Provider failures become sanitized `EmailSendError` values with an application `code` and allowlisted string `providerCodes`. Raw provider messages and causes are never exposed.

Sending has a ten-second caller timeout and no automatic retries. Timing out does not cancel provider delivery; the outcome is uncertain and retrying could duplicate email. Logs include safe status/codes and duration, never recipients, subjects, content, or credentials.

Native RPC bindings are nested inside plain provider objects, because Nest probes providers for lifecycle methods. Injecting the raw binding would turn those probes into unsupported remote calls.

`npm run email:test` runs the local Worker suite and simulates a sample send. It no longer accepts `--to` or sends real mail. Local simulation may print/save the synthetic fixture email; production service logs stay redacted. Real delivery checks require a separately authorized recipient and production-ready sender configuration. No public test-send endpoint is deployed.

## React Email templates

Templates live in `src/email/templates/` as `.tsx` components. The sample `test-email.tsx` includes a preview snippet, email-compatible components, inline styles, and an optional `recipientName`. React Email rendering runs on the Nest server before Cloudflare receives the resulting HTML and plain text.

Use `EmailService.sendTemplate()` from a service whose module imports the configured `EmailModule`:

```ts
import { createElement } from 'react';
import TestEmail, { TEST_EMAIL_SUBJECT } from './email/templates/test-email.js';

await this.email.sendTemplate({
  to: 'recipient@example.com',
  subject: TEST_EMAIL_SUBJECT,
  template: createElement(TestEmail, { recipientName: 'Adventurer' }),
});
```

The service validates the envelope, renders HTML once, derives plain text with `toPlainText()`, and delegates to the same validated `send()` method and Cloudflare transport. It returns `{ status: "accepted", messageId }`, not delivery confirmation. Template rendering failures raise `TEMPLATE_RENDER_FAILED` before sending; the original error and props are not exposed. `send({ to, subject, html, text })` remains available for callers that already have content.

### Preview and test

```bash
# Local template preview; does not need Cloudflare credentials or send email
npm run email:dev

# Local Worker tests, including simulated email delivery
npm run email:test
```

The preview runs at [http://localhost:3001](http://localhost:3001), separately from the Worker API on port 8787. The React Email CLI and preview UI are installed in the project; preview artifacts are ignored by Git. The Worker tests render and send the sample through a local simulated binding.

For a new template, add a default-exported component with typed props under `src/email/templates/` and provide `PreviewProps` for realistic, non-sensitive sample data. Keep helpers outside that folder so they do not appear as templates in the preview. Use the installed `react-email` package for components and rendering. Interpolate dynamic text through JSX so React escapes it; avoid raw HTML injection. Use inline, email-compatible styles and absolute URLs for any links or images. Keep sending/network calls out of components and do not place credentials or real recipient data in preview props.

The Nest TypeScript configuration supports JSX with `react-jsx`, and the compiled templates are included in `dist/email/templates/`. Node.js can render them without a frontend runtime or a separate template-file copy step. Automated tests render the template, check HTML/text content and escaping, and exercise `sendTemplate()` through a fake transport without sending email. See the [React Email rendering documentation](https://react.email/docs/utilities/render).
