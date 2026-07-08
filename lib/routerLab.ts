import type { ChatMessage } from "./openrouter";
import type { VmExchange } from "./vm";
import {
  parseFortigateScenario,
  LAB_COMPLETE_MARKER,
  type FortigateScenario,
} from "./fortigateLab";

/**
 * Router configuration lab: cable a Cisco-style branch router in 3D, then
 * configure it over an IOS CLI. Structurally identical to the FortiGate lab
 * (devices + wiring + tasks), so it reuses that scenario shape and parser.
 */
export type RouterScenario = FortigateScenario;

export function buildRouterScenarioMessages(brief?: string): ChatMessage[] {
  const jobLine = brief
    ? `Base the lab on this dispatched job: ${brief}`
    : "Pick one real-world job (new branch router turn-up, replace a dead router, NAT/DHCP rollout, inter-VLAN routing, default-route repair)";
  const system = `You are designing a Cisco branch-router deployment lab for an IT trainee — a realistic job a field engineer gets.
${jobLine} and write:
- devices: the router (kind "router", ports gi0-0 and gi0-1 minimum — label them GI0/0, GI0/1; port kind "wan" for the internet-facing port, "lan" otherwise), an ISP modem (kind "modem"), and a LAN switch (kind "switch") — same shape as a wiring lab.
- wiring: 2-3 required cable runs (modem→gi0-0, gi0-1→switch uplink, ...), numbered steps with instructions.
- tasks: 3-5 Cisco IOS configuration tasks with kebab-case ids and precise instructions (e.g. "set hostname BRANCH-R1", "give GigabitEthernet0/1 the address 192.168.20.1/24 and bring it up", "configure a DHCP pool for the LAN", "add a default route via DHCP on Gi0/0", "enable NAT overload from LAN to WAN").
Respond with ONLY a JSON object, no prose, no markdown fences:
{
  "title": "string",
  "backstory": "string, 2-3 sentences",
  "devices": [ { "id": "string", "name": "string", "kind": "router|modem|switch", "ports": [ { "id": "string", "label": "string", "kind": "wan|lan|uplink|console" } ] } ],
  "wiring": [ { "fromDevice": "id", "fromPort": "id", "toDevice": "id", "toPort": "id", "cable": "ethernet", "step": 1, "instruction": "string" } ],
  "tasks": [ { "id": "kebab-case-id", "instruction": "string" } ]
}`;
  return [
    { role: "system", content: system },
    { role: "user", content: "Design the router lab now." },
  ];
}

export function parseRouterScenario(text: string): RouterScenario {
  return parseFortigateScenario(text);
}

export function buildRouterExecMessages(
  scenario: RouterScenario,
  doneTaskIds: string[],
  history: VmExchange[],
  command: string
): ChatMessage[] {
  const taskList = scenario.tasks
    .map((t) => `- [${doneTaskIds.includes(t.id) ? "done" : "open"}] id=${t.id}: ${t.instruction}`)
    .join("\n");
  const system = `You are simulating the CLI of a factory-fresh Cisco ISR 1100 router (IOS-XE 17) in a training lab.
Scenario: ${scenario.title} — ${scenario.backstory}
Configuration tasks (with completion state):
${taskList}
Rules:
- Each user message is a command typed at the IOS CLI. Respond with ONLY the raw CLI output, exactly as IOS would print it: correct prompts per mode (Router>, Router#, Router(config)#, Router(config-if)#...), "% Invalid input detected" / "% Incomplete command." for bad syntax, real show/ping output. If the hostname is changed, use it in later prompts. No prose, no markdown, max ~25 lines.
- Track configuration state across the whole session: settings made earlier persist and are visible in later "show running-config"/"show ip interface brief" output.
- When the trainee's commands have genuinely completed an OPEN task, append this exact marker on its own line: [TASK_DONE:<task id>]. Never emit it for tasks already marked done, and never before the config is actually applied.
- When ALL tasks are done, additionally append: ${LAB_COMPLETE_MARKER}`;
  const turns: ChatMessage[] = history.flatMap((h) => [
    { role: "user" as const, content: h.command },
    { role: "assistant" as const, content: h.output },
  ]);
  return [{ role: "system", content: system }, ...turns, { role: "user", content: command }];
}

export const FALLBACK_ROUTER_SCENARIO: RouterScenario = {
  title: "Branch router turn-up",
  backstory:
    "The Oakdale branch just got a replacement Cisco ISR after the old one died in a power surge. The ISP modem is live and the LAN switch is racked. Cable it in, then bring the branch back online.",
  devices: [
    { id: "modem", name: "ISP Modem", kind: "modem", ports: [{ id: "eth1", label: "ETH1", kind: "wan" }] },
    { id: "rtr", name: "Cisco ISR 1100", kind: "router", ports: [
      { id: "gi0-0", label: "GI0/0", kind: "wan" },
      { id: "gi0-1", label: "GI0/1", kind: "lan" },
    ] },
    { id: "sw", name: "Branch Switch", kind: "switch", ports: [{ id: "up1", label: "UPLINK", kind: "uplink" }] },
  ],
  wiring: [
    { fromDevice: "modem", fromPort: "eth1", toDevice: "rtr", toPort: "gi0-0", cable: "ethernet", step: 1, instruction: "ISP modem ETH1 into router GI0/0." },
    { fromDevice: "rtr", fromPort: "gi0-1", toDevice: "sw", toPort: "up1", cable: "ethernet", step: 2, instruction: "Router GI0/1 down to the branch switch UPLINK." },
  ],
  tasks: [
    { id: "hostname", instruction: "Set the hostname to OAKDALE-R1." },
    { id: "wan-dhcp", instruction: "Configure GigabitEthernet0/0 as a DHCP client and bring it up." },
    { id: "lan-ip", instruction: "Give GigabitEthernet0/1 the address 192.168.20.1/24 and bring it up." },
    { id: "dhcp-pool", instruction: "Create a DHCP pool for 192.168.20.0/24 with the router as default gateway." },
    { id: "nat-overload", instruction: "Enable NAT overload so LAN hosts reach the internet via GI0/0." },
  ],
};
