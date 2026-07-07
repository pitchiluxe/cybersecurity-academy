# HelpDesk Console v3 — Design

Date: 2026-07-06
Status: Approved

## Goal

Six extensions, built in phases A→F:

- **A** — App opens on the course menu; ticket queue moves to `/queue`.
- **B** — Cert catalog grows to a 16-cert cybersecurity career path; 7 new ticket
  categories so security certs have real labs. All course content stays AI-generated.
- **C** — Each course can generate practice tickets seeded from its own modules.
- **D** — 3D animated network wiring lab (Three.js).
- **E** — 3D FortiGate firewall lab with full FortiOS configuration scenarios.
- **F** — VMware course + ESXi-flavored virtual labs.

## Phase A — Landing on courses

- `app/page.tsx` (queue) moves to `app/queue/page.tsx` unchanged (sessionStorage ticket
  handoff, fallback queue — all identical).
- New `app/page.tsx`: server component calling `redirect("/courses")` from
  `next/navigation`.
- `middleware.ts` matcher adds `/queue`. NavBar "Queue" link → `/queue` (active state
  `pathname === "/queue"`).

## Phase B — 16-cert catalog + new ticket categories

### New scenario categories (added to `SCENARIO_CATEGORIES` in `lib/scenarios.ts` and the
`ScenarioCategory` union in `lib/types.ts`)

| id | label | priority |
|----|-------|----------|
| `phishing` | Phishing / Social Engineering | P1 |
| `firewall` | Firewall / Network Security | P2 |
| `siem` | SIEM / IDS Alert | P1 |
| `access` | Access Control / IAM | P2 |
| `cloud` | Cloud / SaaS | P2 |
| `linux` | Linux Server | P2 |
| `pentest` | Vulnerability / Pentest Finding | P2 |

Each gets a blurb and a unique static ticketId (TCK-4478…TCK-4484). The queue generator
and `/play/[category]` work off `SCENARIO_CATEGORIES`, so new categories flow through
automatically; `lib/fallbackTickets.ts` is unchanged (fallback-only).

### Track catalog (`TRACKS` in `lib/courses.ts`), ordered entry → advanced

| id | title | short | categories |
|----|-------|-------|------------|
| `aplus` | CompTIA A+ | APL | hardware, printer, app-crash |
| `networkplus` | CompTIA Network+ | NET | network |
| `linuxplus` | CompTIA Linux+ | LNX | linux |
| `cloudplus` | CompTIA Cloud+ | CLD | cloud |
| `securityplus` | CompTIA Security+ | SEC | malware, password, phishing |
| `cysa` | CompTIA CySA+ | CSA | siem, malware |
| `pentestplus` | CompTIA PenTest+ | PEN | pentest |
| `securityx` | CompTIA SecurityX (CASP+) | CSX | firewall, siem, access |
| `ccna` | Cisco CCNA | CCN | network, vm |
| `ccnpsec` | Cisco CCNP Security | CNS | firewall, network |
| `ceh` | EC-Council CEH | CEH | pentest, phishing |
| `sscp` | ISC2 SSCP | SSC | access, password |
| `cissp` | ISC2 CISSP | CIS | access, siem, cloud |
| `oscp` | OffSec OSCP | OSC | pentest, linux |
| `fortinet` | Fortinet FCP (NSE 4) | FTN | firewall |
| `vmware` | VMware VCP-DCV | VMW | vm |

Existing track ids keep their meaning — no data migration. Course generation, tutor,
quizzes, certificates all work per track exactly as in v2 (content 100% AI-generated per
user; only names/mapping curated because vendors fix cert names).

`/courses` groups tracks by tier headings: Foundation (aplus…cloudplus), Security core
(securityplus…securityx), Vendor & specialist (ccna…vmware).

## Phase C — Practice tickets from courses

- `POST /api/course/tickets` — body `{ track }`; requires session + generated course.
  Builds a prompt from the course's module titles + the track's categories; the model
  returns 3 ticket seeds (same JSON shape as queue generation, category constrained to
  the track's categories). Response: `TicketPreview[]` with fresh ticket ids
  (`PRX-<4 digits>`).
- Course page (`/courses/[track]`) gets a "Practice tickets" section: button → loading →
  list of generated tickets; clicking one stashes the `TicketPreview` in sessionStorage
  (`ticket:<id>`, same as queue) and navigates to `/play/[category]?ticket=<id>`.
- Graded normally; `ticket_results` rows count toward the track's cert (categories map).

## Phase D — 3D wiring lab

### Dependencies

`three`, `@react-three/fiber`, `@react-three/drei`. Loaded only on lab pages via
`next/dynamic` with `ssr: false` (WebGL is client-only; keeps the engine off other pages).

### Scenario (`lib/wiringLab.ts`)

- `WiringScenario`: `{ title, backstory, devices: [{ id, name, kind: "modem"|"router"|"switch"|"patchpanel"|"pc"|"ap"|"firewall", ports: [{ id, label, kind: "wan"|"lan"|"uplink"|"console" }] }], requiredConnections: [{ fromDevice, fromPort, toDevice, toPort, cable: "ethernet"|"fiber"|"console", step: number, instruction }] }`.
- `POST /api/lab/wiring` generates a scenario with the LLM (real-world backstory: new
  branch office, dead uplink, AP rollout). On any model/parse failure, returns one of 3
  static fallback scenarios so the lab always works.
- Pure, tested logic: `validateConnection(scenario, made, attempt)` (is this pair part of
  the required set and not already made), `isComplete(scenario, made)`,
  `scoreLab(wrongAttempts)` = `max(60, 100 - 10 * wrongAttempts)`.

### 3D scene (`components/lab/WiringScene.tsx` + small files per unit)

- R3F Canvas, OrbitControls (rotate/zoom), desk/rack plane, devices as labeled boxes
  (drei `Text`), ports as colored sockets (green LAN, blue WAN, amber uplink).
- Interaction: click port → highlighted; click second port → attempt. Correct: cable
  (tube along a sagging quadratic curve) grows from A to B over ~600ms, plug "snap"
  scale-pulse, both port LEDs turn green and blink. Wrong: red flash on both ports,
  cable draws and retracts, wrong-attempt counter increments.
- Instruction panel (HTML overlay): numbered wiring steps from the scenario, current step
  highlighted, checked off as connections land.
- Completion: packet-flow animation — glowing spheres travel each cable in path order
  (modem → router → switch → PCs), per-link "LINK UP" list, terminal-style readout of a
  successful ping test. Banner with score.
- Result recorded via existing `recordTicketResult(userId, "network", score)` through a
  small `POST /api/lab/complete` `{ kind: "wiring" | "fortigate", score }` route
  (kind→category: wiring→network, fortigate→firewall), then cert eligibility re-checked.

### Entry points

- New page `/labs/wiring` (gated by middleware `/labs/:path*`).
- NavBar gains "Labs" link → `/labs` (index page listing Wiring lab + FortiGate lab with
  descriptions); course pages for networkplus/ccna/ccnpsec link to the wiring lab.

## Phase E — FortiGate firewall lab

### Page `/labs/fortigate`

Split view: left = 3D FortiGate 60F-style unit (R3F, reuses the port/cable interaction
system from Phase D — WAN1, WAN2, LAN1–LAN5, DMZ ports; ISP modem + LAN switch as cable
endpoints); right = FortiOS console + task checklist.

### Scenario (`lib/fortigateLab.ts`)

- `POST /api/lab/fortigate/init`: LLM generates `{ title, backstory, wiring: requiredConnections (same shape as Phase D), tasks: [{ id, instruction, doneMarker }] }` —
  real-world jobs: branch deployment (set WAN1/LAN IPs, default route, LAN→WAN policy
  with NAT), web-filter block, port forward (VIP) for camera NVR, IPsec tunnel
  troubleshooting. Static fallback scenario on failure.
- `POST /api/lab/fortigate/exec`: FortiOS CLI simulation — same engine pattern as
  `lib/vm.ts` exec: system prompt = FortiGate state + scenario + task list, responds with
  raw FortiOS CLI output (`config system interface`, `get system status`,
  `diagnose sniffer packet`, …), stays consistent with history. When a task is genuinely
  completed by the commands, appends `[TASK_DONE:<id>]`; UI checks it off with animation.
  All tasks done → `[LAB_COMPLETE]` → score = `max(60, 100 - 5 * wrongAttempts - 5 * hintsUsed)`
  (wiring mistakes count as wrong attempts) → recorded as `firewall` category result.
- Cable phase first (wire WAN1→modem, LAN1→switch with the 3D animation), then console
  unlocks — mirrors real deployment order.

## Phase F — VMware course + labs

- `vmware` track (Phase B) generates VCP-DCV course content; its practice tickets
  (Phase C) are `vm`-category, and the prompt for `vm` practice tickets from this track
  nudges toward ESXi/vCenter faults (VM won't power on, datastore full, snapshot chain,
  vMotion failure) via the module-titles seeding.
- The existing VM overlay (ticket page "Connect to user's machine") already provides the
  hands-on ESXi terminal — `buildVmInitMessages` receives the seed whose root cause is
  VMware-flavored, so the provisioned machine is an ESXi host with `esxcli`/`vim-cmd`.
  No new engine needed.
- VMware course page links to practice tickets as its "virtual lab".

## Constraints & error handling

- OpenRouter free tier: labs are LLM-per-command like the VM overlay; scenario generation
  has static fallbacks (wiring: 3 canned scenarios; FortiGate: 1 canned scenario) so 3D
  labs never dead-end on rate limits.
- All new LLM JSON parsed defensively (`lib/parsing.ts` patterns + backslash repair where
  paths appear); routes map errors exactly like existing ones.
- Three.js only on `/labs/*` via dynamic import; jest never imports R3F components — all
  lab correctness logic lives in `lib/wiringLab.ts` / `lib/fortigateLab.ts` (pure,
  tested).

## Testing

Jest: new-category/track mapping integrity, practice-ticket prompt builder + parser,
`validateConnection`/`isComplete`/`scoreLab`, FortiGate task-marker parsing + scoring,
wiring/FortiGate scenario parsers incl. fallbacks. Existing suites must stay green
(`ScenarioCategory` union growth is additive).

## Build order

A → B → C → D → E → F, each phase committed and verified (tests + browser) before the
next.
