# Auth (Login/Registration) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real login/registration to IT Playground, gating `/` and `/play/*` behind a session cookie, as the foundation for future per-account grade history.

**Architecture:** SQLite file (`data/app.db`, gitignored) via `better-sqlite3` holds a single `users` table. Passwords hashed with `bcryptjs`. Sessions are signed JWTs (via `jose`) in an httpOnly cookie — no server-side session table. `middleware.ts` gates protected routes by verifying that cookie.

**Tech Stack:** Next.js 14 App Router, TypeScript, `better-sqlite3`, `bcryptjs`, `jose`, Jest (existing setup).

## Global Constraints

- Local-only tool, single practical user — no OAuth, no password reset flow (spec non-goals).
- `data/` directory and `AUTH_SECRET` env var are gitignored/local-only, same as `.env.local`.
- `/api/scenario/*` routes stay unauthenticated in this plan — wiring `userId` into them is a future subsystem, not this one.
- Password minimum length: 8 characters. Same generic "Wrong email or password." message for both "no such user" and "wrong password" on login — never reveal which.
- `middleware.ts` only imports from `lib/session.ts`, never `lib/auth.ts` or `lib/db.ts` — keeps password hashing and SQLite out of its dependency graph.
- Route handlers that touch the database mock `lib/db.ts` in tests, the same way existing route tests mock `lib/openrouter.ts` (see `app/api/scenario/start/route.test.ts` for the pattern).

---

## File Structure

```
data/                          # gitignored — SQLite file lives here
lib/
  db.ts                        # better-sqlite3 connection + users table
  auth.ts                      # hashPassword, verifyPassword (bcryptjs)
  auth.test.ts
  session.ts                   # JWT session tokens + cookie parsing (jose)
  session.test.ts
app/
  login/page.tsx
  register/page.tsx
  api/
    auth/
      register/route.ts
      register/route.test.ts
      login/route.ts
      login/route.test.ts
      logout/route.ts
      logout/route.test.ts
      me/route.ts
      me/route.test.ts
middleware.ts
components/
  NavBar.tsx                   # modified: shows email + logout when authenticated
```

---

### Task 1: Dependencies + env secret + gitignore

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `.env.local` (not committed — gitignored)

**Interfaces:**
- Produces: `better-sqlite3`, `bcryptjs`, `jose` available to import; `AUTH_SECRET` available via `process.env.AUTH_SECRET` for later tasks.

- [ ] **Step 1: Install dependencies**

Run: `npm install better-sqlite3 bcryptjs jose`
Run: `npm install -D @types/better-sqlite3 @types/bcryptjs`
Expected: all four installs succeed, `package.json` and `package-lock.json` updated.

- [ ] **Step 2: Add `data/` to `.gitignore`**

Add this line to `.gitignore`:

```
data/
```

- [ ] **Step 3: Generate and add `AUTH_SECRET` to `.env.local`**

Run (generates a random 32-byte hex secret):
```bash
node -e "console.log('AUTH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))" >> .env.local
```
Expected: `.env.local` now has an `AUTH_SECRET=<64 hex chars>` line. Verify with:
Run: `grep AUTH_SECRET .env.local`
Expected: prints the line (this file is gitignored — do not commit it).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "$(cat <<'EOF'
Add auth dependencies (better-sqlite3, bcryptjs, jose)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `lib/session.ts` — JWT session tokens + cookie parsing

**Files:**
- Create: `lib/session.ts`
- Create: `lib/session.test.ts`

**Interfaces:**
- Consumes: `AUTH_SECRET` from `process.env`.
- Produces: `SessionPayload` type (`{ userId: number; email: string }`); `SESSION_COOKIE_NAME: string` (`"session"`); `SESSION_DURATION_SECONDS: number` (`60 * 60 * 24 * 30`); `createSessionToken(payload: SessionPayload): Promise<string>`; `verifySessionToken(token: string): Promise<SessionPayload | null>`; `getCookieValue(request: Request, name: string): string | undefined`. Tasks 4-6 (register/login) and Task 8 (middleware) and Task 7 (me route) import from here.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/session.test.ts
import { SignJWT } from "jose";
import {
  createSessionToken,
  verifySessionToken,
  getCookieValue,
  SESSION_COOKIE_NAME,
} from "./session";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, AUTH_SECRET: "test-secret-at-least-32-bytes-long-ok" };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("createSessionToken / verifySessionToken", () => {
  it("round-trips a payload through a signed token", async () => {
    const token = await createSessionToken({ userId: 42, email: "a@b.com" });
    const payload = await verifySessionToken(token);
    expect(payload).toEqual({ userId: 42, email: "a@b.com" });
  });

  it("returns null for a garbage token", async () => {
    const payload = await verifySessionToken("not-a-real-token");
    expect(payload).toBeNull();
  });

  it("returns null for a token signed with a different secret", async () => {
    const key = new TextEncoder().encode("a-completely-different-secret-value");
    const token = await new SignJWT({ userId: 1, email: "x@y.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(key);
    const payload = await verifySessionToken(token);
    expect(payload).toBeNull();
  });

  it("returns null for an expired token", async () => {
    const key = new TextEncoder().encode(process.env.AUTH_SECRET as string);
    const expiredToken = await new SignJWT({ userId: 1, email: "x@y.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(key);
    const payload = await verifySessionToken(expiredToken);
    expect(payload).toBeNull();
  });
});

describe("getCookieValue", () => {
  it("extracts a named cookie from the Cookie header", () => {
    const request = new Request("http://localhost/", {
      headers: { cookie: `other=1; ${SESSION_COOKIE_NAME}=abc123; another=2` },
    });
    expect(getCookieValue(request, SESSION_COOKIE_NAME)).toBe("abc123");
  });

  it("returns undefined when the cookie is absent", () => {
    const request = new Request("http://localhost/", { headers: { cookie: "other=1" } });
    expect(getCookieValue(request, SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("returns undefined when there is no Cookie header at all", () => {
    const request = new Request("http://localhost/");
    expect(getCookieValue(request, SESSION_COOKIE_NAME)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest lib/session.test.ts`
Expected: FAIL — `Cannot find module './session'`.

- [ ] **Step 3: Write `lib/session.ts`**

```typescript
import { SignJWT, jwtVerify } from "jose";

export interface SessionPayload {
  userId: number;
  email: string;
}

export const SESSION_COOKIE_NAME = "session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set. Add it to .env.local.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId, email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.userId !== "number" || typeof payload.email !== "string") {
      return null;
    }
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

export function getCookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  const match = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : undefined;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest lib/session.test.ts`
Expected: PASS, 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/session.ts lib/session.test.ts
git commit -m "$(cat <<'EOF'
Add JWT session token and cookie parsing helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `lib/auth.ts` — password hashing

**Files:**
- Create: `lib/auth.ts`
- Create: `lib/auth.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `hashPassword(password: string): Promise<string>`; `verifyPassword(password: string, hash: string): Promise<boolean>`. Tasks 5-6 (register/login routes) import from here.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/auth.test.ts
import { hashPassword, verifyPassword } from "./auth";

describe("hashPassword / verifyPassword", () => {
  it("round-trips: a hash verifies against its original password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    await expect(verifyPassword("correct-horse-battery-staple", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password against the hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("produces a different hash each time (salted)", async () => {
    const hashA = await hashPassword("same-input");
    const hashB = await hashPassword("same-input");
    expect(hashA).not.toBe(hashB);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest lib/auth.test.ts`
Expected: FAIL — `Cannot find module './auth'`.

- [ ] **Step 3: Write `lib/auth.ts`**

```typescript
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest lib/auth.test.ts`
Expected: PASS, 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts lib/auth.test.ts
git commit -m "$(cat <<'EOF'
Add password hashing helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `lib/db.ts` — SQLite connection + users table

**Files:**
- Create: `lib/db.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `UserRow` type (`{ id: number; email: string; password_hash: string; created_at: string }`); `findUserByEmail(email: string): UserRow | undefined`; `createUser(email: string, passwordHash: string): UserRow`. Tasks 5-6 (register/login routes) import from here and mock this module in their tests.
- No dedicated test file — this module is a thin wrapper around `better-sqlite3` (itself well-tested upstream) and is mocked in every route test that uses it, per the Global Constraints.

- [ ] **Step 1: Write `lib/db.ts`**

```typescript
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "app.db");

let db: Database.Database | null = null;

function ensureDataDir(): void {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getDb(): Database.Database {
  if (db) return db;
  ensureDataDir();
  db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  return db;
}

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}

export function findUserByEmail(email: string): UserRow | undefined {
  return getDb().prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
}

export function createUser(email: string, passwordHash: string): UserRow {
  const info = getDb()
    .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
    .run(email, passwordHash);
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid) as UserRow;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db.ts
git commit -m "$(cat <<'EOF'
Add SQLite connection and users table

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `/api/auth/register` route

**Files:**
- Create: `app/api/auth/register/route.ts`
- Create: `app/api/auth/register/route.test.ts`

**Interfaces:**
- Consumes: `findUserByEmail`, `createUser` from `@/lib/db`; `hashPassword` from `@/lib/auth`; `createSessionToken`, `SESSION_COOKIE_NAME`, `SESSION_DURATION_SECONDS` from `@/lib/session`.
- Produces: `POST` handler at `/api/auth/register`. Request body `{ email: string, password: string }`. Response `201 { user: { id, email } }` (with `Set-Cookie` header) | `400 { error }` | `409 { error }`. The register page (Task 10) calls this endpoint.

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/auth/register/route.test.ts
import { POST } from "./route";
import * as db from "@/lib/db";

jest.mock("@/lib/db");

const mockedFindUserByEmail = db.findUserByEmail as jest.Mock;
const mockedCreateUser = db.createUser as jest.Mock;

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, AUTH_SECRET: "test-secret-at-least-32-bytes-long-ok" };
  mockedFindUserByEmail.mockReset();
  mockedCreateUser.mockReset();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("POST /api/auth/register", () => {
  it("returns 400 for an invalid email", async () => {
    const res = await POST(makeRequest({ email: "not-an-email", password: "longenough" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a password under 8 characters", async () => {
    const res = await POST(makeRequest({ email: "a@b.com", password: "short" }));
    expect(res.status).toBe(400);
  });

  it("returns 409 when the email is already registered", async () => {
    mockedFindUserByEmail.mockReturnValue({ id: 1, email: "a@b.com", password_hash: "x", created_at: "now" });
    const res = await POST(makeRequest({ email: "a@b.com", password: "longenough" }));
    expect(res.status).toBe(409);
  });

  it("creates the user, sets a session cookie, and returns 201", async () => {
    mockedFindUserByEmail.mockReturnValue(undefined);
    mockedCreateUser.mockReturnValue({ id: 7, email: "new@b.com", password_hash: "hashed", created_at: "now" });

    const res = await POST(makeRequest({ email: "new@b.com", password: "longenough" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user).toEqual({ id: 7, email: "new@b.com" });
    expect(mockedCreateUser).toHaveBeenCalledWith("new@b.com", expect.any(String));
    expect(res.headers.get("set-cookie")).toContain("session=");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest app/api/auth/register/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write `app/api/auth/register/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { createUser, findUserByEmail } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from "@/lib/session";

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Passwords must be at least 8 characters." }, { status: 400 });
  }
  if (findUserByEmail(email)) {
    return NextResponse.json({ error: "That email's already registered." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = createUser(email, passwordHash);
  const token = await createSessionToken({ userId: user.id, email: user.email });

  const res = NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 201 });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
  });
  return res;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest app/api/auth/register/route.test.ts`
Expected: PASS, 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/register
git commit -m "$(cat <<'EOF'
Add /api/auth/register route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `/api/auth/login` route

**Files:**
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/login/route.test.ts`

**Interfaces:**
- Consumes: `findUserByEmail` from `@/lib/db`; `verifyPassword` from `@/lib/auth`; `createSessionToken`, `SESSION_COOKIE_NAME`, `SESSION_DURATION_SECONDS` from `@/lib/session`.
- Produces: `POST` handler at `/api/auth/login`. Request body `{ email: string, password: string }`. Response `200 { user: { id, email } }` (with `Set-Cookie` header) | `401 { error }`. The login page (Task 11) calls this endpoint.

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/auth/login/route.test.ts
import { POST } from "./route";
import * as db from "@/lib/db";
import { hashPassword } from "@/lib/auth";

jest.mock("@/lib/db");

const mockedFindUserByEmail = db.findUserByEmail as jest.Mock;

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, AUTH_SECRET: "test-secret-at-least-32-bytes-long-ok" };
  mockedFindUserByEmail.mockReset();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("POST /api/auth/login", () => {
  it("returns 401 when no user has that email", async () => {
    mockedFindUserByEmail.mockReturnValue(undefined);
    const res = await POST(makeRequest({ email: "nobody@b.com", password: "whatever1" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when the password is wrong", async () => {
    const hash = await hashPassword("correct-password");
    mockedFindUserByEmail.mockReturnValue({ id: 1, email: "a@b.com", password_hash: hash, created_at: "now" });
    const res = await POST(makeRequest({ email: "a@b.com", password: "wrong-password" }));
    expect(res.status).toBe(401);
  });

  it("returns 200 with a session cookie on a correct password", async () => {
    const hash = await hashPassword("correct-password");
    mockedFindUserByEmail.mockReturnValue({ id: 1, email: "a@b.com", password_hash: hash, created_at: "now" });
    const res = await POST(makeRequest({ email: "a@b.com", password: "correct-password" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toEqual({ id: 1, email: "a@b.com" });
    expect(res.headers.get("set-cookie")).toContain("session=");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest app/api/auth/login/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write `app/api/auth/login/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from "@/lib/session";

const INVALID_CREDENTIALS_MESSAGE = "Wrong email or password.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
  }

  const user = findUserByEmail(email);
  if (!user) {
    return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
  }

  const token = await createSessionToken({ userId: user.id, email: user.email });
  const res = NextResponse.json({ user: { id: user.id, email: user.email } }, { status: 200 });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
  });
  return res;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest app/api/auth/login/route.test.ts`
Expected: PASS, 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/login
git commit -m "$(cat <<'EOF'
Add /api/auth/login route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `/api/auth/logout` and `/api/auth/me` routes

**Files:**
- Create: `app/api/auth/logout/route.ts`
- Create: `app/api/auth/logout/route.test.ts`
- Create: `app/api/auth/me/route.ts`
- Create: `app/api/auth/me/route.test.ts`

**Interfaces:**
- Consumes: `SESSION_COOKIE_NAME`, `getCookieValue`, `verifySessionToken` from `@/lib/session`.
- Produces: `POST` handler at `/api/auth/logout` — clears the session cookie, `200 { ok: true }`. `GET` handler at `/api/auth/me` — `200 { user: { id, email } }` | `401 { error }`. The NavBar (Task 12) calls both.

- [ ] **Step 1: Write the failing tests**

```typescript
// app/api/auth/logout/route.test.ts
import { POST } from "./route";

describe("POST /api/auth/logout", () => {
  it("clears the session cookie and returns ok", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(res.headers.get("set-cookie")).toContain("session=;");
  });
});
```

```typescript
// app/api/auth/me/route.test.ts
import { GET } from "./route";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, AUTH_SECRET: "test-secret-at-least-32-bytes-long-ok" };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

function makeRequest(cookieHeader?: string) {
  return new Request("http://localhost/api/auth/me", {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

describe("GET /api/auth/me", () => {
  it("returns 401 when there is no session cookie", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when the session cookie is invalid", async () => {
    const res = await GET(makeRequest(`${SESSION_COOKIE_NAME}=garbage`));
    expect(res.status).toBe(401);
  });

  it("returns the user when the session cookie is valid", async () => {
    const token = await createSessionToken({ userId: 3, email: "a@b.com" });
    const res = await GET(makeRequest(`${SESSION_COOKIE_NAME}=${token}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toEqual({ id: 3, email: "a@b.com" });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest app/api/auth/logout/route.test.ts app/api/auth/me/route.test.ts`
Expected: FAIL — `Cannot find module './route'` for both.

- [ ] **Step 3: Write `app/api/auth/logout/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST() {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
```

- [ ] **Step 4: Write `app/api/auth/me/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export async function GET(request: Request) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  return NextResponse.json({ user: { id: session.userId, email: session.email } }, { status: 200 });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest app/api/auth/logout/route.test.ts app/api/auth/me/route.test.ts`
Expected: PASS, 1 + 3 tests passing.

- [ ] **Step 6: Commit**

```bash
git add app/api/auth/logout app/api/auth/me
git commit -m "$(cat <<'EOF'
Add /api/auth/logout and /api/auth/me routes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `middleware.ts` — route protection

**Files:**
- Create: `middleware.ts`

**Interfaces:**
- Consumes: `getCookieValue`, `verifySessionToken`, `SESSION_COOKIE_NAME` from `@/lib/session`.
- Produces: redirects unauthenticated requests to `/` and `/play/*` to `/login`. No automated test (Next.js middleware needs a running server to test meaningfully — covered by manual browser verification in Task 13, per spec).

- [ ] **Step 1: Write `middleware.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getCookieValue, verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/play/:path*"],
};
```

- [ ] **Step 2: Verify the project builds**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "$(cat <<'EOF'
Add middleware gating / and /play/* behind a session cookie

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `/login` page

**Files:**
- Create: `app/login/page.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks directly (calls `/api/auth/login` over `fetch`).
- Produces: the `/login` route — email/password form, redirects to `/` on success, links to `/register`.

- [ ] **Step 1: Write `app/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setSubmitting(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="font-display text-2xl font-bold" style={{ color: "var(--ink)" }}>
        Log in
      </h1>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
        />
        {error && (
          <p className="text-sm" style={{ color: "var(--warn)" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="cursor-pointer rounded-lg px-4 py-2 text-sm font-bold"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p className="mt-4 text-sm" style={{ color: "var(--ink-muted)" }}>
        No account yet?{" "}
        <Link href="/register" style={{ color: "var(--accent)" }}>
          Create one
        </Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Verify the project builds**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add app/login
git commit -m "$(cat <<'EOF'
Add login page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: `/register` page

**Files:**
- Create: `app/register/page.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks directly (calls `/api/auth/register` over `fetch`).
- Produces: the `/register` route — email/password form, redirects to `/` on success, links to `/login`.

- [ ] **Step 1: Write `app/register/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setSubmitting(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="font-display text-2xl font-bold" style={{ color: "var(--ink)" }}>
        Create account
      </h1>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
        />
        <input
          type="password"
          required
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
        />
        {error && (
          <p className="text-sm" style={{ color: "var(--warn)" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="cursor-pointer rounded-lg px-4 py-2 text-sm font-bold"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-sm" style={{ color: "var(--ink-muted)" }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "var(--accent)" }}>
          Log in
        </Link>
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Verify the project builds**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add app/register
git commit -m "$(cat <<'EOF'
Add registration page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Update `NavBar` — show logged-in email + logout

**Files:**
- Modify: `components/NavBar.tsx`

**Interfaces:**
- Consumes: `GET /api/auth/me`, `POST /api/auth/logout`.
- Produces: modified `<NavBar />` — now a Client Component. Shows the logged-in user's email and a "Log out" button when `/api/auth/me` succeeds; shows nothing extra otherwise. This is the last task; nothing downstream depends on it.

- [ ] **Step 1: Read the current `components/NavBar.tsx`**

Run: `cat components/NavBar.tsx` (or open it) — confirm it currently renders a static brand link + "Queue" link with no auth awareness, so you're modifying the right baseline.

- [ ] **Step 2: Rewrite `components/NavBar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function NavBar() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body) setEmail(body.user.email);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mx-auto flex max-w-3xl items-center justify-between px-8 py-3">
        <Link href="/" className="font-display text-base font-bold" style={{ color: "var(--ink)" }}>
          IT Playground
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/" className="font-mono text-xs uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
            Queue
          </Link>
          {email && (
            <>
              <span className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>
                {email}
              </span>
              <button
                onClick={handleLogout}
                className="cursor-pointer font-mono text-xs uppercase tracking-wide"
                style={{ color: "var(--ink-muted)", background: "none", border: "none" }}
              >
                Log out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Verify the project builds**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add components/NavBar.tsx
git commit -m "$(cat <<'EOF'
Show logged-in email and logout button in nav bar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: End-to-end smoke test

**Files:**
- None created — verification only.

**Interfaces:**
- Consumes: the full running app from Tasks 1-11.
- Produces: confidence the whole auth flow works end-to-end before calling the feature done.

- [ ] **Step 1: Run the full test suite**

Run: `npx jest`
Expected: all suites pass, including the new `lib/session.test.ts`, `lib/auth.test.ts`, and the four `app/api/auth/*/route.test.ts` files.

- [ ] **Step 2: Run a production build**

Run: `npm run build`
Expected: build succeeds with no type or lint errors.

- [ ] **Step 3: Browser walkthrough**

Run: `npm run dev` (background), then in a browser:
1. Visit `http://localhost:3000/` — expect redirect to `/login` (no session cookie yet).
2. Click "Create one", register with a new email + an 8+ character password — expect redirect to `/`, ticket queue loads, NavBar shows your email.
3. Click "Log out" — expect redirect to `/login`.
4. Visit `http://localhost:3000/` directly again — expect redirect to `/login` (confirms middleware is gating, not just the login page's own logic).
5. Log in with the same email/password — expect redirect to `/`, NavBar shows your email again.
6. Try registering the same email again — expect "That email's already registered." error, no redirect.
7. Try logging in with the right email but a wrong password — expect "Wrong email or password." error, no redirect.

Stop the dev server after confirming all seven steps.

- [ ] **Step 4: Final commit (if Step 3 surfaced any fixes)**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Fix issues found during auth end-to-end smoke test

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
(Skip this commit if no changes were needed.)

---

## Self-Review Notes

- **Spec coverage:** Data model (Task 4), all four auth flows (Tasks 5-7), pages (Tasks 9-10), NavBar (Task 11), middleware gating (Task 8), error copy matches spec verbatim ("That email's already registered.", "Passwords must be at least 8 characters.", "Wrong email or password."), testing plan matches spec's file list exactly (`lib/auth.test.ts`, `lib/session.test.ts`, four route test files, no middleware test).
- **Placeholder scan:** none — every step has runnable code and exact commands.
- **Type consistency:** `SessionPayload` (`{ userId: number; email: string }`) used identically in `lib/session.ts`, and by every route that calls `createSessionToken`/`verifySessionToken`. `UserRow` (`{ id, email, password_hash, created_at }`) defined once in `lib/db.ts`, consumed identically in register/login routes. `SESSION_COOKIE_NAME` and `SESSION_DURATION_SECONDS` imported from `lib/session.ts` everywhere they're used (register, login, logout, me, middleware) — no route redefines them.
