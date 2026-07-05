# IT Playground — Design Spec

Date: 2026-07-05

## Purpose

A web app that lets tech newbies practice real-world IT support conversations before doing the job for real. The trainee always plays the support technician; an LLM plays a frustrated/confused end-user with a made-up but realistic problem. At the end of a session the trainee submits for grading and gets a score plus written feedback.

## Non-goals

- No accounts, login, or multi-user support.
- No persistence across page reloads (in-memory client state only).
- No support for local models (Ollama) — OpenRouter only, per existing `.env.local`.

## LLM Provider

Uses the credentials already in `.env.local`:

```
ANTHROPIC_BASE_URL=https://openrouter.ai/api
ANTHROPIC_AUTH_TOKEN=<key>
ANTHROPIC_MODEL=deepseek/deepseek-v4-flash:free
```

All three env vars are read server-side only (Next.js API routes / route handlers), never exposed to the client bundle. If `ANTHROPIC_AUTH_TOKEN` is missing or empty at request time, the API returns a `503` with a clear setup message; the UI renders that as a setup banner instead of a generic error.

## Stack

Next.js (App Router) + TypeScript, single project, no separate backend process. Reuses the visual system already designed (ticket header, sidebar, chat bubbles, terminal-style command blocks, resolution banner) as React components with Tailwind CSS, adapted from the standalone HTML artifact built earlier in this project.

## Scenario categories

Six fixed categories (union of `agent.md` and `.claude/skills/itsupportsimulation/skill.md`):

1. Network / Wi-Fi connectivity
2. Printer
3. Password reset / MFA
4. Application crash
5. Malware / virus quarantine
6. Hardware failure / blue screen

Each session gets a freshly AI-generated persona and problem *within* the chosen category — never a verbatim repeat, but scoped enough to grade against a category-specific rubric.

## Data flow (fully stateless server)

No session store, no database. The client holds all session state (the "seed" and the transcript) in React state and resends it on every request. The server never remembers anything between calls.

1. **Start** — trainee picks a category on `/`. Client calls `POST /api/scenario/start` with `{ category }`.
   Server makes one LLM call asking for strict JSON:
   ```json
   {
     "persona": { "name": "...", "department": "..." },
     "environment": { "os": "...", "device": "...", "detail": "..." },
     "rootCause": "...",          // hidden from the client's visible UI until grading
     "openingMessage": "..."      // the end-user's first complaint, shown as the first chat bubble
   }
   ```
   Response returned to client as the `seed`. `rootCause` is included in the payload (needed for later calls) but the UI must not render it until the session is graded.

2. **Reply** — trainee sends a message. Client calls `POST /api/scenario/reply` with `{ seed, transcript }` (full message history so far). Server builds a system prompt embedding persona/environment/rootCause and instructs the model to stay in character as the end-user, answer diagnostic questions plausibly, and only reveal symptoms consistent with the hidden root cause — never state the root cause outright. Returns the next end-user message; client appends it to the transcript.

3. **Grade** — trainee clicks "Resolve & Submit". Client calls `POST /api/scenario/grade` with `{ seed, transcript }`. Server prompts the model as an evaluator with a fixed rubric (see below) and requests strict JSON:
   ```json
   { "score": 0-100, "resolved": true|false, "rubric": [{ "item": "...", "met": true|false, "note": "..." }], "feedback": "..." }
   ```
   Client renders this in the resolution-banner style, and now also reveals `rootCause` from the seed for the trainee to compare against.

## Rubric (fixed, used in the grading prompt)

- Asked relevant clarifying questions before proposing a fix
- Diagnostic steps were logical and in a sensible order
- Proposed fix actually addresses the hidden root cause
- Verified the fix before closing
- Professional, clear, empathetic tone throughout

## Error handling

- LLM responses are expected as JSON; each of the three endpoints validates the shape and retries the LLM call once on parse failure before returning a `502` with a friendly message.
- Client shows retry failures as an inline system bubble in the transcript ("Something glitched generating a response — try again") rather than crashing the session.
- Empty/whitespace-only trainee input is blocked client-side before any request is sent.
- Missing `ANTHROPIC_AUTH_TOKEN` → `503` + setup banner, as above.

## Testing

Given this is a solo practice sandbox (no auth, no persistence, no multi-user concerns), testing stays scoped to the fragile surface: the three JSON-parsing/validation helpers (`parseScenarioSeed`, `parseGradeResult`, and the shared "extract JSON from LLM text" utility). Jest unit tests cover: well-formed input, LLM wrapping JSON in prose/markdown fences, and malformed/missing-field input (should throw a typed error the API layer catches). No end-to-end or component test suite is planned for v1.

## Out of scope for v1 (explicitly deferred)

- Ollama / local model support
- Saved history, scoreboards, multiple concurrent trainees
- Additional scenario categories beyond the six listed
- Difficulty levels / adjustable rubric weighting
