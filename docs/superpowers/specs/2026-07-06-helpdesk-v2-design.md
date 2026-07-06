# HelpDesk Console v2 — Design

Date: 2026-07-06
Status: Approved

## Goal

Extend the IT help-desk training simulator with four features, built in phases:

1. Login page info panel + author credit
2. Realtime online-user count
3. AI-generated certification courses with AI tutor, certificates, and user profile
4. Simulated virtual machine labs attached to tickets

## Phase 1 — Login page info panel

`/login` becomes a two-column layout inside the existing `auth-shell`:

- **Left panel**: explains the app — HelpDesk Console is an AI-powered IT help-desk
  training simulator; trainees work a live ticket queue, chat with AI end-users, run
  remote diagnostics, get rubric-graded on resolutions, and can take certification
  courses (A+, Network+, Security+, CCNA) with an AI tutor to earn certificates.
  Short feature bullets. At the bottom: **"By Erick Omari"**.
- **Right panel**: existing sign-in card, unchanged.
- Columns stack vertically below the `sm`/`md` breakpoint.
- Uses existing design tokens (CSS variables in `app/globals.css`), Plus Jakarta Sans /
  JetBrains Mono, `.panel`-style surfaces. No new global styles beyond what the two-column
  auth layout needs.

## Phase 2 — Online-user presence count

Heartbeat-polling approach; no WebSocket infra.

- **DB**: new table `presence (user_id INTEGER PRIMARY KEY, last_seen TEXT NOT NULL)`
  created in `lib/db.ts` alongside `users`.
- **API**: `POST /api/presence` — requires a valid session; upserts the caller's
  `last_seen = now`; responds `{ online: <count of rows with last_seen within 75s> }`.
  Unauthenticated → 401.
- **Client**: `NavBar` pings `/api/presence` on mount and every 30s while the tab is
  visible (skip when `document.hidden`); renders a green status dot + `N online` in the
  top-right cluster, replacing the static "Systems online" text. On error, falls back to
  the static label.
- Presence window (75s) and heartbeat interval (30s) are constants in `lib/presence.ts`
  with a pure, tested `countOnline(rows, now)` helper.

## Phase 3 — Courses, AI tutor, certificates, profile

### Tracks

`lib/courses.ts` exports a `TRACKS` list: CompTIA A+, CompTIA Network+, CompTIA
Security+, Cisco CCNA. Each track has: id, title, description, and a mapping to existing
ticket categories (hardware→A+, network→Network+ and CCNA, security→Security+,
software/accounts→A+).

### Data model (SQLite, `lib/db.ts`)

- `courses (id, user_id, track, content_json, created_at)` — one AI-generated course per
  user per track, cached so it is generated exactly once (protects the 50-req/day
  OpenRouter cap). `content_json` holds modules: `{ title, lesson (markdown), quiz:
  [{ question, choices[4], answerIndex }] }` — 4–6 modules per course.
- `module_progress (course_id, module_index, quiz_score, passed_at)` — a row is written
  when a module quiz is passed.
- `certificates (id, user_id, track, cert_code, issued_at)` — `cert_code` is a short
  unique code (e.g. `HDC-SEC-4F7A2B`).
- `ticket_results (id, user_id, category, grade, created_at)` — written when a ticket is
  graded, so certificate eligibility can count real resolved tickets per category.

### API routes (thin wrappers, same pattern as `app/api/scenario/*`)

- `POST /api/course/generate` — body `{ track }`; returns cached course if present, else
  builds prompt (in `lib/courses.ts`), calls `callOpenRouter`, parses/validates JSON,
  stores, returns. Quiz `answerIndex` is stripped from client responses.
- `POST /api/course/quiz` — body `{ track, moduleIndex, answers[] }`; grades server-side
  against stored answer key; ≥ 80% passes; writes `module_progress`; returns score +
  per-question correctness. After writing, runs certificate-eligibility check.
- `POST /api/course/tutor` — body `{ track, moduleIndex, messages[] }`; builds tutor
  system prompt containing the current lesson content; tutor persona: patient IT
  instructor who explains material, answers questions, and ties concepts to real-world
  troubleshooting so the trainee is job-ready. Returns assistant reply.
- `GET /api/profile` — email, per-track course progress, ticket stats, certificates.

### Certificate rule (soft gating)

Tickets remain open to everyone. A certificate for a track is auto-issued when **both**:

1. All modules of that track's course passed (quiz ≥ 80% each), and
2. ≥ 3 tickets in that track's mapped categories resolved with grade ≥ 70.

Eligibility check runs after quiz passes and after ticket grading. Issuing writes
`certificates` row; profile shows it immediately.

### Pages

- `/courses` — grid of track cards: title, description, progress bar (modules passed /
  total, ticket count toward cert), cert badge if earned. "Start course" triggers
  generation with a loading state (generation is one large LLM call).
- `/courses/[track]` — three-pane layout: module list (left), lesson reader with
  markdown rendering (center), AI tutor chat panel (right, collapsible on mobile). Quiz
  at the end of each lesson; passing unlocks nothing (soft gating) but records progress.
- `/profile` — account info, course progress summary, ticket stats, earned certificates
  rendered as printable certificate cards (recipient email, track title, cert code,
  issue date, "HelpDesk Console" branding). Print-friendly via CSS.
- NavBar gains "Courses" and "Profile" links; middleware gates `/courses/*` and
  `/profile` behind the session cookie like `/` and `/play/*`.

## Phase 4 — Simulated VM lab

A browser-rendered fake machine attached to each ticket — no real VMs.

- **Entry**: ticket page (`/play/[category]`) gets a "Connect to user's machine" button →
  full-screen overlay.
- **Login screen**: scripted client-side; OS-style lock screen; credentials displayed in
  the ticket sidebar (e.g. `support-admin` / ticket-specific password). Wrong password
  rejected client-side.
- **Desktop**: taskbar + windows the user can open: **Terminal**, **Settings panel**
  (read-only info: hostname, network config, services — content seeded from the fault
  spec), **File Explorer** (minimal, static tree seeded from fault spec).
- **Fault engine**: when the VM opens, `POST /api/vm/init` builds a machine spec + fault
  matching the ticket (LLM call, returns JSON: OS type, hostname, seeded settings/files,
  fault description). Terminal commands go to `POST /api/vm/exec` with full command
  history; system prompt = machine spec + fault + rule "answer only with raw terminal
  output, stay consistent with prior outputs and applied fixes."
- **Resolution detection**: when the user's commands have genuinely fixed the fault, the
  model appends a `[FAULT_RESOLVED]` marker line; the UI shows a "fault resolved" state
  and the user returns to the ticket to close it with notes and get graded by the
  existing rubric.
- VM terminal styling reuses `.terminal-block` / JetBrains Mono.

## Constraints & error handling

- OpenRouter free tier ≈ 50 requests/day: course generation cached in DB; tutor and VM
  are per-message calls; existing friendly 429 rate-limit message pattern reused
  everywhere.
- All LLM JSON parsed defensively via `lib/parsing.ts` patterns; malformed course JSON →
  retry-once then friendly error.
- Auth-state changes keep using `window.location.assign` (Router Cache pitfall in
  CLAUDE.md).

## Testing

Jest (`*.test.ts` next to sources): presence window counting, certificate eligibility
logic, course JSON validation/parsing, quiz grading, prompt builders (tutor, course
generation, VM exec), track↔category mapping. API routes stay thin so logic lives in
testable `lib/` functions.

## Build order

Phases 1 → 2 → 3 → 4, each committed separately with tests passing before the next.
