import {
  validateInstall,
  isBuildComplete,
  scoreHardwareLab,
  parseHardwareScenario,
  buildHardwareScenarioMessages,
  PART_FITS,
  FALLBACK_HARDWARE_SCENARIOS,
  type HardwareScenario,
  type RequiredInstall,
} from "./hardwareLab";

const scenario: HardwareScenario = FALLBACK_HARDWARE_SCENARIOS[0];

describe("validateInstall", () => {
  it("accepts a required part→slot pairing", () => {
    const result = validateInstall(scenario, [], "cpu1", "socket");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.install.step).toBe(1);
  });

  it("rejects the wrong slot, an installed part, and an occupied slot", () => {
    expect(validateInstall(scenario, [], "ram1", "dimm-a1")).toEqual({ ok: false, reason: "wrong-slot" });
    const made: RequiredInstall[] = [scenario.requiredInstalls[0]];
    expect(validateInstall(scenario, made, "cpu1", "socket")).toEqual({ ok: false, reason: "part-installed" });
    expect(validateInstall(scenario, made, "ram1", "socket")).toEqual({ ok: false, reason: "slot-occupied" });
  });

  it("rejects distractor parts everywhere", () => {
    expect(validateInstall(scenario, [], "ram-old", "dimm-a1")).toEqual({ ok: false, reason: "wrong-slot" });
  });
});

describe("completion and scoring", () => {
  it("completes only when every required install is made", () => {
    expect(isBuildComplete(scenario, [])).toBe(false);
    expect(isBuildComplete(scenario, scenario.requiredInstalls.slice(0, -1))).toBe(false);
    expect(isBuildComplete(scenario, [...scenario.requiredInstalls])).toBe(true);
  });

  it("scores 100 clean, -10 per wrong attempt, floor 60", () => {
    expect(scoreHardwareLab(0)).toBe(100);
    expect(scoreHardwareLab(3)).toBe(70);
    expect(scoreHardwareLab(9)).toBe(60);
  });
});

describe("fallback scenarios", () => {
  it("are internally consistent and respect fit rules", () => {
    for (const s of FALLBACK_HARDWARE_SCENARIOS) {
      const parts = new Map(s.parts.map((p) => [p.id, p]));
      const slots = new Map(s.slots.map((sl) => [sl.id, sl]));
      for (const ri of s.requiredInstalls) {
        const part = parts.get(ri.part)!;
        const slot = slots.get(ri.slot)!;
        expect(part).toBeDefined();
        expect(slot).toBeDefined();
        expect(PART_FITS[part.kind]).toBe(slot.kind);
      }
      // Each contains at least one distractor part left uninstalled.
      const required = new Set(s.requiredInstalls.map((ri) => ri.part));
      expect(s.parts.some((p) => !required.has(p.id))).toBe(true);
    }
  });
});

describe("AI scenario plumbing", () => {
  it("prompt embeds the brief and demands JSON", () => {
    const msgs = buildHardwareScenarioMessages("RAM upgrade for the design team");
    expect(msgs[0].content).toContain("RAM upgrade for the design team");
    expect(msgs[0].content).toContain('"requiredInstalls"');
  });

  it("parses a valid scenario round-trip", () => {
    const parsed = parseHardwareScenario(JSON.stringify(scenario));
    expect(parsed.title).toBe(scenario.title);
    expect(parsed.requiredInstalls).toHaveLength(scenario.requiredInstalls.length);
  });

  it("rejects fit-rule violations and unknown references", () => {
    const bad = JSON.parse(JSON.stringify(scenario)) as HardwareScenario;
    bad.requiredInstalls[0] = { ...bad.requiredInstalls[0], part: "ram1", slot: "socket" };
    expect(() => parseHardwareScenario(JSON.stringify(bad))).toThrow(/does not fit/);

    const unknown = JSON.parse(JSON.stringify(scenario)) as HardwareScenario;
    unknown.requiredInstalls[0] = { ...unknown.requiredInstalls[0], slot: "nope" };
    expect(() => parseHardwareScenario(JSON.stringify(unknown))).toThrow(/unknown slot/);
  });
});
