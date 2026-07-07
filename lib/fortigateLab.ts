import type { ChatMessage } from "./openrouter";
import type { VmExchange } from "./vm";
import { extractJsonFromText, ParseError } from "./parsing";
import { parseWiringScenario, type LabDevice, type RequiredConnection } from "./wiringLab";

export interface FortigateTask {
  id: string;
  instruction: string;
}

export interface FortigateScenario {
  title: string;
  backstory: string;
  devices: LabDevice[];
  wiring: RequiredConnection[];
  tasks: FortigateTask[];
}

export const LAB_COMPLETE_MARKER = "[LAB_COMPLETE]";
const TASK_DONE_RE = /\[TASK_DONE:([\w-]+)\]/g;

export function scoreFortigateLab(wrongAttempts: number, hintsUsed: number): number {
  return Math.max(60, 100 - 5 * wrongAttempts - 5 * hintsUsed);
}

export function extractTaskMarkers(output: string): { cleaned: string; doneIds: string[]; complete: boolean } {
  const doneIds: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(TASK_DONE_RE.source, "g");
  while ((m = re.exec(output)) !== null) doneIds.push(m[1]);
  const complete = output.includes(LAB_COMPLETE_MARKER);
  const cleaned = output
    .replace(new RegExp(TASK_DONE_RE.source, "g"), "")
    .replaceAll(LAB_COMPLETE_MARKER, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
  return { cleaned, doneIds, complete };
}

export function buildFortigateScenarioMessages(): ChatMessage[] {
  const system = `You are designing a FortiGate firewall deployment lab for an IT trainee — a realistic job a field engineer gets.
Pick one real-world job (new branch FortiGate deployment, web filtering rollout, port-forward for a camera NVR, IPsec tunnel repair) and write:
- devices: the FortiGate (kind "firewall", ports wan1, wan2, lan1-lan3, dmz — port kind "wan" for wan1/wan2, "lan" otherwise), an ISP modem (kind "modem"), and a LAN switch (kind "switch") — same shape as a wiring lab.
- wiring: 2-3 required cable runs (modem→wan1, lan1→switch uplink, ...), numbered steps with instructions.
- tasks: 3-5 FortiOS configuration tasks with kebab-case ids and precise instructions (e.g. "set WAN1 to DHCP client", "create LAN-to-WAN policy with NAT enabled", "block social-media category via web filter").
Respond with ONLY a JSON object, no prose, no markdown fences:
{
  "title": "string",
  "backstory": "string, 2-3 sentences",
  "devices": [ { "id": "string", "name": "string", "kind": "firewall|modem|switch", "ports": [ { "id": "string", "label": "string", "kind": "wan|lan|uplink|console" } ] } ],
  "wiring": [ { "fromDevice": "id", "fromPort": "id", "toDevice": "id", "toPort": "id", "cable": "ethernet", "step": 1, "instruction": "string" } ],
  "tasks": [ { "id": "kebab-case-id", "instruction": "string" } ]
}`;
  return [
    { role: "system", content: system },
    { role: "user", content: "Design the FortiGate lab now." },
  ];
}

function requireStr(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ParseError(`Expected non-empty string for "${field}"`);
  }
  return value;
}

export function parseFortigateScenario(text: string): FortigateScenario {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonFromText(text));
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw new ParseError(`Failed to JSON.parse FortiGate scenario: ${(err as Error).message}`);
  }
  if (typeof raw !== "object" || raw === null) throw new ParseError("FortiGate scenario was not a JSON object");
  const obj = raw as Record<string, unknown>;

  // Delegate device/wiring validation to the wiring-lab parser.
  const wiringPart = parseWiringScenario(
    JSON.stringify({
      title: obj.title ?? "x",
      backstory: obj.backstory ?? "x",
      devices: obj.devices,
      requiredConnections: obj.wiring,
    })
  );

  if (!Array.isArray(obj.tasks) || obj.tasks.length < 2) {
    throw new ParseError("tasks must be an array of at least 2");
  }
  const tasks: FortigateTask[] = obj.tasks.map((t, ti) => {
    const task = t as Record<string, unknown>;
    return {
      id: requireStr(task.id, `tasks[${ti}].id`),
      instruction: requireStr(task.instruction, `tasks[${ti}].instruction`),
    };
  });

  return {
    title: requireStr(obj.title, "title"),
    backstory: requireStr(obj.backstory, "backstory"),
    devices: wiringPart.devices,
    wiring: wiringPart.requiredConnections,
    tasks,
  };
}

export function buildFortigateExecMessages(
  scenario: FortigateScenario,
  doneTaskIds: string[],
  history: VmExchange[],
  command: string
): ChatMessage[] {
  const taskList = scenario.tasks
    .map((t) => `- [${doneTaskIds.includes(t.id) ? "done" : "open"}] id=${t.id}: ${t.instruction}`)
    .join("\n");
  const system = `You are simulating the CLI of a factory-fresh FortiGate 60F (FortiOS 7.4) in a training lab.
Scenario: ${scenario.title} — ${scenario.backstory}
Configuration tasks (with completion state):
${taskList}
Rules:
- Each user message is a command typed at the FortiOS CLI. Respond with ONLY the raw CLI output, exactly as FortiOS would print it (config shells, "end" to commit, get/diagnose/execute output, real FortiOS error messages for invalid syntax). No prose, no markdown, max ~25 lines.
- Track configuration state across the whole session: settings made earlier persist and are visible in later "show"/"get" output.
- When the trainee's commands have genuinely completed an OPEN task, append this exact marker on its own line: [TASK_DONE:<task id>]. Never emit it for tasks already marked done, and never before the config is actually committed.
- When ALL tasks are done, additionally append: ${LAB_COMPLETE_MARKER}`;
  const turns: ChatMessage[] = history.flatMap((h) => [
    { role: "user" as const, content: h.command },
    { role: "assistant" as const, content: h.output },
  ]);
  return [{ role: "system", content: system }, ...turns, { role: "user", content: command }];
}

export const FALLBACK_FORTIGATE_SCENARIO: FortigateScenario = {
  title: "Branch FortiGate deployment",
  backstory:
    "The Rivertown branch just received a factory-fresh FortiGate 60F. The ISP modem is live and the LAN switch is racked. Cable it in, then bring the branch online with a basic secure config.",
  devices: [
    { id: "modem", name: "ISP Modem", kind: "modem", ports: [{ id: "eth1", label: "ETH1", kind: "wan" }] },
    { id: "fgt", name: "FortiGate 60F", kind: "firewall", ports: [
      { id: "wan1", label: "WAN1", kind: "wan" },
      { id: "wan2", label: "WAN2", kind: "wan" },
      { id: "lan1", label: "LAN1", kind: "lan" },
      { id: "lan2", label: "LAN2", kind: "lan" },
      { id: "dmz", label: "DMZ", kind: "lan" },
    ] },
    { id: "sw", name: "Branch Switch", kind: "switch", ports: [{ id: "up1", label: "UPLINK", kind: "uplink" }] },
  ],
  wiring: [
    { fromDevice: "modem", fromPort: "eth1", toDevice: "fgt", toPort: "wan1", cable: "ethernet", step: 1, instruction: "ISP modem ETH1 into FortiGate WAN1." },
    { fromDevice: "fgt", fromPort: "lan1", toDevice: "sw", toPort: "up1", cable: "ethernet", step: 2, instruction: "FortiGate LAN1 down to the branch switch UPLINK." },
  ],
  tasks: [
    { id: "wan1-dhcp", instruction: "Configure WAN1 as a DHCP client (config system interface → edit wan1 → set mode dhcp)." },
    { id: "lan-ip", instruction: "Give LAN1 the address 192.168.10.1/24 and allow ping for testing." },
    { id: "policy-lan-wan", instruction: "Create a firewall policy allowing LAN1 → WAN1 with NAT enabled." },
    { id: "block-social", instruction: "Block the social-media web category on that policy using a web filter profile." },
  ],
};
