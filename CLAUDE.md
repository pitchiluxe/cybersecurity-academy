# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo actually is

This is a **prompt-engineering / agent-spec project**, not an implemented application. There is no source code, no `package.json`, no build tooling, and no tests. The repo consists of three markdown documents that define an AI agent persona plus a set of bundled `.claude/skills/` (mostly third-party skill plugins, not project-specific code).

The previous version of this file described a full React/Node/Postgres/Prisma stack with npm scripts, Docker, CI, etc. **None of that exists in this repo.** Do not assume that stack, do not run `npm install`, and do not go looking for a `client/` or `server/` directory — there isn't one. If a future task actually adds that implementation, update this file to match reality at that point.

## Repo contents

- **[agent.md](agent.md)** — the core spec for "IT-Support-Simulator": a system prompt/persona for an LLM agent that role-plays a help-desk technician. Defines its purpose, the full system prompt text, three mock tools (`KnowledgeBase`, `RemoteCommand`, `TicketDB`), example interactions, and configuration parameters (model, temperature, token limits, etc.) intended for use in an "AIHub Agent Builder"-style platform.
- **[prompt.md](prompt.md)** — a single one-shot prompt for generating a static, fully-written IT support conversation transcript (no tool calls, just prose output).
- **[.claude/skills/itsupportsimulation/skill.md](.claude/skills/itsupportsimulation/skill.md)** — a *different*, more interactive skill spec: a scenario-driven, menu-based simulation (pick a scenario like "Wi-Fi connectivity loss", gather info, diagnose, propose a fix, document the ticket, get scored 0–100). Includes a Node.js sketch (`createSkill(...)`) and a scenario JSON template, but these are illustrative snippets, not real runnable code in this repo.
- **`.claude/skills/*`** (other than `itsupportsimulation`) — general-purpose skill plugins (canvas-design, code-reviewer, react-best-practices, senior-backend/frontend/security, ui-design-system, ui-ux-pro-max). These are reusable tooling bundles, unrelated to the IT-support domain itself; don't treat their presence as evidence this is a coded app.

## Key distinction to keep in mind

`agent.md` and `.claude/skills/itsupportsimulation/skill.md` describe **two different, non-identical designs** for what is nominally the same simulation idea:

| | agent.md | itsupportsimulation/skill.md |
|---|---|---|
| Interaction style | Free-form conversation, agent classifies issue itself | Fixed menu of predefined scenarios |
| Tools | `KnowledgeBase`, `RemoteCommand`, `TicketDB` | Generic diagnostic commands (`ping`, `ipconfig`, `eventvwr`) |
| Output | Resolved issue or created ticket | Scored transcript (0–100) at the end |

If asked to "implement" or "extend" the simulation, clarify which spec (or a merge of both) is the intended source of truth before writing code — they are not drop-in compatible.

## Working in this repo

Since there's no code, typical tasks here are editing/extending these markdown specs (system prompts, tool definitions, scenario data) rather than running builds or tests. If a task introduces actual application code (e.g., implementing `it-support-simulation` as a real Node.js skill with `scenarios/` JSON files, per the "Ready to deploy" section of skill.md), scaffold it fresh and add the corresponding install/build/test/lint commands to this file at that time.
