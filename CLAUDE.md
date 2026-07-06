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

- **Auth**: email+password (bcryptjs) in SQLite via better-sqlite3 (`lib/db.ts`); JWT session cookie (`lib/session.ts`, cookie name `session`); `middleware.ts` gates `/` and `/play/*` (redirects to `/login`). API routes under `app/api/auth/*`.
  - **Important**: after any auth state change (login/register/logout), client code must use `window.location.assign(...)`, NOT `router.push` — the Next 14 client Router Cache caches middleware redirects, so soft navigation bounces users back to `/login` even with a valid cookie.
- **Scenario engine**: `lib/scenarios.ts` builds all LLM prompts (queue generation, end-user roleplay replies, grading). The end-user reply prompt treats tech messages starting with `/run ` as remote diagnostic commands and answers with raw terminal-style output. Rubric includes resolution-notes documentation.
- **API routes** `app/api/scenario/{queue,start,reply,grade}` are thin wrappers: build messages → `callOpenRouter` → parse (`lib/parsing.ts`).
- **UI**: client components; design tokens (CSS variables, light+dark) in `app/globals.css` — slate/blue "service desk console" theme, Plus Jakarta Sans + JetBrains Mono. Reusable classes: `.panel`, `.pill-*`, `.stat-card`, `.terminal-block`, `.cmd-chip`, `.tool-btn`, `.field-input`, `.btn-primary/.btn-ghost`. Priority mapping: P1=danger, P2=warn, P3=accent; SLA targets in `SLA_TARGETS`.
- **Ticket handoff**: queue page stashes the full `TicketPreview` in `sessionStorage` (`ticket:<id>`) and `/play/[category]?ticket=<id>` reads it; without the param it generates a fresh scenario via `/api/scenario/start`.
