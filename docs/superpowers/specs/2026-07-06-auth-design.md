# Auth (Login/Registration) Design

## Context

First of four planned subsystems for IT Playground: (1) auth/accounts — this spec, (2) persistent grades/progress tied to accounts, (3) real-world scenario content, (4) HTML virtual-PC simulation UI. This spec covers only auth. Local-only tool, single practical user (not a multi-tenant deployment), but user wants real login/registration UI and account-gated access as the foundation for future per-account grade history.

## Non-goals

- No OAuth/social login.
- No password reset flow (no email sending infrastructure exists; out of scope).
- No grades/progress storage yet (subsystem 2) — `/api/scenario/*` routes are unchanged and stay unauthenticated in this spec; wiring `userId` into them happens when subsystem 2 adds grade history.
- No deployment/hosting changes — SQLite file is fine because this stays local.

## Architecture

- **Database:** SQLite file at `data/app.db` via `better-sqlite3` (sync API, zero external services, matches "local only"). `data/` gitignored, like `.env.local`.
- **Password hashing:** `bcrypt`, 10 rounds.
- **Session:** signed JWT (via `jose`) in an httpOnly, sameSite=lax cookie. No server-side session table — the token itself carries `{ userId, email }` and a 30-day expiry. Secret read from a new `AUTH_SECRET` env var in `.env.local` (generated once, gitignored, never committed).
- **Route protection:** `middleware.ts` at the project root checks the session cookie on every request to `/` and `/play/*`; redirects to `/login` if missing/invalid. Server-side gate — no flash-of-unauthenticated-content.

## Data model

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`lib/db.ts` owns the `better-sqlite3` connection and runs this migration on first access if the table doesn't exist yet (no migration framework needed for one table).

## Auth flows

- **`POST /api/auth/register`** — body `{ email, password }`. Validates email shape and password length (≥ 8 chars) → `400` on failure. Checks email uniqueness → `409` if taken. Hashes password, inserts row, issues session cookie, returns `{ user: { id, email } }`, `201`.
- **`POST /api/auth/login`** — body `{ email, password }`. Looks up user, `bcrypt.compare`s password. `401` on any mismatch (same generic message for "no such user" and "wrong password" — don't leak which). On success, issues session cookie, returns `{ user }`, `200`.
- **`POST /api/auth/logout`** — clears the cookie, `200`.
- **`GET /api/auth/me`** — reads + verifies the cookie, returns `{ user }` or `401`. Used by the nav bar to show the logged-in email / a logout button.

`lib/auth.ts` holds the pure, testable pieces: `hashPassword`, `verifyPassword`, `createSessionToken`, `verifySessionToken` — same pattern as `lib/parsing.ts`'s pure functions, unit-testable without a request/response.

## Pages

- **`/login`** — email + password fields, link to `/register`. On submit, `POST /api/auth/login`; on success, redirect to `/`.
- **`/register`** — email + password fields, link to `/login`. On submit, `POST /api/auth/register`; on success, redirect to `/`.
- **NavBar** — shows the logged-in email + a "Log out" link when authenticated (fetches `/api/auth/me` on mount).

## Error handling

Same friendly-copy pattern already used on the play page (`friendlyError` in `app/play/[category]/page.tsx`):
- Register 409 → "That email's already registered."
- Register 400 (short password) → "Passwords must be at least 8 characters."
- Login 401 → "Wrong email or password."
- Middleware redirect → lands on `/login`, no error banner needed (nothing went wrong, just unauthenticated).

## Testing

Following the existing repo pattern (`lib/*.test.ts`, `app/api/**/route.test.ts`):
- `lib/auth.test.ts` — hash/verify roundtrip, token create/verify roundtrip, expired/tampered token rejection.
- `app/api/auth/register/route.test.ts`, `.../login/route.test.ts`, `.../logout/route.test.ts`, `.../me/route.test.ts` — mock `lib/db.ts` the same way existing route tests mock `lib/openrouter.ts`.
- No test for `middleware.ts` itself (Next.js middleware testing needs a running server; out of proportion for this feature — covered by manual browser verification instead).

## New dependencies

`better-sqlite3`, `bcrypt`, `jose`, plus `@types/better-sqlite3` and `@types/bcrypt` as dev deps.
