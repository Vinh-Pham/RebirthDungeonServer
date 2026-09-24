# Agent instructions

This repository is the **Rebirth Dungeon NestJS server**, written in TypeScript with native ESM. Cloudflare Workers is the only application runtime, using Nest’s Express adapter. Develop locally with Wrangler; Node is build/test tooling. Run commands from this repository root. The Defold game lives in a separate repository; its Lua, asset, and Automation Bridge workflows do not apply here.

## Directory map

| Location                                      | Responsibility                                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/app.module.ts`                           | Configures the Nest application from Worker bindings and validated values.                            |
| `src/worker/`                                 | Worker entrypoint, lazy HTTP handler, native KV adapter, statically bundled Argon2 Wasm.              |
| `src/auth/`                                   | Authentication, Zod DTOs, guards, native rate-limit policies, and repositories.                       |
| `src/db/primary-database.ts`                  | Nest token and factory for a fresh primary D1 session per repository operation.                       |
| `src/db/schema/`, `src/db/schema.ts`          | Drizzle SQLite tables and schema exports.                                                             |
| `src/email/`                                  | Internal sending service, native EMAIL transport, validated configuration, and React Email templates. |
| `src/openapi/`, `src/configure-app.ts`        | Scalar UI, OpenAPI documents, and Express middleware.                                                 |
| `tools/build-worker-assets.mjs`               | Copies the locked Scalar browser asset to the public `dist/assets/` directory.                        |
| `drizzle/`, `drizzle.config.ts`               | Existing migrations and remote D1 migration tooling.                                                  |
| `test/`                                       | Express route checks and full workerd integration tests using isolated local bindings.                |
| `wrangler.jsonc`, `worker-configuration.d.ts` | Deployment configuration and generated binding/runtime types.                                         |

Read `README.md`, `package.json`, and the relevant implementation before changing behavior. Preserve unrelated work in the checkout.

## Architecture and code conventions

- Use **npm** and maintain `package-lock.json` when dependencies change. Follow the actual scripts in `package.json`.
- Use Express in Workers. Do not add Fastify or adapter-specific plugins. Keep shared controllers adapter-neutral. Use the relevant adapter’s types only in bootstrap/adapter-specific code.
- Keep controllers focused on HTTP concerns, services on application behavior, repositories on database access, and transports on external APIs.
- Use Nest dependency injection. Follow the existing explicit `@Inject(...)` and symbol-token patterns. Explicit injection also avoids relying on decorator metadata that the Vitest transform may not emit.
- Use `.js` suffixes in relative TypeScript imports under NodeNext/ESM. Use `import type` for interfaces and inferred types that have no runtime value.
- Follow existing naming: kebab-case filenames, PascalCase classes/types, camelCase properties, and uppercase injection tokens/constants.
- Keep TypeScript strict. Validate external data at boundaries instead of trusting type assertions. Await promises or handle their rejection explicitly; lint rejects floating promises.
- Use Prettier with `.prettierrc` and Oxlint with `.oxlintrc.json`. Format only changed project files; avoid unrelated formatting churn.
- Compile Nest sources with TypeScript before Wrangler bundles `dist/worker/main.js`; decorator metadata must survive. Worker code may use supported Node APIs under `nodejs_compat`; never import native addons or dotenv into the Worker. Keep generated binding types in sync.
- Keep the current Nest optional-package aliases and synthetic module URL workaround until a tested upstream replacement is available; do not patch dependencies.
- Use the pinned Keyv 6 and official `@keyv/cloudflare-kv` binding adapter. Nest/cache-manager 7 requires the Keyv 5 alias compatibility layer in `createWorkerCache()` and the targeted peer override; do not pass bare Keyv 6 to `CacheModule`. Preserve namespace isolation, precise expiry, and cache-manager raw-read semantics.
- Never hand-edit `node_modules/`, `dist/`, or Wrangler local state. Regenerate generated artifacts through their owning tools.

## Validation, routes, and OpenAPI

- Use **Zod** for request object validation and infer types from schemas. Do not reintroduce class-validator/class-transformer DTOs.
- Use `z.strictObject()` for request objects and attach `new ZodValidationPipe(schema)` explicitly to each applicable `@Body()`, `@Query()`, or `@Param()` parameter. There is no global DTO validation pipe.
- Preserve the validation error contract: HTTP 400 with `statusCode`, `error`, `message`, and `issues` containing `path`, `code`, and `message`. Do not include submitted values or secrets in errors.
- Routes are protected by the global auth guard unless explicitly marked `@Public()`. Public operations must also declare `@ApiOperation({ security: [] })` to override the OpenAPI Bearer default.
- Document new or changed routes with tags, operation IDs, request schemas, success responses, and relevant errors. Generate request documentation from Zod. Custom refinements that JSON Schema cannot express need explicit metadata/descriptions, as shown by the password schema.
- Scalar API reference is served at `/docs`, JSON at `/openapi.json`, and YAML at `/openapi.yaml`. These documentation endpoints are public. The old root example route is absent.
- Keep `@nestjs/swagger` route annotations and document generation; Swagger UI is disabled. Use `@scalar/express-api-reference` for the UI, with local assets and `persistAuth: false`.
- Call `configureApp(app)` for Express middleware, Scalar routes, and OpenAPI. Workers Static Assets serves `/docs/js/scalar.js` from `dist/assets/`. Do not publish `dist/` as the assets directory. Run Express and workerd route tests after bootstrap changes.

## Authentication invariants

Preserve these contracts unless the task explicitly changes them:

- Register signs in immediately. Email is trimmed/lowercased and unique; passwords retain whitespace and require 12–128 Unicode characters.
- Inject `PASSWORD_HASHER` through `AuthModule.register()`: Workers use statically bundled `argon2-wasm-edge`; native `argon2` is a development-only interoperability test dependency. Preserve Unicode/NUL/whitespace and test both implementations against each other. Store Argon2id password hashes and SHA-256 hashes of opaque refresh tokens. Never persist plaintext credentials or refresh tokens.
- One active session per user. Login replaces its session ID, invalidating prior access and refresh tokens on subsequent checks.
- Access JWTs use HS256, verified issuer/audience, and at most 15 minutes of validity, capped by session expiry. The guard also checks the session in D1 on every protected request.
- Refresh sessions expire seven days after sign-in. Rotation preserves session ID and absolute expiry. Atomic conditional updates allow one concurrent refresh to succeed; replay returns 401 without revoking the replacement.
- Registration inserts the user and session atomically using a D1 batch. Preserve normalized-email uniqueness under concurrent registrations.
- Keep generic login failures, sanitized storage errors, per-IP throttling, and `Cache-Control: no-store` for auth responses. Native bindings enforce approximate limits per Cloudflare location: register/login 10/minute each, refresh 30/minute. Keys include route and client IP. The Worker trusts ingress `CF-Connecting-IP`, never arbitrary forwarded headers. Binding failures return sanitized 503; rejection returns 429 and conservative `Retry-After: 60`, without invented remaining/reset counts.
- Do not silently enable proxy trust or change client-IP handling.

## Cloudflare data and cache

- The Worker uses native `DB` and `CACHE` bindings. Inject `PRIMARY_DATABASE` as a `PrimaryDatabaseFactory`; repository operations call it once and use that database for all statements in the operation. There is no Node application runtime or HTTP data proxy.
- Preserve `env.DB.withSession('first-primary')` for authoritative reads, particularly immediate session invalidation. Never cache a D1 session/bookmark across requests; the factory creates a fresh session for each repository operation.
- Use Drizzle parameterized queries. Interactive `db.transaction()` calls are unsupported by D1; use `db.batch()` for atomic fixed statements or conditional updates for races.
- Add tables under `src/db/schema/`, export through `src/db/schema.ts`, and generate/review migrations. Preserve existing applied migrations; make subsequent changes through new migrations.
- Timestamps use SQLite integer `timestamp_ms` columns, application `Date` values, and ISO strings in API responses. Set `updatedAt` explicitly when modifying records.
- `npm run db:migrate` targets **remote D1** using environment credentials. It is not the local test migration command. For local work use explicit `wrangler d1 execute DB --local --file <migration.sql>` or the isolated auth test harness.
- KV is eventually consistent. Use it for cacheable data that tolerates stale reads, never authoritative auth/session state or immediate invalidation.
- Cache TTLs are milliseconds; `0` means no expiration. Preserve the adapter's logical expiry behavior and `nest-cache:v6:` namespace isolation. Response caching is opt-in.

## Worker deployment and runtime

- `wrangler.jsonc` deploys `rebirth-dungeon-server` from `dist/worker/main.js`. Preserve the existing D1/KV resource IDs.
- `npm run deploy` / `worker:deploy` publish the API; `test:worker` tests the real API in local workerd with temporary D1.
- Boot Nest lazily in the first HTTP request, queue delivery, or scheduled event: Nest initialization uses randomness unavailable in global scope. Cache only the application, with startup failure recovery, never request-specific state.
- The Worker uses Express with `cloudflare:node` HTTP adaptation. Do not patch dependencies or enable unsafe runtime evaluation.
- Preserve `tools/build-worker-assets.mjs` to copy the exact locked Scalar browser file into `dist/assets/docs/js/scalar.js`. Never hand-edit generated assets.
- Required Worker secret: `JWT_ACCESS_SECRET`. `EMAIL`, `EXAMPLE_QUEUE`, `QUEUE_RATE_LIMIT`, `AUTH_RATE_LIMIT`, and `REFRESH_RATE_LIMIT` are native bindings. Sender vars are in Wrangler config; `.dev.vars` is local only. Validate configuration without network calls.
- Worker errors must be sanitized; never log raw request bodies, credentials, SQL parameter values, or raw startup exceptions. Preserve the email service’s safe acceptance/failure logs. Use Cloudflare logs/traces.
- Password hashing requires adequate Worker CPU allowance (plan for Workers Paid); local runtime success does not establish production CPU limits or remote delivery.

## Cloudflare Queues

- `src/queues/` owns the dynamic `QueuesModule`, producer/consumer services, Zod message schemas, example processor, authenticated controller, and dedicated per-user rate guard. Inject native bindings inside plain provider objects.
- `QueueProducerService.enqueueExample({ value })` awaits native JSON publishing before returning `{ status: 'accepted', jobId }`. The UUID is an application correlation ID. Acceptance is not completion; publishing failures are sanitized and must not be automatically retried.
- The Worker `fetch`, `queue`, and `scheduled` handlers share one lazy application initialization promise with failure recovery. Never cache request data, message batches, or D1 sessions. Queue-first initialization must work without a prior HTTP request.
- Consumers validate external envelopes and dispatch by queue name/type. Await processing before each `ack()`; call `retry()` on failed/invalid messages. Startup/dispatcher failures call `retryAll()`. Never swallow a failure and accidentally acknowledge work.
- Default example settings: batch size 10, timeout 1 second, 3 retries, retry delay 5 seconds, and `rebirth-dungeon-example-dlq`. The production DLQ has no automatic consumer. Dead-letter inspection/replay is deliberate and preserves the job ID.
- Queues is at-least-once. Duplicate example logs are harmless; future state-changing processors must implement idempotency at the side-effect boundary. Do not automatically queue existing email delivery without resolving duplicate-send behavior.
- `POST /queues/example` is authenticated, strictly validates one bounded integer, and uses `QUEUE_RATE_LIMIT` (10/minute/user/location). Preserve no-store headers and sanitized 400/401/429/503 responses. Log only safe diagnostic codes, IDs, attempts, duration, and the numeric example result.
- `npm run queue:test` aliases the full local Worker suite. Tests may use a zero retry delay, injected processors, and a local-only DLQ observer. Keep forced failures and `__test/*` routes out of production; never enable remote bindings in automated tests.
- Regenerate Worker types after binding changes. Adding queues requires configured producer/consumer bindings, a versioned schema, typed producer method, DI processor, dispatch, and local runtime tests. No database migration is needed for the log-only example.

## Cloudflare Cron Triggers

- `src/scheduling/` owns `SchedulingModule` and its exported `SchedulingService`. Use Cloudflare scheduling, not Nest timer loops or `@nestjs/schedule`.
- Wrangler `triggers.crons` declares `* * * * *` (every minute, UTC). `SchedulingService.run({ cron, scheduledTime })` matches the exact expression and logs exactly `Hello from cron` once per invocation. Unsupported expressions fail.
- The Worker `scheduled()` handler resolves the service through shared lazy Nest startup and awaits completion. Cron-first initialization and concurrent HTTP/queue/cron invocations must work. Keep invocation state out of cached application state.
- Scheduled failures log only `WORKER_SCHEDULED_FAILED` and throw a sanitized error to preserve Cloudflare's failed invocation status. Do not swallow failures, attach raw causes, or disable platform retries. Startup failure recovery remains shared with the other handlers.
- `npm run cron:test` aliases the full local Worker suite. Use `/cdn-cgi/local/scheduled?cron=*+*+*+*+*&format=json` in local Wrangler tests; assert the outcome and exact greeting. No application test-trigger route is deployed.
- Manage cron expressions exclusively through Wrangler. Deployment activates/replaces the configured list; removing deployed schedules requires `crons: []`. Keep deployment separate from routine local verification.
- The example adds no persistent state or exactly-once guarantee. Future jobs with side effects must tolerate repeated invocations. Add a configuration expression, DI job dispatch, and local tests for each new schedule.

## React Email templates

- Use **React Email** for new transactional email templates instead of embedding HTML strings in controllers, services, or commands.
- Store React Email `.tsx` components in `src/email/templates/`. Use default exports, typed props, and non-sensitive `PreviewProps`; keep rendering helpers outside the templates folder.
- Use `EmailService.sendTemplate({ to, subject, template, replyTo? })` for component templates. It renders HTML once, generates matching plain text, and uses the existing Cloudflare transport. Raw-content `send()` remains supported.
- Import components/rendering from the installed `react-email` package. TypeScript uses `react-jsx`; relative imports still end in `.js`. Templates compile into `dist/email/templates/`.
- Follow `src/email/templates/test-email.tsx` for the component structure: `Html`, `Head`, `Preview`, `Body`, and content components imported from `react-email`. Keep subjects alongside their templates as exported constants when appropriate.
- Use email-compatible inline styles and absolute URLs for links and images. React must escape dynamic text; avoid raw HTML injection and network calls in templates. Rendering errors are sanitized as `TEMPLATE_RENDER_FAILED` and must not trigger delivery or retries.
- `npm run email:dev` previews templates locally on port 3001 without credentials or sending. `npm run email:test` runs the local Worker suite, including simulated sending; it does not send real mail.
- Verify HTML and plain-text content, dynamic-value escaping, sanitized rendering failures, and transport integration with fake delivery. Preview visual changes with `npm run email:dev`; do not use real sends for routine verification. Format `.tsx` files alongside `.ts` files.
- Keep templates presentation-only: prepare their data in services and use `renderEmailTemplate()` for rendering. `EmailService.sendTemplate()` passes both rendered formats through the existing validation and Cloudflare transport; do not duplicate provider calls in templates.

## Email, configuration, and logging

- `EmailModule.register(config, binding)` exports the internal `EmailService`. Consuming feature modules must import the configured module. Sending uses the native EMAIL binding. Keep RPC bindings nested inside plain provider objects: Nest probes provider lifecycle methods, which an RPC binding interprets as remote calls.
- Startup validates `JWT_ACCESS_SECRET`, `EMAIL_FROM`, and optional `EMAIL_FROM_NAME` from Worker configuration. Sender name defaults to `Rebirth Dungeon`. Application services receive validated values through DI rather than reading process.env.
- Keep the tooling-only D1 API token separate from the runtime JWT secret. JWT secrets must contain at least 32 bytes. Validate configuration without network requests during startup.
- Use `.env.example` and `.dev.vars.example` to document variables, with blank secrets. Never print or commit `.env`, `.dev.vars`, credentials, or secret-bearing request data.
- Email returns `{ status: "accepted", messageId }`, never a fabricated delivery outcome. Acceptance is not inbox delivery. Binding errors expose allowlisted string provider codes only.
- Sending has a 10-second timeout and no automatic retries. An uncertain response may follow an accepted email; retries could duplicate delivery.
- Automated tests use fake transports or local simulated bindings. Never enable `remote: true` in test configuration. Real email sending requires explicit authorization for the recipient; do not add production test-send routes.
- Preserve sanitized errors. Never log passwords, tokens, database parameter values containing credentials, email recipients, subjects, or message bodies. Email logs contain safe codes, duration, and acceptance status.
- Deployment, remote migration, DNS/resource changes, and real email sending have external effects. Keep routine verification local; perform external actions only when authorized by the task.
- For integration changes, consult current official NestJS, Zod, Drizzle, and Cloudflare documentation and installed package APIs. Use relevant available Cloudflare/Firecrawl skills rather than assuming older API behavior.

## Commands and verification

Run from the server repository root:

| Command                                | Purpose                                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm ci`                               | Install the locked dependencies.                                                                      |
| `npm run build`                        | Compile Nest into `dist/` and generate the local Scalar asset.                                        |
| `npm run start:dev`                    | Run the API locally with Wrangler.                                                                    |
| `npm run worker:dev`                   | Run the full Nest API in workerd locally (port 8787).                                                 |
| `npm run lint`                         | Type-aware linting of `src/` and `test/`.                                                             |
| `npm test`                             | Vitest unit tests (`*.spec.ts`).                                                                      |
| `npm run test:e2e`                     | Express routes, validation, Scalar UI/assets, and OpenAPI tests.                                      |
| `npm run test:auth`                    | Alias for the full Worker integration suite.                                                          |
| `npm run cron:test`                    | Run the local Worker integration suite, including scheduled events.                                    |
| `npm run email:dev`                    | Preview React Email templates locally at `http://localhost:3001`; no sending or credentials required. |
| `npm run email:test`                   | Run the Worker integration suite, including local simulated email sending.                            |
| `npm run worker:types`                 | Regenerate Worker types after binding/config changes.                                                 |
| `npm run worker:check`                 | Build/type-check the full Worker API.                                                                 |
| `npm run worker:dry-run`               | Bundle/check Worker deployment without publishing.                                                    |
| `npm run db:generate`                  | Generate migrations/snapshots after schema changes; review the output.                                |
| `npx prettier --write <changed-files>` | Format touched files; verify with `--check`.                                                          |

### Development workflow

1. Inspect the affected paths, current tests, and repository status; make the smallest coherent change.
2. Add or update behavior-focused tests for changed logic. Cover validation, error handling, authorization, and concurrency when relevant. Documentation-only changes do not require application tests.
3. For application code, run build, lint, and affected unit tests. Run `test:e2e` for routes, validation, Scalar/OpenAPI, or shared bootstrap changes.
4. Run `test:worker` (`test:auth` is an alias) for auth, schema, database, bootstrap, or root-module changes that affect the Worker runtime. It uses compiled Nest code to exercise production decorator metadata.
5. For Worker changes, run `worker:check` and `worker:dry-run`, plus affected local integration checks. Regenerate types when bindings change.
6. Keep network services mocked in unit tests. Use dummy valid email configuration and fake/local bindings in app tests; never weaken production startup validation to make tests pass.
7. Report what changed, checks performed, and any remaining blocker or unverified behavior. Do not claim remote deployment or real email delivery from local tests.

Keep this guide and `README.md` aligned when architecture, commands, configuration, or public contracts change. Use concise English descriptions for commits when the task calls for a commit.
