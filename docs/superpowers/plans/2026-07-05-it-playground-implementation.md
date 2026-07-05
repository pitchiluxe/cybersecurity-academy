# IT Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js web app where a trainee practices being IT support against an LLM-played frustrated end-user, across 6 scenario categories, with AI grading at the end of each session.

**Architecture:** Next.js App Router + TypeScript, single project, no database, no auth. Three server-only API routes proxy OpenRouter (creds from `.env.local`); the client holds all session state (seed + transcript) in React state and resends it on every call — the server never remembers anything between requests.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS for layout utilities, plain CSS custom properties in `globals.css` for the design-token system (colors/type/theme), Jest + ts-jest for unit tests on the parsing/prompt/openrouter logic only (no UI test suite — matches spec).

## Global Constraints

- Node.js already installed: v22.21.1 / npm 11.5.2 — use as-is, no version pinning needed.
- Env vars read **server-side only**: `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_MODEL` (from `.env.local`, already gitignored — never read these in a Client Component or expose them to the browser).
- OpenRouter endpoint is OpenAI-compatible chat completions: `${ANTHROPIC_BASE_URL}/v1/chat/completions` (i.e. `https://openrouter.ai/api/v1/chat/completions` with the current `.env.local` value), `Authorization: Bearer ${ANTHROPIC_AUTH_TOKEN}`, body `{ model: ANTHROPIC_MODEL, messages: [...] }`.
- No database, no auth, no session persistence — all state lives in client React state for the lifetime of the tab (per spec's Non-goals).
- Six fixed scenario categories, ids: `network`, `printer`, `password`, `app-crash`, `malware`, `hardware` (per spec).
- Domain roles in a transcript are `"tech"` (the trainee) and `"enduser"` (the AI persona) — never conflate these with the OpenRouter API's own `system"/"user"/"assistant"` message roles used internally when building prompts.
- Every LLM call that expects JSON back must tolerate the model wrapping it in prose or markdown fences, and must retry the LLM call exactly once on parse failure before surfacing a `502`.
- `rootCause` on the `ScenarioSeed` must never be rendered in the UI until the grading step returns a result.

---

## File Structure

```
package.json
tsconfig.json
next.config.mjs
tailwind.config.ts
postcss.config.mjs
jest.config.ts
jest.setup.ts
app/
  layout.tsx
  globals.css
  page.tsx                       # scenario picker
  play/[category]/page.tsx       # ticket/chat session (Client Component)
  api/
    scenario/
      start/route.ts
      reply/route.ts
      grade/route.ts
lib/
  types.ts                       # ScenarioCategory, ScenarioSeed, TranscriptMessage, GradeResult, RubricItem
  parsing.ts                     # extractJsonFromText, parseScenarioSeed, parseGradeResult, ParseError
  parsing.test.ts
  scenarios.ts                   # SCENARIO_CATEGORIES, isScenarioCategory, buildStartMessages/buildReplyMessages/buildGradeMessages
  scenarios.test.ts
  openrouter.ts                  # callOpenRouter, ChatMessage, MissingApiKeyError, OpenRouterRequestError
  openrouter.test.ts
components/
  ScenarioCard.tsx
  TicketHeader.tsx
  Sidebar.tsx
  ChatBubble.tsx
  ResolutionBanner.tsx
public/
  fonts/
    BricolageGrotesque-Bold.ttf
    WorkSans-Regular.ttf
    WorkSans-Bold.ttf
    JetBrainsMono-Regular.ttf
    JetBrainsMono-Bold.ttf
```

---

### Task 1: Project scaffold boots

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/page.tsx`

**Interfaces:**
- Produces: a running Next.js dev server on `http://localhost:3000` that later tasks add routes/pages under.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "it-playground",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "jest"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "typescript": "5.5.4",
    "@types/node": "20.14.15",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "tailwindcss": "3.4.7",
    "postcss": "8.4.40",
    "autoprefixer": "10.4.19",
    "jest": "29.7.0",
    "ts-jest": "29.2.4",
    "@types/jest": "29.5.12"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `next.config.mjs`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Write `tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};

export default config;
```

- [ ] **Step 5: Write `postcss.config.mjs`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Write `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg: #EDF1EE;
  --surface: #FFFFFF;
  --surface-2: #E3E9E2;
  --ink: #121A18;
  --ink-muted: #4A5754;
  --ink-faint: #7C8B87;
  --border: #D5DCD3;
  --accent: #1F6F6B;
  --accent-ink: #FFFFFF;
  --accent-soft: #DCEEEC;
  --accent-line: #BFE0DD;
  --warn: #A85417;
  --warn-soft: #F7E6D6;
  --warn-line: #E7C49B;
  --good: #2E7D46;
  --good-soft: #DDEEE1;
  --good-line: #B9DCC3;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0D1211;
    --surface: #141B19;
    --surface-2: #1B2422;
    --ink: #E7ECE9;
    --ink-muted: #9BA9A5;
    --ink-faint: #6C7B77;
    --border: #263130;
    --accent: #4FBDB6;
    --accent-ink: #06201E;
    --accent-soft: rgba(79, 189, 182, 0.12);
    --accent-line: rgba(79, 189, 182, 0.35);
    --warn: #E08A3C;
    --warn-soft: rgba(224, 138, 60, 0.12);
    --warn-line: rgba(224, 138, 60, 0.4);
    --good: #52B776;
    --good-soft: rgba(82, 183, 118, 0.12);
    --good-line: rgba(82, 183, 118, 0.4);
  }
}

:root[data-theme="dark"] {
  --bg: #0D1211;
  --surface: #141B19;
  --surface-2: #1B2422;
  --ink: #E7ECE9;
  --ink-muted: #9BA9A5;
  --ink-faint: #6C7B77;
  --border: #263130;
  --accent: #4FBDB6;
  --accent-ink: #06201E;
  --accent-soft: rgba(79, 189, 182, 0.12);
  --accent-line: rgba(79, 189, 182, 0.35);
  --warn: #E08A3C;
  --warn-soft: rgba(224, 138, 60, 0.12);
  --warn-line: rgba(224, 138, 60, 0.4);
  --good: #52B776;
  --good-soft: rgba(82, 183, 118, 0.12);
  --good-line: rgba(82, 183, 118, 0.4);
}

body {
  background: var(--bg);
  color: var(--ink);
}
```

- [ ] **Step 7: Write `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IT Playground",
  description: "Practice being IT support against an AI end-user.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Write a placeholder `app/page.tsx`**

```tsx
export default function Home() {
  return (
    <main className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold">IT Playground</h1>
      <p className="text-[var(--ink-muted)] mt-2">Scenario picker goes here.</p>
    </main>
  );
}
```

- [ ] **Step 9: Install dependencies**

Run: `npm install`
Expected: installs without error, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 10: Verify the dev server boots**

Run: `npm run dev` (start in background / separate terminal), then in another shell:
Run: `curl -s http://localhost:3000 | grep "IT Playground"`
Expected: output contains `IT Playground`. Stop the dev server after confirming.

- [ ] **Step 11: Commit**

```bash
git add package.json tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs app
git commit -m "$(cat <<'EOF'
Scaffold Next.js app shell

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Shared types + JSON parsing helpers

**Files:**
- Create: `lib/types.ts`
- Create: `lib/parsing.ts`
- Create: `lib/parsing.test.ts`
- Create: `jest.config.ts`
- Create: `jest.setup.ts`

**Interfaces:**
- Produces: `ScenarioCategory`, `ScenarioSeed`, `TranscriptMessage`, `RubricItem`, `GradeResult` (types); `ParseError` (class); `extractJsonFromText(text: string): string`; `parseScenarioSeed(text: string, category: ScenarioCategory): ScenarioSeed`; `parseGradeResult(text: string): GradeResult`. All later tasks import these from `@/lib/types` and `@/lib/parsing`.

- [ ] **Step 1: Write `jest.config.ts`**

```typescript
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEach: [],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
};

export default config;
```

- [ ] **Step 2: Write `jest.setup.ts`**

```typescript
// No global setup needed yet; present so jest.config.ts's setup hook has a target.
export {};
```

- [ ] **Step 3: Write `lib/types.ts`**

```typescript
export type ScenarioCategory =
  | "network"
  | "printer"
  | "password"
  | "app-crash"
  | "malware"
  | "hardware";

export interface ScenarioSeed {
  category: ScenarioCategory;
  persona: { name: string; department: string };
  environment: { os: string; device: string; detail: string };
  rootCause: string;
  openingMessage: string;
}

export interface TranscriptMessage {
  role: "tech" | "enduser";
  content: string;
}

export interface RubricItem {
  item: string;
  met: boolean;
  note: string;
}

export interface GradeResult {
  score: number;
  resolved: boolean;
  rubric: RubricItem[];
  feedback: string;
}
```

- [ ] **Step 4: Write the failing test for `extractJsonFromText`**

```typescript
// lib/parsing.test.ts
import { extractJsonFromText, parseScenarioSeed, parseGradeResult, ParseError } from "./parsing";

describe("extractJsonFromText", () => {
  it("returns the text unchanged when it is already bare JSON", () => {
    const input = '{"a":1}';
    expect(extractJsonFromText(input)).toBe('{"a":1}');
  });

  it("strips a markdown fenced json block", () => {
    const input = 'Sure, here you go:\n```json\n{"a":1}\n```\nHope that helps!';
    expect(extractJsonFromText(input)).toBe('{"a":1}');
  });

  it("extracts the outermost braces when there is surrounding prose with no fence", () => {
    const input = 'Here is the object: {"a":1} — let me know if you need more.';
    expect(extractJsonFromText(input)).toBe('{"a":1}');
  });

  it("throws ParseError when no JSON object is present", () => {
    expect(() => extractJsonFromText("no json here")).toThrow(ParseError);
  });
});

describe("parseScenarioSeed", () => {
  const validPayload = JSON.stringify({
    persona: { name: "Maria Chen", department: "Marketing" },
    environment: { os: "Windows 11", device: "Latitude 5540", detail: "GlobalProtect 6.2.1" },
    rootCause: "TAP adapter driver corrupted by cumulative update",
    openingMessage: "My VPN won't connect this morning.",
  });

  it("parses a valid payload into a ScenarioSeed with the given category", () => {
    const seed = parseScenarioSeed(validPayload, "network");
    expect(seed).toEqual({
      category: "network",
      persona: { name: "Maria Chen", department: "Marketing" },
      environment: { os: "Windows 11", device: "Latitude 5540", detail: "GlobalProtect 6.2.1" },
      rootCause: "TAP adapter driver corrupted by cumulative update",
      openingMessage: "My VPN won't connect this morning.",
    });
  });

  it("throws ParseError when a required field is missing", () => {
    const missingField = JSON.stringify({
      persona: { name: "Maria Chen", department: "Marketing" },
      environment: { os: "Windows 11", device: "Latitude 5540", detail: "x" },
      openingMessage: "My VPN won't connect.",
      // rootCause missing
    });
    expect(() => parseScenarioSeed(missingField, "network")).toThrow(ParseError);
  });
});

describe("parseGradeResult", () => {
  const validPayload = JSON.stringify({
    score: 82,
    resolved: true,
    rubric: [{ item: "Asked clarifying questions", met: true, note: "Asked about OS and error text." }],
    feedback: "Solid diagnostic path, verified the fix before closing.",
  });

  it("parses a valid payload into a GradeResult", () => {
    const result = parseGradeResult(validPayload);
    expect(result.score).toBe(82);
    expect(result.resolved).toBe(true);
    expect(result.rubric).toHaveLength(1);
    expect(result.feedback).toContain("Solid diagnostic path");
  });

  it("throws ParseError when score is out of range", () => {
    const badScore = JSON.stringify({ score: 150, resolved: true, rubric: [], feedback: "x" });
    expect(() => parseGradeResult(badScore)).toThrow(ParseError);
  });

  it("throws ParseError when rubric is not an array", () => {
    const badRubric = JSON.stringify({ score: 50, resolved: false, rubric: "none", feedback: "x" });
    expect(() => parseGradeResult(badRubric)).toThrow(ParseError);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx jest lib/parsing.test.ts`
Expected: FAIL — `Cannot find module './parsing'` (file doesn't exist yet).

- [ ] **Step 6: Write `lib/parsing.ts`**

```typescript
import type { ScenarioCategory, ScenarioSeed, GradeResult } from "./types";

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

export function extractJsonFromText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : text;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new ParseError(`No JSON object found in text: ${text.slice(0, 200)}`);
  }
  return candidate.slice(start, end + 1);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ParseError(`Expected non-empty string for "${field}", got: ${JSON.stringify(value)}`);
  }
  return value;
}

export function parseScenarioSeed(text: string, category: ScenarioCategory): ScenarioSeed {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonFromText(text));
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw new ParseError(`Failed to JSON.parse scenario seed: ${(err as Error).message}`);
  }

  if (typeof raw !== "object" || raw === null) {
    throw new ParseError("Scenario seed payload was not a JSON object");
  }
  const obj = raw as Record<string, unknown>;

  const persona = obj.persona as Record<string, unknown> | undefined;
  const environment = obj.environment as Record<string, unknown> | undefined;
  if (typeof persona !== "object" || persona === null) {
    throw new ParseError('Missing or invalid "persona" object');
  }
  if (typeof environment !== "object" || environment === null) {
    throw new ParseError('Missing or invalid "environment" object');
  }

  return {
    category,
    persona: {
      name: requireString(persona.name, "persona.name"),
      department: requireString(persona.department, "persona.department"),
    },
    environment: {
      os: requireString(environment.os, "environment.os"),
      device: requireString(environment.device, "environment.device"),
      detail: requireString(environment.detail, "environment.detail"),
    },
    rootCause: requireString(obj.rootCause, "rootCause"),
    openingMessage: requireString(obj.openingMessage, "openingMessage"),
  };
}

export function parseGradeResult(text: string): GradeResult {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonFromText(text));
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw new ParseError(`Failed to JSON.parse grade result: ${(err as Error).message}`);
  }

  if (typeof raw !== "object" || raw === null) {
    throw new ParseError("Grade result payload was not a JSON object");
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.score !== "number" || obj.score < 0 || obj.score > 100) {
    throw new ParseError(`"score" must be a number 0-100, got: ${JSON.stringify(obj.score)}`);
  }
  if (typeof obj.resolved !== "boolean") {
    throw new ParseError(`"resolved" must be a boolean, got: ${JSON.stringify(obj.resolved)}`);
  }
  if (!Array.isArray(obj.rubric)) {
    throw new ParseError(`"rubric" must be an array, got: ${JSON.stringify(obj.rubric)}`);
  }
  if (typeof obj.feedback !== "string" || obj.feedback.trim() === "") {
    throw new ParseError('"feedback" must be a non-empty string');
  }

  const rubric = obj.rubric.map((entry, i) => {
    if (typeof entry !== "object" || entry === null) {
      throw new ParseError(`rubric[${i}] is not an object`);
    }
    const e = entry as Record<string, unknown>;
    return {
      item: requireString(e.item, `rubric[${i}].item`),
      met: Boolean(e.met),
      note: requireString(e.note, `rubric[${i}].note`),
    };
  });

  return { score: obj.score, resolved: obj.resolved, rubric, feedback: obj.feedback };
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx jest lib/parsing.test.ts`
Expected: PASS, 8 tests passing.

- [ ] **Step 8: Commit**

```bash
git add lib/types.ts lib/parsing.ts lib/parsing.test.ts jest.config.ts jest.setup.ts package.json
git commit -m "$(cat <<'EOF'
Add shared types and LLM JSON response parsing helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: OpenRouter client

**Files:**
- Create: `lib/openrouter.ts`
- Create: `lib/openrouter.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `ChatMessage` type (`{ role: "system" | "user" | "assistant"; content: string }`); `MissingApiKeyError`; `OpenRouterRequestError` (has `.status: number`); `callOpenRouter(messages: ChatMessage[]): Promise<string>`. Route handler tasks (4, 5, 6) import `callOpenRouter`, `ChatMessage`, `MissingApiKeyError`, `OpenRouterRequestError` from `@/lib/openrouter`.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/openrouter.test.ts
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "./openrouter";

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.ANTHROPIC_BASE_URL = "https://openrouter.ai/api";
  process.env.ANTHROPIC_AUTH_TOKEN = "test-token";
  process.env.ANTHROPIC_MODEL = "deepseek/deepseek-v4-flash:free";
  global.fetch = jest.fn();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.resetAllMocks();
});

describe("callOpenRouter", () => {
  it("posts to the v1 chat completions endpoint with the right headers and body", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "hello back" } }] }),
    });

    const result = await callOpenRouter([{ role: "user", content: "hi" }]);

    expect(result).toBe("hello back");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
        }),
      })
    );
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({
      model: "deepseek/deepseek-v4-flash:free",
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("throws MissingApiKeyError when ANTHROPIC_AUTH_TOKEN is empty", async () => {
    process.env.ANTHROPIC_AUTH_TOKEN = "";
    await expect(callOpenRouter([{ role: "user", content: "hi" }])).rejects.toThrow(MissingApiKeyError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("throws OpenRouterRequestError with the response status on a non-2xx response", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "rate limited" }),
    });

    await expect(callOpenRouter([{ role: "user", content: "hi" }])).rejects.toMatchObject({
      status: 429,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest lib/openrouter.test.ts`
Expected: FAIL — `Cannot find module './openrouter'`.

- [ ] **Step 3: Write `lib/openrouter.ts`**

```typescript
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_AUTH_TOKEN is not set. Add it to .env.local.");
    this.name = "MissingApiKeyError";
  }
}

export class OpenRouterRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "OpenRouterRequestError";
    this.status = status;
  }
}

export async function callOpenRouter(messages: ChatMessage[]): Promise<string> {
  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  const token = process.env.ANTHROPIC_AUTH_TOKEN;
  const model = process.env.ANTHROPIC_MODEL;

  if (!token) {
    throw new MissingApiKeyError();
  }
  if (!baseUrl || !model) {
    throw new OpenRouterRequestError(500, "ANTHROPIC_BASE_URL or ANTHROPIC_MODEL is not configured");
  }

  const url = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new OpenRouterRequestError(
      response.status,
      `OpenRouter request failed (${response.status}): ${JSON.stringify(errBody)}`
    );
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new OpenRouterRequestError(502, "OpenRouter response had no message content");
  }
  return content;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest lib/openrouter.test.ts`
Expected: PASS, 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/openrouter.ts lib/openrouter.test.ts
git commit -m "$(cat <<'EOF'
Add OpenRouter chat completions client

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Scenario categories + prompt builders

**Files:**
- Create: `lib/scenarios.ts`
- Create: `lib/scenarios.test.ts`

**Interfaces:**
- Consumes: `ScenarioCategory`, `ScenarioSeed`, `TranscriptMessage` from `@/lib/types`; `ChatMessage` from `@/lib/openrouter`.
- Produces: `SCENARIO_CATEGORIES: { id: ScenarioCategory; label: string; blurb: string }[]`; `isScenarioCategory(value: string): value is ScenarioCategory`; `buildStartMessages(category: ScenarioCategory): ChatMessage[]`; `buildReplyMessages(seed: ScenarioSeed, transcript: TranscriptMessage[]): ChatMessage[]`; `buildGradeMessages(seed: ScenarioSeed, transcript: TranscriptMessage[]): ChatMessage[]`. Route handler tasks (5, 6, 7) and the picker page (task 9) import from `@/lib/scenarios`.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/scenarios.test.ts
import { SCENARIO_CATEGORIES, isScenarioCategory, buildStartMessages, buildReplyMessages, buildGradeMessages } from "./scenarios";
import type { ScenarioSeed, TranscriptMessage } from "./types";

describe("SCENARIO_CATEGORIES", () => {
  it("has exactly the six fixed categories", () => {
    expect(SCENARIO_CATEGORIES.map((c) => c.id).sort()).toEqual(
      ["app-crash", "hardware", "malware", "network", "password", "printer"].sort()
    );
  });
});

describe("isScenarioCategory", () => {
  it("accepts a known category id", () => {
    expect(isScenarioCategory("network")).toBe(true);
  });
  it("rejects an unknown string", () => {
    expect(isScenarioCategory("spaceship")).toBe(false);
  });
});

describe("buildStartMessages", () => {
  it("includes the category label and a JSON schema instruction", () => {
    const messages = buildStartMessages("printer");
    const system = messages.find((m) => m.role === "system");
    expect(system).toBeDefined();
    expect(system!.content).toContain("Printer");
    expect(system!.content).toContain("rootCause");
    expect(system!.content).toContain("openingMessage");
  });
});

const seed: ScenarioSeed = {
  category: "network",
  persona: { name: "Maria Chen", department: "Marketing" },
  environment: { os: "Windows 11", device: "Latitude 5540", detail: "GlobalProtect 6.2.1" },
  rootCause: "TAP adapter driver corrupted by cumulative update",
  openingMessage: "My VPN won't connect this morning.",
};

const transcript: TranscriptMessage[] = [
  { role: "enduser", content: seed.openingMessage },
  { role: "tech", content: "Can you tell me the exact error message?" },
];

describe("buildReplyMessages", () => {
  it("embeds the persona, environment, and root cause but instructs never to reveal the root cause outright", () => {
    const messages = buildReplyMessages(seed, transcript);
    const system = messages.find((m) => m.role === "system")!;
    expect(system.content).toContain("Maria Chen");
    expect(system.content).toContain("TAP adapter driver corrupted by cumulative update");
    expect(system.content.toLowerCase()).toContain("never state the root cause");
  });

  it("maps the transcript onto user/assistant turns from the end-user's point of view", () => {
    const messages = buildReplyMessages(seed, transcript);
    const turns = messages.filter((m) => m.role !== "system");
    expect(turns).toEqual([
      { role: "assistant", content: seed.openingMessage },
      { role: "user", content: "Can you tell me the exact error message?" },
    ]);
  });
});

describe("buildGradeMessages", () => {
  it("includes the fixed rubric items and the full transcript", () => {
    const messages = buildGradeMessages(seed, transcript);
    const system = messages.find((m) => m.role === "system")!;
    expect(system.content).toContain("clarifying questions");
    expect(system.content).toContain("score");
    const userMsg = messages.find((m) => m.role === "user")!;
    expect(userMsg.content).toContain("My VPN won't connect this morning.");
    expect(userMsg.content).toContain("Can you tell me the exact error message?");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest lib/scenarios.test.ts`
Expected: FAIL — `Cannot find module './scenarios'`.

- [ ] **Step 3: Write `lib/scenarios.ts`**

```typescript
import type { ScenarioCategory, ScenarioSeed, TranscriptMessage } from "./types";
import type { ChatMessage } from "./openrouter";

export const SCENARIO_CATEGORIES: { id: ScenarioCategory; label: string; blurb: string }[] = [
  { id: "network", label: "Network / Wi-Fi", blurb: "Connectivity drops, VPN failures, DNS issues." },
  { id: "printer", label: "Printer", blurb: "Offline printers, blank pages, driver errors." },
  { id: "password", label: "Password / MFA", blurb: "Lockouts, resets, multi-factor auth trouble." },
  { id: "app-crash", label: "Application Crash", blurb: "Software that won't launch or keeps crashing." },
  { id: "malware", label: "Malware / Quarantine", blurb: "Suspicious alerts, quarantined files, cleanup." },
  { id: "hardware", label: "Hardware Failure", blurb: "Blue screens, dead peripherals, boot failures." },
];

const CATEGORY_LABELS: Record<ScenarioCategory, string> = Object.fromEntries(
  SCENARIO_CATEGORIES.map((c) => [c.id, c.label])
) as Record<ScenarioCategory, string>;

export function isScenarioCategory(value: string): value is ScenarioCategory {
  return SCENARIO_CATEGORIES.some((c) => c.id === value);
}

const RUBRIC_DESCRIPTION = `- Asked relevant clarifying questions before proposing a fix
- Diagnostic steps were logical and in a sensible order
- Proposed fix actually addresses the hidden root cause
- Verified the fix before closing
- Professional, clear, empathetic tone throughout`;

export function buildStartMessages(category: ScenarioCategory): ChatMessage[] {
  const label = CATEGORY_LABELS[category];
  const system = `You are generating a training scenario for an IT helpdesk trainee, in the category "${label}".
Invent a plausible, specific, non-generic end-user persona and problem in this category. Make up a name, department, device/OS, and a concrete root cause a real technician could diagnose from symptoms alone.
Respond with ONLY a JSON object, no prose, no markdown fences, matching exactly this shape:
{
  "persona": { "name": "string", "department": "string" },
  "environment": { "os": "string", "device": "string", "detail": "string" },
  "rootCause": "string, the underlying technical cause — the trainee must never see this directly",
  "openingMessage": "string, the end-user's first message describing the problem in their own words, 2-4 sentences, no jargon"
}`;
  return [{ role: "system", content: system }];
}

function transcriptToTurns(transcript: TranscriptMessage[]): ChatMessage[] {
  return transcript.map((m) => ({
    role: m.role === "enduser" ? "assistant" : "user",
    content: m.content,
  }));
}

export function buildReplyMessages(seed: ScenarioSeed, transcript: TranscriptMessage[]): ChatMessage[] {
  const system = `You are roleplaying "${seed.persona.name}" (${seed.persona.department}) in an IT support chat, category "${CATEGORY_LABELS[seed.category]}".
Your device/environment: OS ${seed.environment.os}, device ${seed.environment.device}, detail: ${seed.environment.detail}.
The real underlying root cause of your problem is: ${seed.rootCause}.
Stay in character as the end-user. Answer the technician's questions plausibly based on the root cause, describing symptoms you would actually observe — never state the root cause outright, and never use technical jargon a typical end-user wouldn't know. If the technician's fix genuinely resolves the root cause, confirm it works. Keep replies to 1-3 sentences.`;
  return [{ role: "system", content: system }, ...transcriptToTurns(transcript)];
}

export function buildGradeMessages(seed: ScenarioSeed, transcript: TranscriptMessage[]): ChatMessage[] {
  const system = `You are grading an IT helpdesk trainee's performance in a "${CATEGORY_LABELS[seed.category]}" scenario.
The real root cause was: ${seed.rootCause}.
Score the transcript against this rubric:
${RUBRIC_DESCRIPTION}
Respond with ONLY a JSON object, no prose, no markdown fences, matching exactly this shape:
{
  "score": 0-100,
  "resolved": true or false,
  "rubric": [ { "item": "string", "met": true or false, "note": "string, 1 sentence" }, ... one entry per rubric point above ],
  "feedback": "string, 2-4 sentences of constructive feedback"
}`;

  const transcriptText = transcript
    .map((m) => `${m.role === "enduser" ? seed.persona.name : "Technician"}: ${m.content}`)
    .join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: transcriptText },
  ];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest lib/scenarios.test.ts`
Expected: PASS, 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/scenarios.ts lib/scenarios.test.ts
git commit -m "$(cat <<'EOF'
Add scenario categories and prompt builders

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `/api/scenario/start` route

**Files:**
- Create: `app/api/scenario/start/route.ts`
- Create: `app/api/scenario/start/route.test.ts`

**Interfaces:**
- Consumes: `isScenarioCategory`, `buildStartMessages` from `@/lib/scenarios`; `callOpenRouter`, `MissingApiKeyError`, `OpenRouterRequestError` from `@/lib/openrouter`; `parseScenarioSeed`, `ParseError` from `@/lib/parsing`.
- Produces: `POST` handler at `/api/scenario/start`. Request body `{ category: string }`. Response `200 { seed: ScenarioSeed }` | `400 { error }` | `502 { error }` | `503 { error }`. The play page (task 10) calls this endpoint.

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/scenario/start/route.test.ts
import { POST } from "./route";
import * as openrouter from "@/lib/openrouter";

jest.mock("@/lib/openrouter", () => {
  const actual = jest.requireActual("@/lib/openrouter");
  return { ...actual, callOpenRouter: jest.fn() };
});

const mockedCall = openrouter.callOpenRouter as jest.Mock;

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/scenario/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockedCall.mockReset();
});

describe("POST /api/scenario/start", () => {
  it("returns 400 for an unknown category", async () => {
    const res = await POST(makeRequest({ category: "spaceship" }));
    expect(res.status).toBe(400);
  });

  it("returns a parsed seed for a valid category", async () => {
    mockedCall.mockResolvedValue(
      JSON.stringify({
        persona: { name: "Maria Chen", department: "Marketing" },
        environment: { os: "Windows 11", device: "Latitude 5540", detail: "GlobalProtect 6.2.1" },
        rootCause: "TAP adapter driver corrupted by cumulative update",
        openingMessage: "My VPN won't connect this morning.",
      })
    );

    const res = await POST(makeRequest({ category: "network" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.seed.category).toBe("network");
    expect(body.seed.persona.name).toBe("Maria Chen");
  });

  it("retries once on malformed JSON and succeeds on the second attempt", async () => {
    mockedCall
      .mockResolvedValueOnce("not json at all")
      .mockResolvedValueOnce(
        JSON.stringify({
          persona: { name: "Alex Kim", department: "Finance" },
          environment: { os: "macOS 14", device: "MacBook Pro", detail: "n/a" },
          rootCause: "Corrupted font cache",
          openingMessage: "Excel keeps crashing when I open any file.",
        })
      );

    const res = await POST(makeRequest({ category: "app-crash" }));
    expect(res.status).toBe(200);
    expect(mockedCall).toHaveBeenCalledTimes(2);
  });

  it("returns 502 when both attempts return malformed JSON", async () => {
    mockedCall.mockResolvedValue("still not json");
    const res = await POST(makeRequest({ category: "network" }));
    expect(res.status).toBe(502);
    expect(mockedCall).toHaveBeenCalledTimes(2);
  });

  it("returns 503 when the API key is missing", async () => {
    mockedCall.mockRejectedValue(new openrouter.MissingApiKeyError());
    const res = await POST(makeRequest({ category: "network" }));
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest app/api/scenario/start/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write `app/api/scenario/start/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { isScenarioCategory, buildStartMessages } from "@/lib/scenarios";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import { parseScenarioSeed, ParseError } from "@/lib/parsing";
import type { ScenarioCategory } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const category = body?.category;

  if (typeof category !== "string" || !isScenarioCategory(category)) {
    return NextResponse.json({ error: "Unknown or missing scenario category" }, { status: 400 });
  }
  const validCategory: ScenarioCategory = category;

  const messages = buildStartMessages(validCategory);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callOpenRouter(messages);
      const seed = parseScenarioSeed(text, validCategory);
      return NextResponse.json({ seed }, { status: 200 });
    } catch (err) {
      if (err instanceof MissingApiKeyError) {
        return NextResponse.json({ error: err.message }, { status: 503 });
      }
      if (err instanceof OpenRouterRequestError) {
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
      if (err instanceof ParseError && attempt === 1) {
        return NextResponse.json({ error: `Could not parse scenario from model: ${err.message}` }, { status: 502 });
      }
      // ParseError on first attempt: fall through to retry.
    }
  }

  return NextResponse.json({ error: "Unreachable" }, { status: 500 });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest app/api/scenario/start/route.test.ts`
Expected: PASS, 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/api/scenario/start
git commit -m "$(cat <<'EOF'
Add /api/scenario/start route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `/api/scenario/reply` route

**Files:**
- Create: `app/api/scenario/reply/route.ts`
- Create: `app/api/scenario/reply/route.test.ts`

**Interfaces:**
- Consumes: `buildReplyMessages` from `@/lib/scenarios`; `callOpenRouter`, `MissingApiKeyError`, `OpenRouterRequestError` from `@/lib/openrouter`; `ScenarioSeed`, `TranscriptMessage` from `@/lib/types`.
- Produces: `POST` handler at `/api/scenario/reply`. Request body `{ seed: ScenarioSeed, transcript: TranscriptMessage[] }`. Response `200 { message: string }` | `400 { error }` | `502 { error }` | `503 { error }`. The play page (task 10) calls this after every trainee message.

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/scenario/reply/route.test.ts
import { POST } from "./route";
import * as openrouter from "@/lib/openrouter";
import type { ScenarioSeed } from "@/lib/types";

jest.mock("@/lib/openrouter", () => {
  const actual = jest.requireActual("@/lib/openrouter");
  return { ...actual, callOpenRouter: jest.fn() };
});

const mockedCall = openrouter.callOpenRouter as jest.Mock;

const seed: ScenarioSeed = {
  category: "network",
  persona: { name: "Maria Chen", department: "Marketing" },
  environment: { os: "Windows 11", device: "Latitude 5540", detail: "GlobalProtect 6.2.1" },
  rootCause: "TAP adapter driver corrupted by cumulative update",
  openingMessage: "My VPN won't connect this morning.",
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/scenario/reply", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockedCall.mockReset();
});

describe("POST /api/scenario/reply", () => {
  it("returns 400 when seed is missing", async () => {
    const res = await POST(makeRequest({ transcript: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when transcript is not an array", async () => {
    const res = await POST(makeRequest({ seed, transcript: "nope" }));
    expect(res.status).toBe(400);
  });

  it("returns the end-user's next message on success", async () => {
    mockedCall.mockResolvedValue("It says the network is unreachable.");
    const res = await POST(
      makeRequest({
        seed,
        transcript: [
          { role: "enduser", content: seed.openingMessage },
          { role: "tech", content: "What's the exact error message?" },
        ],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("It says the network is unreachable.");
  });

  it("returns 503 when the API key is missing", async () => {
    mockedCall.mockRejectedValue(new openrouter.MissingApiKeyError());
    const res = await POST(makeRequest({ seed, transcript: [] }));
    expect(res.status).toBe(503);
  });

  it("returns 502 on an upstream request failure", async () => {
    mockedCall.mockRejectedValue(new openrouter.OpenRouterRequestError(429, "rate limited"));
    const res = await POST(makeRequest({ seed, transcript: [] }));
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest app/api/scenario/reply/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write `app/api/scenario/reply/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { buildReplyMessages } from "@/lib/scenarios";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import type { ScenarioSeed, TranscriptMessage } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const seed = body?.seed as ScenarioSeed | undefined;
  const transcript = body?.transcript as TranscriptMessage[] | undefined;

  if (!seed || typeof seed !== "object") {
    return NextResponse.json({ error: "Missing seed" }, { status: 400 });
  }
  if (!Array.isArray(transcript)) {
    return NextResponse.json({ error: "transcript must be an array" }, { status: 400 });
  }

  try {
    const messages = buildReplyMessages(seed, transcript);
    const message = await callOpenRouter(messages);
    return NextResponse.json({ message }, { status: 200 });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof OpenRouterRequestError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest app/api/scenario/reply/route.test.ts`
Expected: PASS, 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/api/scenario/reply
git commit -m "$(cat <<'EOF'
Add /api/scenario/reply route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `/api/scenario/grade` route

**Files:**
- Create: `app/api/scenario/grade/route.ts`
- Create: `app/api/scenario/grade/route.test.ts`

**Interfaces:**
- Consumes: `buildGradeMessages` from `@/lib/scenarios`; `callOpenRouter`, `MissingApiKeyError`, `OpenRouterRequestError` from `@/lib/openrouter`; `parseGradeResult`, `ParseError` from `@/lib/parsing`; `ScenarioSeed`, `TranscriptMessage` from `@/lib/types`.
- Produces: `POST` handler at `/api/scenario/grade`. Request body `{ seed: ScenarioSeed, transcript: TranscriptMessage[] }`. Response `200 { result: GradeResult, rootCause: string }` | `400 { error }` | `502 { error }` | `503 { error }`. `rootCause` is echoed back from `seed.rootCause` so the client can reveal it alongside the grade. The play page (task 10) calls this when the trainee clicks "Resolve & Submit".

- [ ] **Step 1: Write the failing test**

```typescript
// app/api/scenario/grade/route.test.ts
import { POST } from "./route";
import * as openrouter from "@/lib/openrouter";
import type { ScenarioSeed } from "@/lib/types";

jest.mock("@/lib/openrouter", () => {
  const actual = jest.requireActual("@/lib/openrouter");
  return { ...actual, callOpenRouter: jest.fn() };
});

const mockedCall = openrouter.callOpenRouter as jest.Mock;

const seed: ScenarioSeed = {
  category: "network",
  persona: { name: "Maria Chen", department: "Marketing" },
  environment: { os: "Windows 11", device: "Latitude 5540", detail: "GlobalProtect 6.2.1" },
  rootCause: "TAP adapter driver corrupted by cumulative update",
  openingMessage: "My VPN won't connect this morning.",
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/scenario/grade", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockedCall.mockReset();
});

describe("POST /api/scenario/grade", () => {
  it("returns 400 when seed is missing", async () => {
    const res = await POST(makeRequest({ transcript: [] }));
    expect(res.status).toBe(400);
  });

  it("returns the parsed grade result plus the root cause on success", async () => {
    mockedCall.mockResolvedValue(
      JSON.stringify({
        score: 90,
        resolved: true,
        rubric: [{ item: "Asked clarifying questions", met: true, note: "Good questions up front." }],
        feedback: "Great diagnostic path overall.",
      })
    );

    const res = await POST(makeRequest({ seed, transcript: [] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.score).toBe(90);
    expect(body.rootCause).toBe(seed.rootCause);
  });

  it("retries once on malformed JSON and succeeds on the second attempt", async () => {
    mockedCall
      .mockResolvedValueOnce("nope")
      .mockResolvedValueOnce(
        JSON.stringify({ score: 60, resolved: false, rubric: [], feedback: "Needs more verification steps." })
      );

    const res = await POST(makeRequest({ seed, transcript: [] }));
    expect(res.status).toBe(200);
    expect(mockedCall).toHaveBeenCalledTimes(2);
  });

  it("returns 502 when both attempts return malformed JSON", async () => {
    mockedCall.mockResolvedValue("still nope");
    const res = await POST(makeRequest({ seed, transcript: [] }));
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest app/api/scenario/grade/route.test.ts`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Write `app/api/scenario/grade/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { buildGradeMessages } from "@/lib/scenarios";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import { parseGradeResult, ParseError } from "@/lib/parsing";
import type { ScenarioSeed, TranscriptMessage } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const seed = body?.seed as ScenarioSeed | undefined;
  const transcript = body?.transcript as TranscriptMessage[] | undefined;

  if (!seed || typeof seed !== "object") {
    return NextResponse.json({ error: "Missing seed" }, { status: 400 });
  }
  if (!Array.isArray(transcript)) {
    return NextResponse.json({ error: "transcript must be an array" }, { status: 400 });
  }

  const messages = buildGradeMessages(seed, transcript);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callOpenRouter(messages);
      const result = parseGradeResult(text);
      return NextResponse.json({ result, rootCause: seed.rootCause }, { status: 200 });
    } catch (err) {
      if (err instanceof MissingApiKeyError) {
        return NextResponse.json({ error: err.message }, { status: 503 });
      }
      if (err instanceof OpenRouterRequestError) {
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
      if (err instanceof ParseError && attempt === 1) {
        return NextResponse.json({ error: `Could not parse grade result from model: ${err.message}` }, { status: 502 });
      }
    }
  }

  return NextResponse.json({ error: "Unreachable" }, { status: 500 });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest app/api/scenario/grade/route.test.ts`
Expected: PASS, 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/api/scenario/grade
git commit -m "$(cat <<'EOF'
Add /api/scenario/grade route

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Design tokens, fonts, and shared UI components

**Files:**
- Modify: `app/globals.css` (add typography tokens + font-face)
- Create: `public/fonts/BricolageGrotesque-Bold.ttf`
- Create: `public/fonts/WorkSans-Regular.ttf`
- Create: `public/fonts/WorkSans-Bold.ttf`
- Create: `public/fonts/JetBrainsMono-Regular.ttf`
- Create: `public/fonts/JetBrainsMono-Bold.ttf`
- Create: `components/ScenarioCard.tsx`
- Create: `components/TicketHeader.tsx`
- Create: `components/Sidebar.tsx`
- Create: `components/ChatBubble.tsx`
- Create: `components/ResolutionBanner.tsx`

**Interfaces:**
- Consumes: `ScenarioCategory`, `ScenarioSeed`, `TranscriptMessage`, `GradeResult` from `@/lib/types`.
- Produces: `<ScenarioCard category={{id,label,blurb}} />`; `<TicketHeader category={ScenarioCategory} status={"in-progress"|"resolved"} />`; `<Sidebar seed={ScenarioSeed} rootCause={string|null} />` (renders "Unresolved" until `rootCause` is non-null); `<ChatBubble message={TranscriptMessage} name={string} />`; `<ResolutionBanner result={GradeResult} rootCause={string} />`. Pages in tasks 9 and 10 import all five from `@/components/*`.

- [ ] **Step 1: Copy font files from the bundled canvas-design skill assets**

Run:
```bash
mkdir -p public/fonts
cp ".claude/skills/canvas-design/canvas-fonts/BricolageGrotesque-Bold.ttf" public/fonts/
cp ".claude/skills/canvas-design/canvas-fonts/WorkSans-Regular.ttf" public/fonts/
cp ".claude/skills/canvas-design/canvas-fonts/WorkSans-Bold.ttf" public/fonts/
cp ".claude/skills/canvas-design/canvas-fonts/JetBrainsMono-Regular.ttf" public/fonts/
cp ".claude/skills/canvas-design/canvas-fonts/JetBrainsMono-Bold.ttf" public/fonts/
```
Expected: 5 files now present under `public/fonts/`.

- [ ] **Step 2: Append typography rules to `app/globals.css`**

```css
@font-face { font-family: "Bricolage Grotesque"; src: url("/fonts/BricolageGrotesque-Bold.ttf") format("truetype"); font-weight: 700; font-display: swap; }
@font-face { font-family: "Work Sans"; src: url("/fonts/WorkSans-Regular.ttf") format("truetype"); font-weight: 400; font-display: swap; }
@font-face { font-family: "Work Sans"; src: url("/fonts/WorkSans-Bold.ttf") format("truetype"); font-weight: 700; font-display: swap; }
@font-face { font-family: "JetBrains Mono"; src: url("/fonts/JetBrainsMono-Regular.ttf") format("truetype"); font-weight: 400; font-display: swap; }
@font-face { font-family: "JetBrains Mono"; src: url("/fonts/JetBrainsMono-Bold.ttf") format("truetype"); font-weight: 700; font-display: swap; }

body { font-family: "Work Sans", system-ui, sans-serif; }
.font-display { font-family: "Bricolage Grotesque", serif; }
.font-mono { font-family: "JetBrains Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums; }

.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;
}
.pill-warn { background: var(--warn-soft); color: var(--warn); border-color: var(--warn-line); }
.pill-good { background: var(--good-soft); color: var(--good); border-color: var(--good-line); }
```

- [ ] **Step 3: Write `components/ScenarioCard.tsx`**

```tsx
import Link from "next/link";
import type { ScenarioCategory } from "@/lib/types";

export function ScenarioCard({
  category,
}: {
  category: { id: ScenarioCategory; label: string; blurb: string };
}) {
  return (
    <Link
      href={`/play/${category.id}`}
      className="block rounded-[10px] border p-5 transition-colors hover:border-[var(--accent)]"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <h2 className="font-display text-lg font-bold" style={{ color: "var(--ink)" }}>
        {category.label}
      </h2>
      <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
        {category.blurb}
      </p>
    </Link>
  );
}
```

- [ ] **Step 4: Write `components/TicketHeader.tsx`**

```tsx
import type { ScenarioCategory } from "@/lib/types";

const CATEGORY_LABELS: Record<ScenarioCategory, string> = {
  network: "Network / Wi-Fi",
  printer: "Printer",
  password: "Password / MFA",
  "app-crash": "Application Crash",
  malware: "Malware / Quarantine",
  hardware: "Hardware Failure",
};

export function TicketHeader({
  category,
  status,
}: {
  category: ScenarioCategory;
  status: "in-progress" | "resolved";
}) {
  return (
    <div className="rounded-[10px] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-xs" style={{ color: "var(--accent)" }}>
            {CATEGORY_LABELS[category].toUpperCase()}
          </div>
          <h1 className="font-display mt-1 text-2xl font-bold" style={{ color: "var(--ink)" }}>
            IT Playground Session
          </h1>
        </div>
        <span className={`pill ${status === "resolved" ? "pill-good" : "pill-warn"}`}>
          {status === "resolved" ? "Resolved" : "In progress"}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write `components/Sidebar.tsx`**

```tsx
import type { ScenarioSeed } from "@/lib/types";

export function Sidebar({ seed, rootCause }: { seed: ScenarioSeed; rootCause: string | null }) {
  return (
    <aside className="rounded-[10px] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="mb-3">
        <div className="font-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
          Requester
        </div>
        <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>
          {seed.persona.name} · {seed.persona.department}
        </div>
      </div>
      <div className="mb-3">
        <div className="font-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
          Environment
        </div>
        <div className="text-sm" style={{ color: "var(--ink)" }}>
          {seed.environment.os} · {seed.environment.device}
        </div>
        <div className="text-sm" style={{ color: "var(--ink-muted)" }}>
          {seed.environment.detail}
        </div>
      </div>
      <div>
        <div className="font-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
          Root cause
        </div>
        <div className="text-sm" style={{ color: rootCause ? "var(--good)" : "var(--ink-faint)" }}>
          {rootCause ?? "Unresolved"}
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 6: Write `components/ChatBubble.tsx`**

```tsx
import type { TranscriptMessage } from "@/lib/types";

export function ChatBubble({ message, name }: { message: TranscriptMessage; name: string }) {
  const isTech = message.role === "tech";
  return (
    <div className={`flex gap-3 ${isTech ? "flex-row-reverse self-end" : ""}`} style={{ maxWidth: "88%" }}>
      <div
        className="flex h-8 w-8 flex-none items-center justify-center rounded-full font-mono text-xs font-bold"
        style={
          isTech
            ? { background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-line)" }
            : { background: "var(--surface-2)", color: "var(--ink-muted)" }
        }
      >
        {name
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()}
      </div>
      <div
        className="rounded-xl border px-4 py-3 text-sm"
        style={
          isTech
            ? { background: "var(--accent-soft)", borderColor: "var(--accent-line)", color: "var(--ink)" }
            : { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--ink)" }
        }
      >
        {message.content}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Write `components/ResolutionBanner.tsx`**

```tsx
import type { GradeResult } from "@/lib/types";

export function ResolutionBanner({ result, rootCause }: { result: GradeResult; rootCause: string }) {
  return (
    <div className="mt-5 rounded-[10px] border p-5" style={{ background: "var(--good-soft)", borderColor: "var(--good-line)" }}>
      <h2 className="font-display text-base font-bold" style={{ color: "var(--good)" }}>
        Score: {result.score}/100 — {result.resolved ? "Resolved" : "Not resolved"}
      </h2>
      <p className="mt-2 text-sm" style={{ color: "var(--ink)" }}>
        {result.feedback}
      </p>
      <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
        Actual root cause: {rootCause}
      </p>
      <ul className="mt-3 space-y-1">
        {result.rubric.map((item) => (
          <li key={item.item} className="font-mono text-xs" style={{ color: item.met ? "var(--good)" : "var(--warn)" }}>
            [{item.met ? "x" : " "}] {item.item} — {item.note}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 8: Verify the project still builds**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 9: Commit**

```bash
git add app/globals.css public/fonts components
git commit -m "$(cat <<'EOF'
Add design tokens, fonts, and shared ticket/chat UI components

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Scenario picker page

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `SCENARIO_CATEGORIES` from `@/lib/scenarios`; `ScenarioCard` from `@/components/ScenarioCard`.
- Produces: the `/` route rendering all 6 scenario cards, each linking to `/play/[category]`.

- [ ] **Step 1: Rewrite `app/page.tsx`**

```tsx
import { SCENARIO_CATEGORIES } from "@/lib/scenarios";
import { ScenarioCard } from "@/components/ScenarioCard";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="font-display text-3xl font-bold" style={{ color: "var(--ink)" }}>
        IT Playground
      </h1>
      <p className="mt-2" style={{ color: "var(--ink-muted)" }}>
        Pick a category. You&apos;ll play IT support against an AI end-user with a made-up problem — ask questions,
        diagnose, fix it, then submit for a graded review.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SCENARIO_CATEGORIES.map((category) => (
          <ScenarioCard key={category.id} category={category} />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify manually**

Run: `npm run dev` (background), then:
Run: `curl -s http://localhost:3000 | grep -o "Network / Wi-Fi"`
Expected: prints `Network / Wi-Fi`. Stop the dev server after confirming.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "$(cat <<'EOF'
Implement scenario picker page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Play page — the actual session UI

**Files:**
- Create: `app/play/[category]/page.tsx`

**Interfaces:**
- Consumes: `isScenarioCategory` from `@/lib/scenarios`; `TicketHeader`, `Sidebar`, `ChatBubble`, `ResolutionBanner` from `@/components/*`; `ScenarioSeed`, `TranscriptMessage`, `GradeResult` from `@/lib/types`; calls `POST /api/scenario/start`, `POST /api/scenario/reply`, `POST /api/scenario/grade`.
- Produces: the `/play/[category]` route — a full session: loads a seed on mount, lets the trainee chat, and grades on submit. This is the last page; nothing downstream depends on it.

- [ ] **Step 1: Write `app/play/[category]/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { isScenarioCategory } from "@/lib/scenarios";
import { TicketHeader } from "@/components/TicketHeader";
import { Sidebar } from "@/components/Sidebar";
import { ChatBubble } from "@/components/ChatBubble";
import { ResolutionBanner } from "@/components/ResolutionBanner";
import type { ScenarioSeed, TranscriptMessage, GradeResult } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

export default function PlayPage() {
  const params = useParams<{ category: string }>();
  const category = params.category;

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [seed, setSeed] = useState<ScenarioSeed | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);

  useEffect(() => {
    if (!isScenarioCategory(category)) return;

    let cancelled = false;
    async function start() {
      setLoadState("loading");
      const res = await fetch("/api/scenario/start", {
        method: "POST",
        body: JSON.stringify({ category }),
      });
      if (cancelled) return;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMessage(body.error ?? "Failed to start scenario.");
        setLoadState("error");
        return;
      }
      const body = await res.json();
      setSeed(body.seed);
      setTranscript([{ role: "enduser", content: body.seed.openingMessage }]);
      setLoadState("ready");
    }
    start();
    return () => {
      cancelled = true;
    };
  }, [category]);

  if (!isScenarioCategory(category)) {
    notFound();
  }

  async function sendMessage() {
    if (!seed || input.trim() === "" || sending) return;
    const nextTranscript: TranscriptMessage[] = [...transcript, { role: "tech", content: input.trim() }];
    setTranscript(nextTranscript);
    setInput("");
    setSending(true);

    const res = await fetch("/api/scenario/reply", {
      method: "POST",
      body: JSON.stringify({ seed, transcript: nextTranscript }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setTranscript([
        ...nextTranscript,
        { role: "enduser", content: `[System: ${body.error ?? "Something glitched generating a response — try again."}]` },
      ]);
      setSending(false);
      return;
    }

    const body = await res.json();
    setTranscript([...nextTranscript, { role: "enduser", content: body.message }]);
    setSending(false);
  }

  async function submitForGrading() {
    if (!seed || grading) return;
    setGrading(true);
    const res = await fetch("/api/scenario/grade", {
      method: "POST",
      body: JSON.stringify({ seed, transcript }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorMessage(body.error ?? "Failed to grade session.");
      setGrading(false);
      return;
    }
    const body = await res.json();
    setGradeResult(body.result);
    setSeed({ ...seed, rootCause: body.rootCause });
    setGrading(false);
  }

  if (loadState === "loading") {
    return <main className="mx-auto max-w-3xl p-8">Loading scenario…</main>;
  }

  if (loadState === "error" || !seed) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <div className="rounded-[10px] border p-5" style={{ background: "var(--warn-soft)", borderColor: "var(--warn-line)" }}>
          <p style={{ color: "var(--warn)" }}>{errorMessage}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-8">
      <TicketHeader category={seed.category} status={gradeResult ? "resolved" : "in-progress"} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
        <Sidebar seed={seed} rootCause={gradeResult ? seed.rootCause : null} />
        <div className="flex flex-col gap-4 rounded-[10px] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          {transcript.map((message, i) => (
            <ChatBubble key={i} message={message} name={message.role === "tech" ? "You" : seed.persona.name} />
          ))}
        </div>
      </div>

      {!gradeResult && (
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            placeholder="Type your response…"
            disabled={sending}
          />
          <button
            className="cursor-pointer rounded-lg px-4 py-2 text-sm font-bold"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            onClick={sendMessage}
            disabled={sending || input.trim() === ""}
          >
            Send
          </button>
          <button
            className="cursor-pointer rounded-lg border px-4 py-2 text-sm font-bold"
            style={{ borderColor: "var(--good-line)", color: "var(--good)" }}
            onClick={submitForGrading}
            disabled={grading || transcript.length < 2}
          >
            {grading ? "Grading…" : "Resolve & Submit"}
          </button>
        </div>
      )}

      {gradeResult && <ResolutionBanner result={gradeResult} rootCause={seed.rootCause} />}
    </main>
  );
}
```

- [ ] **Step 2: Verify the project builds**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add app/play
git commit -m "$(cat <<'EOF'
Implement play page: session chat, submit, and grading

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: End-to-end smoke test

**Files:**
- None created — verification only.

**Interfaces:**
- Consumes: the full running app from tasks 1–10.
- Produces: confidence the whole flow works with the real OpenRouter credentials in `.env.local` before calling the feature done.

- [ ] **Step 1: Run the full test suite**

Run: `npx jest`
Expected: all suites pass (parsing, openrouter, scenarios, all three routes).

- [ ] **Step 2: Run a production build**

Run: `npm run build`
Expected: build succeeds with no type or lint errors.

- [ ] **Step 3: Start the app and smoke-test the real API with curl**

Run: `npm run start` (background, port 3000), then:
```bash
curl -s -X POST http://localhost:3000/api/scenario/start \
  -H "Content-Type: application/json" \
  -d '{"category":"printer"}'
```
Expected: a `200` JSON body containing a `seed` object with `persona`, `environment`, `rootCause`, and `openingMessage` — this is a real call to OpenRouter using the `.env.local` credentials, so also eyeball that the generated persona/problem is coherent for the "printer" category.

- [ ] **Step 4: Smoke-test the reply endpoint using the seed from Step 3**

```bash
curl -s -X POST http://localhost:3000/api/scenario/reply \
  -H "Content-Type: application/json" \
  -d '{"seed": <paste seed JSON from Step 3>, "transcript": [{"role":"enduser","content":"<paste openingMessage>"},{"role":"tech","content":"What is the exact error on the printer display?"}]}'
```
Expected: `200` with `{ "message": "..." }` — a plausible in-character reply.

- [ ] **Step 5: Smoke-test the grade endpoint**

```bash
curl -s -X POST http://localhost:3000/api/scenario/grade \
  -H "Content-Type: application/json" \
  -d '{"seed": <same seed>, "transcript": [<the messages from steps 3-4>]}'
```
Expected: `200` with `{ "result": { "score": ..., "resolved": ..., "rubric": [...], "feedback": "..." }, "rootCause": "..." }`.

- [ ] **Step 6: Browser walkthrough**

Open `http://localhost:3000` in a browser, click into one scenario category, exchange at least 2 messages, click "Resolve & Submit", and confirm the resolution banner renders with a score and the root cause. Stop the server afterward.

- [ ] **Step 7: Final commit (if Step 6 surfaced any fixes)**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Fix issues found during end-to-end smoke test

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
(Skip this commit if no changes were needed.)

---

## Self-Review Notes

- **Spec coverage:** Non-goals (no auth/DB/Ollama) respected throughout — no session store, no login, single provider. Six categories match spec exactly. Rubric matches spec verbatim. Stateless data flow (Start/Reply/Grade) matches spec's three-endpoint design. Root cause hidden until grading, per spec. Retry-once-on-parse-failure implemented in both `start` and `grade` routes (the only two that parse structured JSON from the model — `reply` returns free text, so no parsing/retry needed there). Missing-key `503` and upstream-failure `502` handled in all three routes. Testing scope matches spec: unit tests only on `parsing.ts`, `openrouter.ts`, `scenarios.ts`, and the three route handlers — no UI test suite.
- **Placeholder scan:** none found — every step has runnable code and exact commands.
- **Type consistency:** `TranscriptMessage.role` (`"tech"|"enduser"`) used consistently across `types.ts`, `scenarios.ts`, all three routes, and every component. `ChatMessage.role` (`"system"|"user"|"assistant"`, the OpenRouter wire format) is kept separate and only appears inside `openrouter.ts` and `scenarios.ts`'s builder functions, never leaks into components. `ScenarioSeed`, `GradeResult`, `RubricItem` shapes match between `types.ts`, `parsing.ts`'s parsers, and the components that render them.
