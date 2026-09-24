# Agent instructions

This repository is the **Rebirth Dungeon NestJS server**, written in TypeScript with native ESM. Cloudflare Workers and local Node development both use Nest’s Express adapter. Run commands from this repository root. The Defold game lives in a separate repository; its Lua, asset, and Automation Bridge workflows do not apply here.

## Directory map

| Location                             | Responsibility                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `src/main.ts`                        | Node.js entrypoint; creates the Nest Express application with Observe instrumentation.                                 |
| `src/app.module.ts`                  | Node root module and database proxy, cache, email, and observability configuration.                                    |
| `src/configure-app.ts`               | Shared Express setup, including documentation and auth cache headers.                                                  |
| `src/auth/`                          | Register/login/refresh controllers, Zod DTOs, services, repository, JWT guard, configuration, and OpenAPI definitions. |
| `src/validation/`                    | Reusable Zod validation pipe and its tests.                                                                            |
| `src/db/schema/`                     | Drizzle SQLite table definitions, split by table.                                                                      |
| `src/db/schema.ts`                   | Schema export entrypoint used by Drizzle Kit. Export new tables here.                                                  |
| `src/db/d1-proxy.ts`                 | Nest-side Drizzle HTTP proxy client and database type.                                                                 |
| `src/cache/`                         | Keyv adapter connecting Nest cache-manager to Cloudflare KV.                                                           |
| `src/email/`                         | Internal sending service, Cloudflare REST transport, Zod schemas/configuration, typed errors, and manual test command. |
| `src/email/templates/`               | React Email `.tsx` templates; `test-email.tsx` is the sample used by the manual send command.                          |
| `src/email/render-email-template.ts` | Shared server-side rendering of a React element to HTML and plain text.                                                |
| `src/openapi/`                       | Scalar API reference UI and Nest-generated OpenAPI document setup.                                                     |
| `src/worker/`                        | Full Nest Worker entrypoint, Express setup, native D1/KV, Wasm password hashing, and timer-free throttling.            |
| `worker/`                            | Optional legacy D1/KV proxy for Node development: authenticated `/query` and `/cache`.                                 |
| `drizzle/`                           | Generated SQL migrations and schema snapshots. Keep these with schema changes.                                         |
| `test/`                              | Node/Express tests and full API workerd integration tests using isolated local D1.                                     |
| `wrangler.jsonc`                     | Full API Worker entrypoint, compatibility flags, resource bindings, required secrets, and observability.               |
| `worker-configuration.d.ts`          | Generated Worker binding and runtime types; regenerate rather than editing manually.                                   |
| `drizzle.config.ts`                  | SQLite schema discovery and remote D1 migration credentials.                                                           |

Read `README.md`, `package.json`, and the relevant implementation before changing behavior. Preserve unrelated work in the checkout.

## Architecture and code conventions

- Use **npm** and maintain `package-lock.json` when dependencies change. Follow the actual scripts in `package.json`.
- Use Express for both Cloudflare Workers and local Node. Do not add Fastify or adapter-specific plugins. Keep shared controllers adapter-neutral. Use the relevant adapter’s types only in bootstrap/adapter-specific code.
- Keep controllers focused on HTTP concerns, services on application behavior, repositories on database access, and transports on external APIs.
- Use Nest dependency injection. Follow the existing explicit `@Inject(...)`, `@InjectDrizzle()`, and symbol-token patterns. Explicit injection also avoids relying on decorator metadata that the Vitest transform may not emit.
- Use `.js` suffixes in relative TypeScript imports under NodeNext/ESM. Use `import type` for interfaces and inferred types that have no runtime value.
- Follow existing naming: kebab-case filenames, PascalCase classes/types, camelCase properties, and uppercase injection tokens/constants.
- Keep TypeScript strict. Validate external data at boundaries instead of trusting type assertions. Await promises or handle their rejection explicitly; lint rejects floating promises.
- Use Prettier with `.prettierrc` and Oxlint with `.oxlintrc.json`. Format only changed project files; avoid unrelated formatting churn.
- Compile Nest sources with TypeScript before Wrangler bundles `dist/worker/main.js`; decorator metadata must survive. Keep the optional proxy check in `tsconfig.worker.json`. Worker code may use supported Node APIs under `nodejs_compat`; never import native addons, Observe, dotenv, or the Node entrypoint into the Worker. Keep generated binding types in sync.
- Never hand-edit `node_modules/`, `dist/`, or Wrangler local state. Regenerate generated artifacts through their owning tools.

## Validation, routes, and OpenAPI

- Use **Zod** for request object validation and infer types from schemas. Do not reintroduce class-validator/class-transformer DTOs.
- Use `z.strictObject()` for request objects and attach `new ZodValidationPipe(schema)` explicitly to each applicable `@Body()`, `@Query()`, or `@Param()` parameter. There is no global DTO validation pipe.
- Preserve the validation error contract: HTTP 400 with `statusCode`, `error`, `message`, and `issues` containing `path`, `code`, and `message`. Do not include submitted values or secrets in errors.
- Routes are protected by the global auth guard unless explicitly marked `@Public()`. Public operations must also declare `@ApiOperation({ security: [] })` to override the OpenAPI Bearer default.
- Document new or changed routes with tags, operation IDs, request schemas, success responses, and relevant errors. Generate request documentation from Zod. Custom refinements that JSON Schema cannot express need explicit metadata/descriptions, as shown by the password schema.
- Scalar API reference is served at `/docs`, JSON at `/openapi.json`, and YAML at `/openapi.yaml`. These documentation endpoints are public. The old root example route is absent.
- Keep `@nestjs/swagger` route annotations and document generation; Swagger UI is disabled. Use `@scalar/express-api-reference` in both runtimes for the UI, with local assets and `persistAuth: false`.
- Both runtimes call `configureApp(app, scalarScript)` for shared Express middleware, Scalar routes, and `configureDocument()` for the OpenAPI schema. Node reads the locked standalone Scalar browser asset using `readScalarAsset()`; Workers import the copied text asset. Run both route test suites after bootstrap changes.

## Authentication invariants

Preserve these contracts unless the task explicitly changes them:

- Register signs in immediately. Email is trimmed/lowercased and unique; passwords retain whitespace and require 12–128 Unicode characters.
- Inject `PASSWORD_HASHER` through `AuthModule.register()`: Node uses native `argon2`, Workers use statically bundled `argon2-wasm-edge`. Preserve Unicode/NUL/whitespace and test both implementations against each other. Store Argon2id password hashes and SHA-256 hashes of opaque refresh tokens. Never persist plaintext credentials or refresh tokens.
- One active session per user. Login replaces its session ID, invalidating prior access and refresh tokens on subsequent checks.
- Access JWTs use HS256, verified issuer/audience, and at most 15 minutes of validity, capped by session expiry. The guard also checks the session in D1 on every protected request.
- Refresh sessions expire seven days after sign-in. Rotation preserves session ID and absolute expiry. Atomic conditional updates allow one concurrent refresh to succeed; replay returns 401 without revoking the replacement.
- Registration inserts the user and session atomically using a D1 batch. Preserve normalized-email uniqueness under concurrent registrations.
- Keep generic login failures, sanitized storage errors, per-IP throttling, and `Cache-Control: no-store` for auth responses. Rate limits are per Nest process/Worker isolate; do not assume they coordinate across replicas. Worker counters use timestamps, never background timers. Only the Worker trusts Cloudflare’s `CF-Connecting-IP`; never trust arbitrary forwarded headers in shared/Node code.
- Do not silently enable proxy trust or change client-IP handling.

## Cloudflare data and cache

- The default Worker runs the full Nest API and injects native `drizzle-orm/d1` through `@nestjs/drizzle`, with `DB` and `CACHE` bindings. It needs no proxy token or URLs. The optional Node runtime retains `sqlite-proxy` and `wrangler.proxy.jsonc`, authenticated with `D1_PROXY_TOKEN`.
- Preserve `env.DB.withSession('first-primary')` for authoritative reads, particularly immediate session invalidation. Never cache a D1 session/bookmark across requests; the Worker database facade creates a session for each query builder.
- Use Drizzle parameterized queries. Interactive `db.transaction()` calls are unsupported across the proxy; use `db.batch()` for atomic fixed statements or conditional updates for races.
- Add tables under `src/db/schema/`, export through `src/db/schema.ts`, and generate/review migrations. Preserve existing applied migrations; make subsequent changes through new migrations.
- Timestamps use SQLite integer `timestamp_ms` columns, application `Date` values, and ISO strings in API responses. Set `updatedAt` explicitly when modifying records.
- `npm run db:migrate` targets **remote D1** using environment credentials. It is not the local test migration command. For local work use explicit `wrangler d1 execute DB --local --file <migration.sql>` or the isolated auth test harness.
- KV is eventually consistent. Use it for cacheable data that tolerates stale reads, never authoritative auth/session state or immediate invalidation.
- Cache TTLs are milliseconds; `0` means no expiration. Preserve the adapter's logical expiry behavior and `nest-cache:` namespace isolation. Response caching is opt-in.

## Worker deployment and runtime

- `wrangler.jsonc` deploys `rebirth-dungeon-server`. `wrangler.proxy.jsonc` belongs only to the optional Node data proxy. Never replace the API entrypoint with the proxy.
- `npm run deploy` / `worker:deploy` publish the API; `proxy:dev` runs the optional data proxy; `test:worker` tests the real API in local workerd with temporary D1.
- Boot Nest lazily in the first request: Nest initialization uses randomness unavailable in global scope. Cache only the application, with startup failure recovery, never request-specific state.
- The Worker uses Express with `cloudflare:node` HTTP adaptation. Do not patch dependencies or enable unsafe runtime evaluation.
- Preserve `tools/build-worker-assets.mjs` to serve the exact locked Scalar UI locally in both runtimes. Never hand-edit the generated `dist/worker/scalar.js.txt`.
- Required Worker secrets: `JWT_ACCESS_SECRET`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_EMAIL_API_TOKEN`. Sender vars are in Wrangler config; `.dev.vars` is local only. Validate configuration without network calls.
- Worker errors must be sanitized; never log raw request bodies, credentials, SQL parameter values, or raw startup exceptions. Preserve the email service’s safe outcome logs. Cloudflare logs/traces replace the Node-only Observe instrumentation.
- Password hashing requires adequate Worker CPU allowance (plan for Workers Paid); local runtime success does not establish production CPU limits or remote delivery.

## React Email templates

- Use **React Email** for new transactional email templates instead of embedding HTML strings in controllers, services, or commands.
- Store React Email `.tsx` components in `src/email/templates/`. Use default exports, typed props, and non-sensitive `PreviewProps`; keep rendering helpers outside the templates folder.
- Use `EmailService.sendTemplate({ to, subject, template, replyTo? })` for component templates. It renders HTML once, generates matching plain text, and uses the existing Cloudflare transport. Raw-content `send()` remains supported.
- Import components/rendering from the installed `react-email` package. TypeScript uses `react-jsx`; relative imports still end in `.js`. Templates compile into `dist/email/templates/`.
- Follow `src/email/templates/test-email.tsx` for the component structure: `Html`, `Head`, `Preview`, `Body`, and content components imported from `react-email`. Keep subjects alongside their templates as exported constants when appropriate.
- Use email-compatible inline styles and absolute URLs for links and images. React must escape dynamic text; avoid raw HTML injection and network calls in templates. Rendering errors are sanitized as `TEMPLATE_RENDER_FAILED` and must not trigger delivery or retries.
- `npm run email:dev` previews templates locally on port 3001 without credentials or sending. `npm run email:test -- --to <address>` sends the sample template and has the same authorization requirements as any real email.
- Verify HTML and plain-text content, dynamic-value escaping, sanitized rendering failures, and transport integration with fake delivery. Preview visual changes with `npm run email:dev`; do not use real sends for routine verification. Format `.tsx` files alongside `.ts` files.
- Keep templates presentation-only: prepare their data in services and use `renderEmailTemplate()` for rendering. `EmailService.sendTemplate()` passes both rendered formats through the existing validation and Cloudflare transport; do not duplicate provider calls in templates.

## Email, configuration, and logging

- `EmailModule` exports the internal `EmailService`; consuming feature modules must import it. Sending uses Cloudflare REST directly, not the Worker proxy.
- Startup requires valid `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_EMAIL_API_TOKEN`, and `EMAIL_FROM`. `EMAIL_FROM_NAME` defaults to `Rebirth Dungeon`; `.env.example` uses `noreply@rebirthdungeon.com`.
- Keep the email API token, D1 API token, Worker proxy token, and JWT secret separate. JWT secrets must contain at least 32 bytes. Validate configuration without network requests during startup.
- Use `.env.example` and `.dev.vars.example` to document variables, with blank secrets. Never print or commit `.env`, `.dev.vars`, credentials, or secret-bearing request data.
- Preserve typed email outcomes: delivered, queued, permanent bounces, and suppressed recipients. A successful HTTP response or queued result does not prove inbox delivery.
- Sending has a 10-second timeout and no automatic retries. An uncertain response may follow an accepted email; retries could duplicate delivery.
- Automated tests must use fake email transports or mocked fetch. `npm run email:test -- --to <address>` sends a **real email**; only run it when the task authorizes sending to the specified recipient.
- Preserve sanitized errors and Observe redaction. Never log passwords, tokens, database parameter values containing credentials, email recipients, subjects, or message bodies. Email logs contain safe codes, duration, and outcome counts.
- Deployment, remote migration, DNS/resource changes, and real email sending have external effects. Keep routine verification local; perform external actions only when authorized by the task.
- For integration changes, consult current official NestJS, Zod, Drizzle, and Cloudflare documentation and installed package APIs. Use relevant available Cloudflare/Firecrawl skills rather than assuming older API behavior.

## Commands and verification

Run from the server repository root:

| Command                                | Purpose                                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm ci`                               | Install the locked dependencies.                                                                      |
| `npm run build`                        | Compile Nest into `dist/` and generate the local Scalar asset.                                        |
| `npm run start:dev`                    | Run Nest in watch mode; requires application configuration.                                           |
| `npm run worker:dev`                   | Run the full Nest API in workerd locally (port 8787).                                                 |
| `npm run lint`                         | Type-aware linting of `src/` and `test/`.                                                             |
| `npm test`                             | Vitest unit tests (`*.spec.ts`).                                                                      |
| `npm run test:e2e`                     | Express routes, validation, Scalar UI/assets, and OpenAPI tests.                                      |
| `npm run test:auth`                    | Build and test the compiled app against temporary local Wrangler/D1; cleans up its own test database. |
| `npm run email:dev`                    | Preview React Email templates locally at `http://localhost:3001`; no sending or credentials required. |
| `npm run email:test -- --to <address>` | Send the sample template through Cloudflare to an authorized recipient; requires email configuration. |
| `npm run worker:types`                 | Regenerate Worker types after binding/config changes.                                                 |
| `npm run worker:check`                 | Build/type-check the full API and type-check the optional proxy.                                      |
| `npm run worker:dry-run`               | Bundle/check Worker deployment without publishing.                                                    |
| `npm run db:generate`                  | Generate migrations/snapshots after schema changes; review the output.                                |
| `npx prettier --write <changed-files>` | Format touched files; verify with `--check`.                                                          |

### Development workflow

1. Inspect the affected paths, current tests, and repository status; make the smallest coherent change.
2. Add or update behavior-focused tests for changed logic. Cover validation, error handling, authorization, and concurrency when relevant. Documentation-only changes do not require application tests.
3. For application code, run build, lint, and affected unit tests. Run `test:e2e` for routes, validation, Scalar/OpenAPI, or shared bootstrap changes.
4. Run `test:auth` and `test:worker` for auth, schema, database, bootstrap, or root-module changes that could affect either runtime. It uses compiled Nest code to exercise production decorator metadata.
5. For Worker changes, run `worker:check` and `worker:dry-run`, plus affected local integration checks. Regenerate types when bindings change.
6. Keep network services mocked in unit tests. Use dummy valid email configuration and override `EMAIL_TRANSPORT` in app tests; never weaken production startup validation to make tests pass.
7. Report what changed, checks performed, and any remaining blocker or unverified behavior. Do not claim remote deployment or real email delivery from local tests.

Keep this guide and `README.md` aligned when architecture, commands, configuration, or public contracts change. Use concise English descriptions for commits when the task calls for a commit.
