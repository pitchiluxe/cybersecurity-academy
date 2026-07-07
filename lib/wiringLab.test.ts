import {
  connectionKey,
  validateAttempt,
  isComplete,
  scoreLab,
  parseWiringScenario,
  buildWiringScenarioMessages,
  FALLBACK_WIRING_SCENARIOS,
  requiredKey,
  type WiringScenario,
} from "./wiringLab";

const scenario: WiringScenario = {
  title: "Branch uplink",
  backstory: "New branch office, nothing wired yet.",
  devices: [
    { id: "modem", name: "ISP Modem", kind: "modem", ports: [{ id: "eth1", label: "ETH1", kind: "wan" }] },
    { id: "rtr", name: "Edge Router", kind: "router", ports: [
      { id: "wan1", label: "WAN1", kind: "wan" },
      { id: "lan1", label: "LAN1", kind: "lan" },
    ] },
    { id: "sw", name: "Switch", kind: "switch", ports: [
      { id: "up1", label: "UPLINK", kind: "uplink" },
      { id: "p1", label: "P1", kind: "lan" },
    ] },
    { id: "pc", name: "Front-desk PC", kind: "pc", ports: [{ id: "nic", label: "NIC", kind: "lan" }] },
  ],
  requiredConnections: [
    { fromDevice: "modem", fromPort: "eth1", toDevice: "rtr", toPort: "wan1", cable: "ethernet", step: 1, instruction: "Modem ETH1 to router WAN1" },
    { fromDevice: "rtr", fromPort: "lan1", toDevice: "sw", toPort: "up1", cable: "ethernet", step: 2, instruction: "Router LAN1 to switch UPLINK" },
    { fromDevice: "sw", fromPort: "p1", toDevice: "pc", toPort: "nic", cable: "ethernet", step: 3, instruction: "Switch P1 to PC NIC" },
  ],
};

describe("connectionKey", () => {
  it("is direction-agnostic", () => {
    expect(connectionKey({ device: "a", port: "1" }, { device: "b", port: "2" }))
      .toBe(connectionKey({ device: "b", port: "2" }, { device: "a", port: "1" }));
  });
});

describe("validateAttempt", () => {
  it("accepts a required connection in either direction", () => {
    const r = validateAttempt(scenario, new Set(), { device: "rtr", port: "wan1" }, { device: "modem", port: "eth1" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.connection.step).toBe(1);
  });

  it("rejects a non-required pair", () => {
    const r = validateAttempt(scenario, new Set(), { device: "modem", port: "eth1" }, { device: "pc", port: "nic" });
    expect(r).toEqual({ ok: false, reason: "not-required" });
  });

  it("rejects an already-made connection", () => {
    const made = new Set([requiredKey(scenario.requiredConnections[0])]);
    const r = validateAttempt(scenario, made, { device: "modem", port: "eth1" }, { device: "rtr", port: "wan1" });
    expect(r).toEqual({ ok: false, reason: "already-made" });
  });
});

describe("isComplete / scoreLab", () => {
  it("completes when all required connections made", () => {
    const made = new Set(scenario.requiredConnections.map(requiredKey));
    expect(isComplete(scenario, made)).toBe(true);
    expect(isComplete(scenario, new Set())).toBe(false);
  });

  it("scores 100 clean, floors at 60", () => {
    expect(scoreLab(0)).toBe(100);
    expect(scoreLab(2)).toBe(80);
    expect(scoreLab(9)).toBe(60);
  });
});

describe("scenario generation plumbing", () => {
  it("prompt demands JSON with requiredConnections", () => {
    const msgs = buildWiringScenarioMessages();
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("requiredConnections");
  });

  it("parses a valid scenario and rejects one whose connection references a missing port", () => {
    expect(parseWiringScenario(JSON.stringify(scenario)).devices).toHaveLength(4);
    const bad = { ...scenario, requiredConnections: [{ ...scenario.requiredConnections[0], toPort: "nope" }] };
    expect(() => parseWiringScenario(JSON.stringify(bad))).toThrow(/nope|port/i);
  });

  it("all fallbacks are internally valid", () => {
    expect(FALLBACK_WIRING_SCENARIOS).toHaveLength(3);
    for (const s of FALLBACK_WIRING_SCENARIOS) {
      expect(() => parseWiringScenario(JSON.stringify(s))).not.toThrow();
      expect(s.requiredConnections.length).toBeGreaterThanOrEqual(3);
    }
  });
});
