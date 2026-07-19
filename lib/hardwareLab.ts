import type { ChatMessage } from "./openrouter";
import { extractJsonFromText, parseModelJson, ParseError } from "./parsing";

/**
 * 3D PC-hardware assembly lab: a bench with a motherboard (and drive cage),
 * a tray of components, and a build sheet. The trainee clicks a part, then
 * the slot it belongs in — exactly the A+ "PC Hardware" material made tactile.
 */
export type PartKind = "cpu" | "ram" | "m2" | "hdd" | "ssd" | "gpu" | "power";
export type SlotKind = "cpu-socket" | "ram-slot" | "m2-slot" | "drive-bay" | "pcie-slot" | "atx-power";

export interface HardwarePart { id: string; name: string; kind: PartKind }
export interface HardwareSlot { id: string; label: string; kind: SlotKind }
export interface RequiredInstall { part: string; slot: string; step: number; instruction: string }
export interface HardwareScenario {
  title: string; backstory: string;
  parts: HardwarePart[]; slots: HardwareSlot[]; requiredInstalls: RequiredInstall[];
}

/** Which slot kind each part kind physically fits. */
export const PART_FITS: Record<PartKind, SlotKind> = {
  cpu: "cpu-socket",
  ram: "ram-slot",
  m2: "m2-slot",
  hdd: "drive-bay",
  ssd: "drive-bay",
  gpu: "pcie-slot",
  power: "atx-power",
};

export function installKey(partId: string, slotId: string): string {
  return `${partId}>${slotId}`;
}

export type AttemptResult =
  | { ok: true; install: RequiredInstall }
  | { ok: false; reason: "part-installed" | "slot-occupied" | "wrong-slot" };

export function validateInstall(
  scenario: HardwareScenario,
  made: RequiredInstall[],
  partId: string,
  slotId: string
): AttemptResult {
  if (made.some((m) => m.part === partId)) return { ok: false, reason: "part-installed" };
  if (made.some((m) => m.slot === slotId)) return { ok: false, reason: "slot-occupied" };
  const install = scenario.requiredInstalls.find((ri) => ri.part === partId && ri.slot === slotId);
  if (!install) return { ok: false, reason: "wrong-slot" };
  return { ok: true, install };
}

export function isBuildComplete(scenario: HardwareScenario, made: RequiredInstall[]): boolean {
  const done = new Set(made.map((m) => installKey(m.part, m.slot)));
  return scenario.requiredInstalls.every((ri) => done.has(installKey(ri.part, ri.slot)));
}

export function scoreHardwareLab(wrongAttempts: number): number {
  return Math.max(60, 100 - 10 * wrongAttempts);
}

const PART_KINDS: PartKind[] = ["cpu", "ram", "m2", "hdd", "ssd", "gpu", "power"];
const SLOT_KINDS: SlotKind[] = ["cpu-socket", "ram-slot", "m2-slot", "drive-bay", "pcie-slot", "atx-power"];

export function buildHardwareScenarioMessages(brief?: string): ChatMessage[] {
  const jobLine = brief
    ? `Base the lab on this job: ${brief}`
    : "Invent a specific real-world backstory (new office PC build, RAM upgrade gone wrong, dead HDD swap to SSD, GPU install for the design team...) and the hardware job that fixes it.";
  const system = `You are designing a hands-on PC hardware assembly lab for an IT trainee studying CompTIA A+.
${jobLine}
The bench has one motherboard plus a drive cage. Part kinds: ${PART_KINDS.join(", ")}. Slot kinds: ${SLOT_KINDS.join(", ")}.
Physical fit rules the lab enforces: cpu→cpu-socket, ram→ram-slot, m2→m2-slot, hdd/ssd→drive-bay, gpu→pcie-slot, power→atx-power.
Define 4-8 slots (e.g. one cpu-socket, 2-4 ram-slots labeled DIMM_A1/A2/B1/B2, an m2-slot, 1-2 drive-bays, a pcie-slot, an atx-power) and 4-8 parts.
Include 1-2 distractor parts that must NOT be installed (e.g. a DDR3 stick for a DDR4 board, a dying HDD being replaced) — real techs must pick the right component.
3-6 requiredInstalls, numbered steps in the order a real tech would build (CPU before drives, power last), each with a one-sentence instruction that teaches WHY (e.g. matched DIMM slots for dual channel).
Every part/slot referenced in requiredInstalls must be an id you defined, and the pairing must respect the fit rules.
Respond with ONLY a JSON object, no prose, no markdown fences, matching exactly this shape:
{
  "title": "string",
  "backstory": "string, 2-3 sentences",
  "parts": [ { "id": "string", "name": "string, specific model-style name", "kind": "one of the part kinds" } ],
  "slots": [ { "id": "string", "label": "string, short silk-screen label", "kind": "one of the slot kinds" } ],
  "requiredInstalls": [ { "part": "id", "slot": "id", "step": 1, "instruction": "string" } ]
}`;
  return [
    { role: "system", content: system },
    { role: "user", content: "Design the hardware lab now." },
  ];
}

function requireStr(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ParseError(`Expected non-empty string for "${field}"`);
  }
  return value;
}

export function parseHardwareScenario(text: string): HardwareScenario {
  let raw: unknown;
  try {
    raw = parseModelJson(extractJsonFromText(text));
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw new ParseError(`Failed to JSON.parse hardware scenario: ${(err as Error).message}`);
  }
  if (typeof raw !== "object" || raw === null) throw new ParseError("Hardware scenario was not a JSON object");
  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.parts) || obj.parts.length < 2) {
    throw new ParseError("parts must be an array of at least 2");
  }
  const parts: HardwarePart[] = obj.parts.map((p, pi) => {
    const part = p as Record<string, unknown>;
    const kind = part.kind;
    if (typeof kind !== "string" || !PART_KINDS.includes(kind as PartKind)) {
      throw new ParseError(`parts[${pi}].kind invalid: ${JSON.stringify(kind)}`);
    }
    return {
      id: requireStr(part.id, `parts[${pi}].id`),
      name: requireStr(part.name, `parts[${pi}].name`),
      kind: kind as PartKind,
    };
  });

  if (!Array.isArray(obj.slots) || obj.slots.length < 2) {
    throw new ParseError("slots must be an array of at least 2");
  }
  const slots: HardwareSlot[] = obj.slots.map((s, si) => {
    const slot = s as Record<string, unknown>;
    const kind = slot.kind;
    if (typeof kind !== "string" || !SLOT_KINDS.includes(kind as SlotKind)) {
      throw new ParseError(`slots[${si}].kind invalid: ${JSON.stringify(kind)}`);
    }
    return {
      id: requireStr(slot.id, `slots[${si}].id`),
      label: requireStr(slot.label, `slots[${si}].label`),
      kind: kind as SlotKind,
    };
  });

  const partById = new Map(parts.map((p) => [p.id, p]));
  const slotById = new Map(slots.map((s) => [s.id, s]));

  if (!Array.isArray(obj.requiredInstalls) || obj.requiredInstalls.length === 0) {
    throw new ParseError("requiredInstalls must be a non-empty array");
  }
  const requiredInstalls: RequiredInstall[] = obj.requiredInstalls.map((c, ci) => {
    const ri = c as Record<string, unknown>;
    const install: RequiredInstall = {
      part: requireStr(ri.part, `requiredInstalls[${ci}].part`),
      slot: requireStr(ri.slot, `requiredInstalls[${ci}].slot`),
      step: typeof ri.step === "number" ? ri.step : ci + 1,
      instruction: requireStr(ri.instruction, `requiredInstalls[${ci}].instruction`),
    };
    const part = partById.get(install.part);
    const slot = slotById.get(install.slot);
    if (!part) throw new ParseError(`requiredInstalls[${ci}] references unknown part ${install.part}`);
    if (!slot) throw new ParseError(`requiredInstalls[${ci}] references unknown slot ${install.slot}`);
    if (PART_FITS[part.kind] !== slot.kind) {
      throw new ParseError(`requiredInstalls[${ci}]: a ${part.kind} does not fit a ${slot.kind}`);
    }
    return install;
  });

  return {
    title: requireStr(obj.title, "title"),
    backstory: requireStr(obj.backstory, "backstory"),
    parts,
    slots,
    requiredInstalls,
  };
}

export const FALLBACK_HARDWARE_SCENARIOS: HardwareScenario[] = [
  {
    title: "Front-desk PC build-out",
    backstory:
      "Reception's new workstation arrived as a bare board and a box of parts. Build it on the bench: CPU first, matched memory for dual channel, the NVMe boot drive, and power it up.",
    parts: [
      { id: "cpu1", name: "Core i5-13400", kind: "cpu" },
      { id: "ram1", name: "8GB DDR4-3200 (stick 1)", kind: "ram" },
      { id: "ram2", name: "8GB DDR4-3200 (stick 2)", kind: "ram" },
      { id: "ram-old", name: "4GB DDR3-1600 (won't fit — old stock)", kind: "ram" },
      { id: "nvme1", name: "500GB NVMe SSD", kind: "m2" },
      { id: "atx1", name: "24-pin ATX cable", kind: "power" },
    ],
    slots: [
      { id: "socket", label: "LGA1700", kind: "cpu-socket" },
      { id: "dimm-a1", label: "DIMM_A1", kind: "ram-slot" },
      { id: "dimm-a2", label: "DIMM_A2", kind: "ram-slot" },
      { id: "dimm-b1", label: "DIMM_B1", kind: "ram-slot" },
      { id: "dimm-b2", label: "DIMM_B2", kind: "ram-slot" },
      { id: "m2-1", label: "M.2_1", kind: "m2-slot" },
      { id: "atx", label: "ATX_PWR", kind: "atx-power" },
    ],
    requiredInstalls: [
      { part: "cpu1", slot: "socket", step: 1, instruction: "Seat the CPU in the LGA1700 socket — always the first component, before anything blocks access." },
      { part: "ram1", slot: "dimm-a2", step: 2, instruction: "First DDR4 stick into DIMM_A2 — boards populate the second slot of each channel first." },
      { part: "ram2", slot: "dimm-b2", step: 3, instruction: "Second stick into DIMM_B2 so the pair runs in dual channel (the DDR3 stick is keyed differently — leave it)." },
      { part: "nvme1", slot: "m2-1", step: 4, instruction: "The NVMe boot drive slides into M.2_1 — no cables, it rides the PCIe bus." },
      { part: "atx1", slot: "atx", step: 5, instruction: "Power last: the 24-pin ATX cable into ATX_PWR once everything is seated." },
    ],
  },
  {
    title: "Dying HDD to SSD swap",
    backstory:
      "The warehouse PC's spinning drive is throwing SMART pending-sector warnings. Swap storage to the new 2.5\" SSD, add an NVMe scratch disk, and reconnect power.",
    parts: [
      { id: "ssd1", name: "1TB 2.5\" SATA SSD", kind: "ssd" },
      { id: "hdd-old", name: "500GB HDD (SMART failing — do NOT reinstall)", kind: "hdd" },
      { id: "nvme1", name: "256GB NVMe scratch drive", kind: "m2" },
      { id: "atx1", name: "24-pin ATX cable", kind: "power" },
    ],
    slots: [
      { id: "bay1", label: "BAY 1", kind: "drive-bay" },
      { id: "bay2", label: "BAY 2", kind: "drive-bay" },
      { id: "m2-1", label: "M.2_1", kind: "m2-slot" },
      { id: "atx", label: "ATX_PWR", kind: "atx-power" },
    ],
    requiredInstalls: [
      { part: "ssd1", slot: "bay1", step: 1, instruction: "Mount the replacement SATA SSD in BAY 1 — the failing HDD stays on the bench for secure disposal." },
      { part: "nvme1", slot: "m2-1", step: 2, instruction: "Add the NVMe scratch drive to M.2_1 for the label-printing spool." },
      { part: "atx1", slot: "atx", step: 3, instruction: "Reconnect the 24-pin ATX power cable to bring the board back up." },
    ],
  },
  {
    title: "Design-team GPU and memory upgrade",
    backstory:
      "Marketing's render box needs a discrete GPU and a memory bump before the campaign deadline. Install the card, pair the new RAM correctly, and re-seat power.",
    parts: [
      { id: "gpu1", name: "GeForce RTX A2000", kind: "gpu" },
      { id: "ram1", name: "16GB DDR4-3600 (stick 1)", kind: "ram" },
      { id: "ram2", name: "16GB DDR4-3600 (stick 2)", kind: "ram" },
      { id: "hdd-old", name: "Old 7200rpm HDD (retired — leave out)", kind: "hdd" },
      { id: "atx1", name: "24-pin ATX cable", kind: "power" },
    ],
    slots: [
      { id: "pcie1", label: "PCIE_X16", kind: "pcie-slot" },
      { id: "dimm-a2", label: "DIMM_A2", kind: "ram-slot" },
      { id: "dimm-b2", label: "DIMM_B2", kind: "ram-slot" },
      { id: "atx", label: "ATX_PWR", kind: "atx-power" },
    ],
    requiredInstalls: [
      { part: "ram1", slot: "dimm-a2", step: 1, instruction: "First 16GB stick into DIMM_A2 — matched slots keep the render box in dual channel." },
      { part: "ram2", slot: "dimm-b2", step: 2, instruction: "Second stick into DIMM_B2 to complete the pair." },
      { part: "gpu1", slot: "pcie1", step: 3, instruction: "Seat the GPU firmly in the PCIE_X16 slot until the retention clip clicks." },
      { part: "atx1", slot: "atx", step: 4, instruction: "Reconnect the 24-pin ATX cable — power always goes back last." },
    ],
  },
];
