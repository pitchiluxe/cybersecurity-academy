import type { ChatMessage } from "./openrouter";

export interface LabTutorTurn {
  role: "user" | "assistant";
  content: string;
}

export interface LabTutorContext {
  /** Which lab engine the trainee is in: wiring, fortigate, or router. */
  engine: string;
  title: string;
  backstory: string;
  /** Wiring step instructions, in order. */
  steps: string[];
  /** CLI configuration task instructions (fortigate/router labs only). */
  tasks?: string[];
}

export function isLabTutorTurn(value: unknown): value is LabTutorTurn {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim() !== "";
}

export function isLabTutorContext(value: unknown): value is LabTutorContext {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.engine === "string" &&
    typeof c.title === "string" &&
    typeof c.backstory === "string" &&
    Array.isArray(c.steps) &&
    c.steps.every((s) => typeof s === "string") &&
    (c.tasks === undefined || (Array.isArray(c.tasks) && c.tasks.every((t) => typeof t === "string")))
  );
}

const ENGINE_DESCRIPTIONS: Record<string, string> = {
  wiring: "a 3D network cabling lab — the trainee clicks ports to run cables between devices",
  fortigate: "a FortiGate deployment lab — the trainee cables the unit in 3D, then configures it in the FortiOS CLI",
  router: "a Cisco router deployment lab — the trainee cables the unit in 3D, then configures it in the IOS-XE CLI",
  hardware: "a 3D PC hardware assembly lab — the trainee picks components (CPU, RAM, drives, GPU, power) from a tray and installs each into the right motherboard slot or drive bay",
  bootcamp: "a CCNA bootcamp chapter — the trainee studies the lesson, takes a quiz, and troubleshoots a simulated machine for this skill",
};

/**
 * One-shot hint for the CLI phase of a device lab: given the open tasks and the
 * trainee's recent console activity, nudge them toward the next command.
 */
export function buildLabHintMessages(
  context: LabTutorContext,
  openTasks: string[],
  recentConsole: { command: string; output: string }[]
): ChatMessage[] {
  const engineLine = ENGINE_DESCRIPTIONS[context.engine] ?? "a hands-on IT lab";
  const consoleBlock =
    recentConsole.length > 0
      ? `\nRecent console activity (most recent last):\n${recentConsole
          .map((h) => `> ${h.command}\n${h.output.slice(0, 300)}`)
          .join("\n")}`
      : "\nThe trainee has not typed anything yet.";
  const system = `You are a senior network engineer giving a single hint to an IT trainee working in ${engineLine}.
Lab: ${context.title} — ${context.backstory}
Open (not yet completed) tasks:
${openTasks.map((t, i) => `${i + 1}. ${t}`).join("\n")}${consoleBlock}
Give ONE hint for the next open task: one or two sentences of reasoning, then the exact command (or the first command of the sequence) to type. Plain text only, no markdown, under 60 words.`;
  return [
    { role: "system", content: system },
    { role: "user", content: "Give me a hint for the next step." },
  ];
}

export function buildLabTutorMessages(context: LabTutorContext, turns: LabTutorTurn[]): ChatMessage[] {
  const engineLine = ENGINE_DESCRIPTIONS[context.engine] ?? "a hands-on IT lab";
  const stepsList = context.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const tasksBlock =
    context.tasks && context.tasks.length > 0
      ? `\nConfiguration tasks after cabling:\n${context.tasks.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
      : "";
  const system = `You are a friendly senior network engineer mentoring an IT trainee inside ${engineLine}.
Lab: ${context.title}
Backstory: ${context.backstory}
Wiring steps:
${stepsList}${tasksBlock}
Rules:
- Explain what this lab is about, why each step or task matters in the real world, and the underlying concepts (cable types, port roles, protocols, CLI commands) in plain language a beginner can follow.
- When asked for help on a step, explain the reasoning and give a hint first; only spell out the exact action or command if the trainee is clearly stuck or asks directly.
- Stay on this lab's topic. Plain text only, no markdown, at most ~120 words per reply.`;
  return [{ role: "system", content: system }, ...turns.map((t) => ({ role: t.role, content: t.content }))];
}
