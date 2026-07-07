# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A **Next.js 14 (App Router) IT help-desk training simulator** ("HelpDesk Console"). The trainee plays a Tier-1 technician: a queue of AI-generated tickets is shown on `/`, each ticket opens a chat session against an LLM role-playing the end-user, the trainee can run simulated remote diagnostics (`/run <command>`), and closes the ticket with resolution notes to receive a rubric-based 0–100 grade.

The original prompt-spec documents ([agent.md](agent.md), [prompt.md](prompt.md), `.claude/skills/itsupportsimulation/`) still exist but are historical design docs — the implemented app is the source of truth now.

## Commands

- `npm run dev` — dev server (Next.js, defaults to port 3000; respects `PORT`)
- `npm run build` — production build (fails if dev server is running against the same `.next/`; delete `.next/` if builds error with PageNotFoundError)
- `npm test` — Jest (ts-jest); tests live next to sources as `*.test.ts`

## Environment

`.env.local` must define:
- `AUTH_SECRET` — HS256 secret for session JWTs
- `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` (or `ANTHROPIC_API_KEY`) / `ANTHROPIC_MODEL` — OpenRouter-compatible endpoint used by `lib/openrouter.ts`. The free OpenRouter tier has a daily request cap; 429s surface in the UI as a friendly rate-limit message.

## Architecture

- **Auth**: email+password (bcryptjs) in libSQL via `@libsql/client` (`lib/db.ts` — all query fns are **async**; local `file:./data/app.db` in dev, Turso in prod via `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`); JWT session cookie (`lib/session.ts`, cookie name `session`); `middleware.ts` gates `/`, `/play/*`, `/settings`, `/courses/*`, and `/profile` (redirects to `/login`). API routes under `app/api/auth/*`.
  - **Important**: after any auth state change (login/register/logout), client code must use `window.location.assign(...)`, NOT `router.push` — the Next 14 client Router Cache caches middleware redirects, so soft navigation bounces users back to `/login` even with a valid cookie.
- **Scenario engine**: `lib/scenarios.ts` builds all LLM prompts (queue generation, end-user roleplay replies, grading). The end-user reply prompt treats tech messages starting with `/run ` as remote diagnostic commands and answers with raw terminal-style output. Rubric includes resolution-notes documentation.
- **API routes** `app/api/scenario/{queue,start,reply,grade}` are thin wrappers: build messages → `callOpenRouter` → parse (`lib/parsing.ts`).
- **UI**: client components; design tokens (CSS variables, light+dark) in `app/globals.css` — slate/blue "service desk console" theme, Plus Jakarta Sans + JetBrains Mono. Reusable classes: `.panel`, `.pill-*`, `.stat-card`, `.terminal-block`, `.cmd-chip`, `.tool-btn`, `.field-input`, `.btn-primary/.btn-ghost`. Priority mapping: P1=danger, P2=warn, P3=accent; SLA targets in `SLA_TARGETS`.
- **Ticket handoff**: queue page stashes the full `TicketPreview` in `sessionStorage` (`ticket:<id>`) and `/play/[category]?ticket=<id>` reads it; without the param it generates a fresh scenario via `/api/scenario/start`.
- **Courses & certificates**: `lib/courses.ts` (16-track cybersecurity cert catalog with tiers — foundation/security/vendor — course/tutor/practice-ticket prompts, server-side quiz grading), `lib/certification.ts` (auto-issue rule: all modules passed at ≥80% + 3 tickets graded ≥70 in the track's mapped categories). Courses are AI-generated once per user per track and cached in the `courses` table — protects the daily request cap. Pages: `/courses` (tiered grid), `/courses/[track]` (lesson + quiz + AI-tutor panel + practice tickets + lab links), `/profile` (stats + printable certificates). Quiz answer keys never leave the server (`stripAnswers`). Grading a ticket writes `ticket_results` and re-checks certificate eligibility. `/` redirects to `/courses`; the ticket queue lives at `/queue`. Practice tickets: `POST /api/course/tickets` builds 3 tickets from the user's cached course modules (categories constrained to the track).
- **3D labs** (`/labs/*`, Three.js via `next/dynamic({ ssr: false })` — never import R3F in jest): wiring lab (`lib/wiringLab.ts` validation/scoring `max(60, 100 - 10·wrong)`, `components/lab/WiringScene.tsx` scene, 3 static fallback scenarios) and FortiGate lab (`lib/fortigateLab.ts`, `[TASK_DONE:id]`/`[LAB_COMPLETE]` markers, FortiOS CLI via LLM, score `max(60, 100 - 5·wrong - 5·hints)`). Routes `/api/lab/wiring`, `/api/lab/fortigate/{init,exec}` fall back to canned scenarios so labs work under rate limits; `/api/lab/complete` records `ticket_results` (wiring→network, fortigate→firewall) and re-checks certs. Three deps pinned for React 18: `@react-three/fiber@8`, `@react-three/drei@9`, `three@0.160`.
- **Simulated VM labs**: `lib/vm.ts` builds provision/exec prompts; `components/vm/VmOverlay.tsx` renders a full-screen fake machine (lock screen + terminal/settings/files windows) opened from the ticket page; routes `/api/vm/{init,exec}`. The model appends `[FAULT_RESOLVED]` on its own line when the trainee's commands genuinely fix the hidden fault. VMware course practice tickets provision ESXi-flavored machines through the same engine.
- **Presence**: clients heartbeat `POST /api/presence` every 30s (`HEARTBEAT_INTERVAL_MS`); a user counts as online if seen within 75s (`PRESENCE_WINDOW_MS`); NavBar shows the live count.
- **NavBar renders once from `app/layout.tsx`** — pages must not render their own `<NavBar />`.
