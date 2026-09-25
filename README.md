# Rebirth Dungeon API

Hono on Cloudflare Workers, with Cloudflare D1, Drizzle ORM, and JWT authentication for the game client.

## Local setup

Use Node.js 22 or later and pnpm. From this directory:

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
