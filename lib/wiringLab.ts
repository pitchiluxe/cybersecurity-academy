import type { ChatMessage } from "./openrouter";
import { extractJsonFromText, ParseError } from "./parsing";

export type DeviceKind = "modem" | "router" | "switch" | "patchpanel" | "pc" | "ap" | "firewall";
export type PortKind = "wan" | "lan" | "uplink" | "console";
export type CableKind = "ethernet" | "fiber" | "console";

export interface LabPort { id: string; label: string; kind: PortKind }
export interface LabDevice { id: string; name: string; kind: DeviceKind; ports: LabPort[] }
export interface RequiredConnection {
  fromDevice: string; fromPort: string; toDevice: string; toPort: string;
  cable: CableKind; step: number; instruction: string;
}
export interface WiringScenario {
  title: string; backstory: string;
  devices: LabDevice[]; requiredConnections: RequiredConnection[];
}
export interface PortRef { device: string; port: string }

export function connectionKey(a: PortRef, b: PortRef): string {
  const ka = `${a.device}:${a.port}`;
  const kb = `${b.device}:${b.port}`;
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

export function requiredKey(rc: RequiredConnection): string {
  return connectionKey({ device: rc.fromDevice, port: rc.fromPort }, { device: rc.toDevice, port: rc.toPort });
}

export function validateAttempt(
  scenario: WiringScenario,
  made: Set<string>,
  a: PortRef,
  b: PortRef
): { ok: true; connection: RequiredConnection } | { ok: false; reason: "not-required" | "already-made" } {
  const key = connectionKey(a, b);
  if (made.has(key)) return { ok: false, reason: "already-made" };
  const connection = scenario.requiredConnections.find((rc) => requiredKey(rc) === key);
  if (!connection) return { ok: false, reason: "not-required" };
  return { ok: true, connection };
}

export function isComplete(scenario: WiringScenario, made: Set<string>): boolean {
  return scenario.requiredConnections.every((rc) => made.has(requiredKey(rc)));
}

export function scoreLab(wrongAttempts: number): number {
  return Math.max(60, 100 - 10 * wrongAttempts);
}

const DEVICE_KINDS: DeviceKind[] = ["modem", "router", "switch", "patchpanel", "pc", "ap", "firewall"];
const PORT_KINDS: PortKind[] = ["wan", "lan", "uplink", "console"];
const CABLE_KINDS: CableKind[] = ["ethernet", "fiber", "console"];

export function buildWiringScenarioMessages(brief?: string): ChatMessage[] {
  const jobLine = brief
    ? `Base the lab on this dispatched job: ${brief}`
    : "Invent a specific real-world backstory (new branch buildout, dead uplink after an office move, AP rollout...) and the physical wiring job that fixes it.";
  const system = `You are designing a hands-on network wiring lab for an IT trainee, set in a realistic small office or branch.
${jobLine}
Use 4-6 devices from kinds: ${DEVICE_KINDS.join(", ")}. Port kinds: ${PORT_KINDS.join(", ")}. Cables: ${CABLE_KINDS.join(", ")}.
3-6 requiredConnections, numbered steps in the order a real tech would wire them, each with a one-sentence instruction.
Every fromDevice/toDevice must be a device id you defined, and every fromPort/toPort a port id on that device.
Respond with ONLY a JSON object, no prose, no markdown fences, matching exactly this shape:
{
  "title": "string",
  "backstory": "string, 2-3 sentences",
  "devices": [ { "id": "string", "name": "string", "kind": "one of the device kinds", "ports": [ { "id": "string", "label": "string", "kind": "one of the port kinds" } ] } ],
  "requiredConnections": [ { "fromDevice": "id", "fromPort": "id", "toDevice": "id", "toPort": "id", "cable": "one of the cable kinds", "step": 1, "instruction": "string" } ]
}`;
  return [
    { role: "system", content: system },
    { role: "user", content: "Design the wiring lab now." },
  ];
}

function requireStr(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ParseError(`Expected non-empty string for "${field}"`);
  }
  return value;
}

export function parseWiringScenario(text: string): WiringScenario {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonFromText(text));
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw new ParseError(`Failed to JSON.parse wiring scenario: ${(err as Error).message}`);
  }
  if (typeof raw !== "object" || raw === null) throw new ParseError("Wiring scenario was not a JSON object");
  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.devices) || obj.devices.length < 2) {
    throw new ParseError("devices must be an array of at least 2");
  }
  const devices: LabDevice[] = obj.devices.map((d, di) => {
    const dev = d as Record<string, unknown>;
    const kind = dev.kind;
    if (typeof kind !== "string" || !DEVICE_KINDS.includes(kind as DeviceKind)) {
      throw new ParseError(`devices[${di}].kind invalid: ${JSON.stringify(kind)}`);
    }
    if (!Array.isArray(dev.ports) || dev.ports.length === 0) {
      throw new ParseError(`devices[${di}].ports must be a non-empty array`);
    }
    const ports: LabPort[] = dev.ports.map((p, pi) => {
      const port = p as Record<string, unknown>;
      const pk = port.kind;
      if (typeof pk !== "string" || !PORT_KINDS.includes(pk as PortKind)) {
        throw new ParseError(`devices[${di}].ports[${pi}].kind invalid`);
      }
      return {
        id: requireStr(port.id, `devices[${di}].ports[${pi}].id`),
        label: requireStr(port.label, `devices[${di}].ports[${pi}].label`),
        kind: pk as PortKind,
      };
    });
    return {
      id: requireStr(dev.id, `devices[${di}].id`),
      name: requireStr(dev.name, `devices[${di}].name`),
      kind: kind as DeviceKind,
      ports,
    };
  });

  const portSet = new Set(devices.flatMap((d) => d.ports.map((p) => `${d.id}:${p.id}`)));

  if (!Array.isArray(obj.requiredConnections) || obj.requiredConnections.length === 0) {
    throw new ParseError("requiredConnections must be a non-empty array");
  }
  const requiredConnections: RequiredConnection[] = obj.requiredConnections.map((c, ci) => {
    const rc = c as Record<string, unknown>;
    const cable = rc.cable;
    if (typeof cable !== "string" || !CABLE_KINDS.includes(cable as CableKind)) {
      throw new ParseError(`requiredConnections[${ci}].cable invalid`);
    }
    const conn: RequiredConnection = {
      fromDevice: requireStr(rc.fromDevice, `requiredConnections[${ci}].fromDevice`),
      fromPort: requireStr(rc.fromPort, `requiredConnections[${ci}].fromPort`),
      toDevice: requireStr(rc.toDevice, `requiredConnections[${ci}].toDevice`),
      toPort: requireStr(rc.toPort, `requiredConnections[${ci}].toPort`),
      cable: cable as CableKind,
      step: typeof rc.step === "number" ? rc.step : ci + 1,
      instruction: requireStr(rc.instruction, `requiredConnections[${ci}].instruction`),
    };
    for (const [dev, port] of [[conn.fromDevice, conn.fromPort], [conn.toDevice, conn.toPort]] as const) {
      if (!portSet.has(`${dev}:${port}`)) {
        throw new ParseError(`requiredConnections[${ci}] references unknown port ${dev}:${port}`);
      }
    }
    return conn;
  });

  return {
    title: requireStr(obj.title, "title"),
    backstory: requireStr(obj.backstory, "backstory"),
    devices,
    requiredConnections,
  };
}

export const FALLBACK_WIRING_SCENARIOS: WiringScenario[] = [
  {
    title: "New branch office buildout",
    backstory: "Sales just moved into the Elm Street branch. The ISP handoff is live, but nothing behind it is wired. Bring the front desk online.",
    devices: [
      { id: "modem", name: "ISP Modem", kind: "modem", ports: [{ id: "eth1", label: "ETH1", kind: "wan" }] },
      { id: "rtr", name: "Edge Router", kind: "router", ports: [
        { id: "wan1", label: "WAN1", kind: "wan" },
        { id: "lan1", label: "LAN1", kind: "lan" },
      ] },
      { id: "sw", name: "Access Switch", kind: "switch", ports: [
        { id: "up1", label: "UPLINK", kind: "uplink" },
        { id: "p1", label: "P1", kind: "lan" },
        { id: "p2", label: "P2", kind: "lan" },
      ] },
      { id: "pc1", name: "Front-desk PC", kind: "pc", ports: [{ id: "nic", label: "NIC", kind: "lan" }] },
      { id: "ap1", name: "Ceiling AP", kind: "ap", ports: [{ id: "poe", label: "PoE", kind: "lan" }] },
    ],
    requiredConnections: [
      { fromDevice: "modem", fromPort: "eth1", toDevice: "rtr", toPort: "wan1", cable: "ethernet", step: 1, instruction: "Patch the ISP modem ETH1 into the router WAN1." },
      { fromDevice: "rtr", fromPort: "lan1", toDevice: "sw", toPort: "up1", cable: "ethernet", step: 2, instruction: "Feed the switch: router LAN1 to switch UPLINK." },
      { fromDevice: "sw", fromPort: "p1", toDevice: "pc1", toPort: "nic", cable: "ethernet", step: 3, instruction: "Drop the front-desk PC onto switch port P1." },
      { fromDevice: "sw", fromPort: "p2", toDevice: "ap1", toPort: "poe", cable: "ethernet", step: 4, instruction: "Power the ceiling AP from switch port P2 (PoE)." },
    ],
  },
  {
    title: "Dead uplink after office move",
    backstory: "Facilities moved the comms cabinet over the weekend and the whole floor is offline. The patch panel was left unplugged. Restore the chain from wall to switch.",
    devices: [
      { id: "modem", name: "Fiber ONT", kind: "modem", ports: [{ id: "gpon", label: "LAN", kind: "wan" }] },
      { id: "fw", name: "Perimeter Firewall", kind: "firewall", ports: [
        { id: "wan1", label: "WAN1", kind: "wan" },
        { id: "lan1", label: "LAN1", kind: "lan" },
      ] },
      { id: "pp", name: "Patch Panel", kind: "patchpanel", ports: [
        { id: "a1", label: "A1", kind: "lan" },
        { id: "a2", label: "A2", kind: "lan" },
      ] },
      { id: "sw", name: "Floor Switch", kind: "switch", ports: [
        { id: "up1", label: "UPLINK", kind: "uplink" },
      ] },
    ],
    requiredConnections: [
      { fromDevice: "modem", fromPort: "gpon", toDevice: "fw", toPort: "wan1", cable: "fiber", step: 1, instruction: "ONT to firewall WAN1 with the fiber patch lead." },
      { fromDevice: "fw", fromPort: "lan1", toDevice: "pp", toPort: "a1", cable: "ethernet", step: 2, instruction: "Firewall LAN1 into patch panel A1." },
      { fromDevice: "pp", fromPort: "a2", toDevice: "sw", toPort: "up1", cable: "ethernet", step: 3, instruction: "Patch panel A2 down to the floor switch UPLINK." },
    ],
  },
  {
    title: "Conference room AP rollout",
    backstory: "Two new conference rooms need Wi-Fi before Monday's all-hands. Switch capacity is ready; wire the APs and verify the uplink chain.",
    devices: [
      { id: "rtr", name: "Core Router", kind: "router", ports: [{ id: "lan1", label: "LAN1", kind: "lan" }] },
      { id: "sw", name: "PoE Switch", kind: "switch", ports: [
        { id: "up1", label: "UPLINK", kind: "uplink" },
        { id: "p7", label: "P7", kind: "lan" },
        { id: "p8", label: "P8", kind: "lan" },
      ] },
      { id: "ap1", name: "AP — Conf Room A", kind: "ap", ports: [{ id: "poe", label: "PoE", kind: "lan" }] },
      { id: "ap2", name: "AP — Conf Room B", kind: "ap", ports: [{ id: "poe", label: "PoE", kind: "lan" }] },
    ],
    requiredConnections: [
      { fromDevice: "rtr", fromPort: "lan1", toDevice: "sw", toPort: "up1", cable: "ethernet", step: 1, instruction: "Verify the core: router LAN1 to switch UPLINK." },
      { fromDevice: "sw", fromPort: "p7", toDevice: "ap1", toPort: "poe", cable: "ethernet", step: 2, instruction: "Conf Room A AP onto PoE port P7." },
      { fromDevice: "sw", fromPort: "p8", toDevice: "ap2", toPort: "poe", cable: "ethernet", step: 3, instruction: "Conf Room B AP onto PoE port P8." },
    ],
  },
];
