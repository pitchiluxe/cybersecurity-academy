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
  { id: "vm", label: "Virtual Machine / VDI", blurb: "VMs that won't boot, snapshots, RDP/VDI sessions, hypervisor trouble.", ticketId: "TCK-4477", priority: "P2" },
  { id: "phishing", label: "Phishing / Social Engineering", blurb: "Suspicious emails, credential lures, reported clicks.", ticketId: "TCK-4478", priority: "P1" },
  { id: "firewall", label: "Firewall / Network Security", blurb: "Blocked apps, NAT and policy issues, tunnel drops.", ticketId: "TCK-4479", priority: "P2" },
  { id: "siem", label: "SIEM / IDS Alert", blurb: "Correlated alerts, brute-force spikes, odd beaconing.", ticketId: "TCK-4480", priority: "P1" },
  { id: "access", label: "Access Control / IAM", blurb: "Group membership, least privilege, SSO and provisioning.", ticketId: "TCK-4481", priority: "P2" },
  { id: "cloud", label: "Cloud / SaaS", blurb: "Tenant settings, sync failures, storage and licensing.", ticketId: "TCK-4482", priority: "P2" },
  { id: "linux", label: "Linux Server", blurb: "Services down, disk full, permissions, cron gone wrong.", ticketId: "TCK-4483", priority: "P2" },
  { id: "pentest", label: "Vulnerability / Pentest Finding", blurb: "Scan findings, exposed services, patch verification.", ticketId: "TCK-4484", priority: "P2" },
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
- Professional, clear, empathetic tone throughout
- Documented clear, accurate resolution notes when closing the ticket`;

export const SLA_TARGETS: Record<"P1" | "P2" | "P3", { respond: string; resolve: string }> = {
  P1: { respond: "15 min", resolve: "4 h" },
  P2: { respond: "1 h", resolve: "8 h" },
  P3: { respond: "4 h", resolve: "3 days" },
};

export const REMOTE_TOOLS: { label: string; command: string }[] = [
  { label: "Ping gateway", command: "/run ping -n 4 default-gateway" },
  { label: "IP config", command: "/run ipconfig /all" },
  { label: "Event log (recent errors)", command: "/run wevtutil qe System /c:5 /rd:true /f:text" },
  { label: "Print spooler status", command: "/run sc query spooler" },
  { label: "Disk health", command: "/run wmic diskdrive get status,model" },
  { label: "System info", command: "/run systeminfo" },
];

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

export const MIN_QUEUE_TICKETS = 5;
export const MAX_QUEUE_TICKETS = 10;

/** Random queue size, 5-10 inclusive — used whenever the client doesn't ask for a specific count. */
export function randomQueueCount(): number {
  return MIN_QUEUE_TICKETS + Math.floor(Math.random() * (MAX_QUEUE_TICKETS - MIN_QUEUE_TICKETS + 1));
}

export function buildQueueMessages(count: number, varietySeed: number = Math.floor(Math.random() * 1_000_000)): ChatMessage[] {
  const categoryList = SCENARIO_CATEGORIES.map((c) => `"${c.id}" (${c.label})`).join(", ");
  const system = `You are generating a queue of ${count} training tickets for an IT helpdesk trainee.
The available categories are: ${categoryList}.
Invent ${count} plausible, specific, non-generic end-user personas and problems, spread roughly evenly across all ${SCENARIO_CATEGORIES.length} categories — do not use the same category more than twice. Make up a name, department, device/OS, and a concrete root cause a real technician could diagnose from symptoms alone for each one.
Variety seed: ${varietySeed}. Every batch must feel different: vary names across cultures, vary departments and industries, vary device brands and OS versions, and pick root causes beyond the obvious clichés (not always "driver update broke it"). Include real-world messiness — vague users, secondhand reports, problems that started after office moves, updates, or new equipment.
Respond with ONLY a JSON array of ${count} objects, no prose, no markdown fences, where each object matches exactly this shape:
{
  "category": "one of the category ids listed above, exactly as written",
  "persona": { "name": "string", "department": "string" },
  "environment": { "os": "string", "device": "string", "detail": "string" },
  "rootCause": "string, the underlying technical cause — the trainee must never see this directly",
  "openingMessage": "string, the end-user's first message describing the problem in their own words, 2-4 sentences, no jargon"
}`;
  return [
    { role: "system", content: system },
    { role: "user", content: "Generate the ticket queue now." },
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
Stay in character as the end-user. Answer the technician's questions plausibly based on the root cause, describing symptoms you would actually observe — never state the root cause outright, and never use technical jargon a typical end-user wouldn't know. If the technician's fix genuinely resolves the root cause, confirm it works. Keep replies to 1-3 sentences.

Exception — remote diagnostics: if the technician's latest message starts with "/run ", it is a remote command executed on your machine by the IT remote-management tool, not something said to you. Respond with ONLY the plausible raw terminal/tool output of that command on your machine (Windows-style where applicable), consistent with the hidden root cause. No prose, no roleplay, no markdown fences, no explanation — output text only, max ~12 lines. The output may contain clues pointing toward the root cause but must never name it outright.`;
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
