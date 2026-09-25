# Rebirth Dungeon API

Hono on Cloudflare Workers, with Cloudflare D1, Drizzle ORM, and JWT authentication for the game client.

## Local setup

Use Node.js 22 or later and pnpm 10.11.1 (pinned in `package.json`). From this directory:

```sh
pnpm install
cp .dev.vars.example .dev.vars
```

Set `JWT_ACCESS_SECRET` in `.dev.vars` to a locally generated secret with at least 32 random bytes. Keep an existing `.dev.vars` instead of overwriting it. Production uses the existing Worker secret of the same name; changing it would invalidate issued access tokens.

```sh
pnpm db:migrate:local
pnpm dev
```

The API runs at http://localhost:8787. Local development explicitly uses local D1, with state in `.wrangler/state/v3`. API docs are at [localhost:8787/docs](http://localhost:8787/docs); the OpenAPI document is at [localhost:8787/openapi.json](http://localhost:8787/openapi.json).

If local tables already exist without migration history, `db:migrate:local` stops. Run `pnpm db:baseline:local` once: it verifies that the existing table definitions match the original migration, records that migration, and preserves account data. It refuses to baseline a different schema.

## Explore the interactive reference

The public [Scalar reference](http://localhost:8787/docs) is generated from the same Hono routes and Zod schemas as [OpenAPI 3.1](http://localhost:8787/openapi.json). Its examples, error responses, and response headers describe the running API. Interactive requests target the server hosting the docs, including after deployment.

1. Start `pnpm dev`, open `/docs`, and expand **Register** (new account) or **Login** (existing account).
2. Select **Test Request**, replace the fictional credentials with a disposable local account, and send the request.
3. Copy `accessToken` from the response into Scalar's **Bearer Token** input. Paste only the token, without `Bearer `. Send **Get the current user** to verify authentication.
4. Open **Refresh**, replace the placeholder body with the latest `refreshToken`, and send once. Replace both the bearer token and stored refresh token using the response. Concurrent refresh requests or reuse of the old token return `401`.
5. Send **Logout** last. A successful `204` has no body; subsequent requests using the revoked session return `401`.

Scalar authentication persistence is disabled; re-enter the token after reloading. All example accounts are fictional and the token strings are unusable placeholders. Sending a request changes data on the selected server, so use local disposable accounts when exploring. The reference also explains the fixed seven-day deadline, one-session-per-user policy, rate limits, error recovery, and all token fields.

## Authentication contract

Requests and responses use JSON. Access tokens go in `Authorization: Bearer <accessToken>`. Refresh tokens go in the JSON body; no cookies are used.

| Endpoint              | Input                                                                     | Success                              |
| --------------------- | ------------------------------------------------------------------------- | ------------------------------------ |
| `POST /auth/register` | `{ "email": "player@example.com", "password": "a long secure password" }` | `201`, account created and signed in |
| `POST /auth/login`    | Same credentials                                                          | `200`, previous session replaced     |
| `POST /auth/refresh`  | `{ "refreshToken": "..." }`                                               | `200`, new token pair                |
| `GET /auth/me`        | Bearer access token                                                       | `200`, `{ "user": { ... } }`         |
| `POST /auth/logout`   | Bearer access token                                                       | `204`, session revoked               |

Register, login, and refresh return:

```json
{
  "user": {
    "id": "user UUID",
    "email": "player@example.com",
    "createdAt": "2026-09-24T12:00:00.000Z",
    "updatedAt": "2026-09-24T12:00:00.000Z"
  },
  "accessToken": "signed JWT",
  "refreshToken": "opaque token",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "refreshTokenExpiresAt": "2026-10-01T12:00:00.000Z"
}
```

- Email is trimmed and lowercased. Passwords contain 12–128 Unicode characters; spaces and other characters are preserved. Unknown input fields and invalid JSON are rejected. Request bodies are limited to 4 KiB.
- A user has one active session. A new login changes its session ID and immediately invalidates previous access and refresh tokens on subsequent requests. Logout revokes that session. Already authorized requests can finish.
- JWTs use HS256, issuer `rebirth-dungeon-server`, audience `rebirth-dungeon-game`, and required `sub`, `sid`, `iat`, and `exp` claims. They expire after at most 15 minutes, capped by the session deadline.
- Sessions expire exactly seven days after login. Refresh rotates the token but preserves the session ID and deadline. Existing access tokens within that same session remain valid until expiry.
- Refresh tokens are 32 random bytes encoded as base64url; D1 stores only SHA-256 hashes. Passwords use Argon2id PHC strings with 19,456 KiB memory, two iterations, parallelism one, 16-byte salts, and 32-byte digests, matching the previous server.
- The client must serialize refresh requests and replace its stored refresh token after every successful refresh. Exactly one concurrent refresh succeeds. A consumed token returns `401`; it does not revoke the winning session. If the successful response is lost, sign in again. The schema stores no historical token family.
- Keep tokens in platform-secure client storage and use HTTPS outside local development. After session expiry or revocation, return to login. No Defold client changes are included here.
- All authentication responses use `Cache-Control: no-store`. Passwords and token values are excluded from application logs.

Errors have the shape `{ "statusCode": 401, "message": "Invalid credentials", "error": "Unauthorized" }`. Status codes include `400` validation, `401` authentication, `409` duplicate email, `413` oversized body, `429` rate limit, and `503` unavailable storage/configuration/rate limiter. Unexpected errors return a sanitized `500`. Unknown email and wrong password produce identical login errors and both perform password verification.

Register/login are limited to 10 requests per endpoint/IP/minute; refresh is limited to 30. Cloudflare rate-limit bindings are approximate and local to each Cloudflare location. Rejections include `Retry-After: 60`. Local requests without `CF-Connecting-IP` share the local bucket. No permissive browser CORS or cookie authentication is configured.

## Database and migrations

The Worker uses the existing `DB` binding for D1 database `rebirth-dungeon` (`b8b044ef-47f2-4dec-9a13-11ce5c2ee31e`). Authentication queries use the D1 binding directly, which reads the primary; no session cache or read replica is used for revocation decisions.

The supplied `users` and `auth_sessions` schemas are preserved, including the user-keyed session primary key, unique email/session/token hash, cascading deletion, and millisecond timestamp mappings. The original `20260923195301_chunky_sumo` migration and snapshot are unchanged. Its legacy SQL represents text primary keys without an explicit `NOT NULL` clause; the supplied Drizzle source retains `.notNull()`. This setup does not rebuild existing tables or change account data.

```sh
pnpm db:generate       # Generate SQL after an intentional schema change
pnpm db:migrate:local  # Apply to local D1 using __drizzle_migrations
```

For remote tooling, copy `.env.example` to `.env` only if it does not already exist. Set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_DATABASE_ID`, and `CLOUDFLARE_D1_TOKEN` for the existing database. These are tooling credentials, not runtime bindings.

```sh
pnpm db:check:remote   # Read-only: verify the applied migration names, hashes, and timestamps
pnpm db:migrate:remote # Apply only reviewed pending migrations after the same verification
```

Both commands verify that the target database matches the Worker binding. Remote migration refuses missing or mismatched history and does nothing when no migrations are pending. Do not use `drizzle-kit push`, edit applied migration files, reset the database, or switch this database to Wrangler's `d1_migrations` ledger. Never run tests against remote D1.

## Validation and deployment

```sh
pnpm cf-typegen
pnpm typecheck
pnpm test
pnpm format:check
pnpm deploy:dry-run
```

Integration tests execute in Workers with isolated local D1 and the real SQL migrations. They cover legacy password/JWT compatibility, validation, transaction rollback, concurrent registration and refresh, expiry, replacement/logout revocation, cascading deletion, rate limits, and failure handling. A password benchmark exercises the actual WASM implementation; local timing is not a production CPU guarantee.

With `pnpm dev` running, a separate terminal can exercise all five endpoints over HTTP:

```sh
pnpm test:smoke
# For a different local port:
LOCAL_API_ORIGIN=http://127.0.0.1:8790 pnpm test:smoke
```

The smoke test permits loopback HTTP only and deletes its own synthetic account from the default local D1 afterward. Run it against the default local persistence directory, not a server started with a custom `--persist-to` directory.

Before a production release, verify migration history, review any pending SQL, confirm the existing Worker secret and bindings, and benchmark password hashing against the deployed Worker's CPU budget. Run `pnpm deploy` only when ready to publish. Logs and sampled traces are enabled. This implementation has not deployed or modified production data or secrets.

Password reset, email verification, OAuth, and game-client integration are outside this setup.

## Background jobs with Cloudflare Queues

The same Worker serves HTTP and consumes `rebirth-dungeon-jobs` through the `APP_QUEUE` binding. `pnpm dev` simulates both locally; no remote queue is required for local development.

In Scalar, sign in, paste the access token into **Bearer Token**, and open **Queues → Enqueue an example background job**. Send:

```json
{ "message": "Hello from the game client" }
```

`POST /queues/example` returns `202` with `{ "jobId": "<UUID>", "status": "queued" }` only after publication succeeds. This means accepted, not completed. Find `queue_job_completed` in the local terminal or Worker logs, matching `jobId` or the response's `X-Request-Id`. The example has no persistent side effects and does not log the message text. It has no job-status endpoint.

The endpoint requires a current authenticated session, rejects unknown fields, limits messages to 1–256 characters and request bodies to 4 KiB, and allows approximately 10 requests per user per minute per Cloudflare location. A throttled request returns `429` with `Retry-After: 60`. Queue or limiter failures return `503`; all responses include `Cache-Control: no-store` and `X-Request-Id`. Authentication errors retain the existing API error format. Logout does not cancel work already accepted.

The consumer handles messages individually in batches of up to 10, waiting at most five seconds to fill a batch. Success is acknowledged; processing failures and invalid messages retry up to three times with a 30-second delay, then move to `rebirth-dungeon-jobs-dlq`. Structured failure logs include a safe category and queue message ID; valid jobs also include the job ID, request ID, and type. Raw payloads and exception details are excluded.

Delivery is at least once, ordering is not guaranteed, and duplicate deliveries may create duplicate completion logs. Repeating an HTTP submission creates a new job. Even a publication error can have an uncertain outcome: a retry may enqueue a duplicate. Before implementing state-changing jobs, add idempotent processing using the stable job ID and a transaction or downstream idempotency key. Do not assume queue publication is atomic with a D1 write.

To add a job type, extend the versioned Zod envelope and inferred type, provide a typed producer, add a consumer dispatch case, and test validation, duplicate delivery, and retry behavior. Queue inputs are validated again at consumption, including jobs submitted outside this API. Never put passwords or access/refresh tokens in job payloads.

### Remote setup and failure investigation

Before a future deployment, create the queues in the intended Cloudflare account:

```sh
pnpm exec wrangler queues create rebirth-dungeon-jobs
pnpm exec wrangler queues create rebirth-dungeon-jobs-dlq
```

These are remote resource commands; ordinary local development and tests do not run them. The queue consumer configuration and rate-limit binding are deployed with the Worker. No database migration is required.

The dead-letter queue has no automatic consumer. Inspect it in the Cloudflare dashboard and correlate failed message IDs with `queue_job_failed` logs. Check backlog, retry counts, message age, and the DLQ during operations. Messages expire according to the queue's retention setting, so investigate promptly. Fix the cause before manually resubmitting a validated job to the main queue; preserve its job ID and account for duplicate processing. This integration adds no automatic replay or purge operation.

## Email templates and test sending

React Email templates live in `src/email/templates`. The example uses the subject **Rebirth Dungeon — Test email**, a personalized greeting, and a “no action required” notice. The shared renderer creates both HTML and plain text. The reusable `sendTestEmail(env, input)` service uses Cloudflare's structured `EMAIL.send()` binding and returns its message ID; no HTTP endpoint or queue job sends email automatically.

```sh
pnpm email:dev
```

Open [the template preview](http://localhost:3000) and select `test-email`. Previewing never sends email. Use the project command below for Cloudflare sending; the preview UI’s Send button is not configured for Cloudflare.

To render and exercise the sending service with local simulation:

```sh
pnpm email:test --to preview@example.com
pnpm email:test --to preview@example.com --name Adventurer
```

Simulation is the default and does not deliver mail. It explicitly disables remote bindings and uses disposable local state. Wrangler may print the example message and save local preview files; avoid sensitive template content during local testing.

To send **one real email** to an inbox you control:

```sh
pnpm email:test --to YOUR_REAL_ADDRESS --name Adventurer --send
```

The explicit `--send` option invokes the installed Wrangler Email Sending command using your existing Cloudflare authentication and the same rendered HTML and plain text. It sends immediately and reports Cloudflare's result; acceptance does not confirm inbox delivery. Failures exit nonzero. There are no automatic retries because an uncertain failure may already have accepted the message. Use `pnpm email:test --help` for command usage.

The sender defaults to **Rebirth Dungeon <noreply@rebirthdungeon.com>**. `rebirthdungeon.com` already has Email Sending enabled. To change the sender, update `EMAIL_FROM`, `EMAIL_FROM_NAME`, and `send_email.allowed_sender_addresses` in `wrangler.jsonc`, then run `pnpm cf-typegen`. The new sender's domain must be enabled for Cloudflare Email Sending. Local `.dev.vars` overrides are applied by Wrangler's simulation; live CLI sends use the sender configured in `wrangler.jsonc`.

The `EMAIL` binding has `remote: false`, so ordinary local development simulates delivery. On a deployed Worker it uses Cloudflare Email Sending, with no separate API key required. Live command testing does not deploy the Worker or change DNS. If sending is rejected, check Wrangler's account authentication, sender-domain status, recipient restrictions/suppression, and provider limits in Cloudflare Email Sending. Application service errors are sanitized; use Cloudflare's email logs to investigate provider details.

The initial verification uses simulation only. Authentication, signup behavior, queues, and the database are unchanged; there are no password-reset, inbound email, or marketing flows.

### Cloudflare build dependency installation

The project pins pnpm 10.11.1 to match the Cloudflare Workers build image. Keep `pnpm-workspace.yaml` and the single-document `pnpm-lock.yaml` committed. Use `pnpm install --frozen-lockfile` to verify the build installation locally. If you have configured a `PNPM_VERSION` build variable, set it to `10.11.1` as well. Avoid rewriting this lockfile with a different pnpm major version; upgrade the local and Cloudflare versions together.
