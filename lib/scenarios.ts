import type { ScenarioCategory, ScenarioSeed, TranscriptMessage } from "./types";
import type { ChatMessage } from "./openrouter";

export const SCENARIO_CATEGORIES: {
  id: ScenarioCategory;
  label: string;
  blurb: string;
  ticketId: string;
  priority: "P1" | "P2" | "P3";
}[] = [
  { id: "network", label: "Network / Wi-Fi", blurb: "Connectivity drops, VPN failures, DNS issues.", ticketId: "TCK-4471", priority: "P2" },
  { id: "printer", label: "Printer", blurb: "Offline printers, blank pages, driver errors.", ticketId: "TCK-4472", priority: "P3" },
  { id: "password", label: "Password / MFA", blurb: "Lockouts, resets, multi-factor auth trouble.", ticketId: "TCK-4473", priority: "P2" },
  { id: "app-crash", label: "Application Crash", blurb: "Software that won't launch or keeps crashing.", ticketId: "TCK-4474", priority: "P2" },
  { id: "malware", label: "Malware / Quarantine", blurb: "Suspicious alerts, quarantined files, cleanup.", ticketId: "TCK-4475", priority: "P1" },
  { id: "hardware", label: "Hardware Failure", blurb: "Blue screens, dead peripherals, boot failures.", ticketId: "TCK-4476", priority: "P1" },
];

const CATEGORY_LABELS: Record<ScenarioCategory, string> = Object.fromEntries(
  SCENARIO_CATEGORIES.map((c) => [c.id, c.label])
) as Record<ScenarioCategory, string>;

export function isScenarioCategory(value: string): value is ScenarioCategory {
  return SCENARIO_CATEGORIES.some((c) => c.id === value);
}

export function getCategoryMeta(category: ScenarioCategory) {
  return SCENARIO_CATEGORIES.find((c) => c.id === category)!;
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
  return [
    { role: "system", content: system },
    { role: "user", content: "Generate the scenario now." },
  ];
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
