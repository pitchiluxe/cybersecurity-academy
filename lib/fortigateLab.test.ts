import {
  buildFortigateScenarioMessages,
  buildFortigateExecMessages,
  parseFortigateScenario,
  extractTaskMarkers,
  scoreFortigateLab,
  FALLBACK_FORTIGATE_SCENARIO,
  LAB_COMPLETE_MARKER,
} from "./fortigateLab";
import { parseWiringScenario } from "./wiringLab";

describe("extractTaskMarkers", () => {
  it("collects TASK_DONE ids, strips markers, flags completion", () => {
    const raw = "policy created\n[TASK_DONE:policy-lan-wan]\nok\n[TASK_DONE:nat]\n" + LAB_COMPLETE_MARKER;
    const r = extractTaskMarkers(raw);
    expect(r.doneIds).toEqual(["policy-lan-wan", "nat"]);
    expect(r.complete).toBe(true);
    expect(r.cleaned).not.toContain("TASK_DONE");
    expect(r.cleaned).not.toContain(LAB_COMPLETE_MARKER);
  });

  it("returns empty for plain output", () => {
    const r = extractTaskMarkers("get system status\nVersion: FortiGate-60F v7.4");
    expect(r.doneIds).toEqual([]);
    expect(r.complete).toBe(false);
  });
});

describe("scoreFortigateLab", () => {
  it("applies both penalties with floor 60", () => {
    expect(scoreFortigateLab(0, 0)).toBe(100);
    expect(scoreFortigateLab(2, 1)).toBe(85);
    expect(scoreFortigateLab(10, 10)).toBe(60);
  });
});

describe("scenario", () => {
  it("prompt demands tasks and wiring", () => {
    const msgs = buildFortigateScenarioMessages();
    expect(msgs[0].content).toContain("tasks");
    expect(msgs[0].content).toContain("wiring");
  });

  it("fallback parses and its wiring is valid as a wiring scenario", () => {
    const s = parseFortigateScenario(JSON.stringify(FALLBACK_FORTIGATE_SCENARIO));
    expect(s.tasks.length).toBeGreaterThanOrEqual(3);
    expect(() =>
      parseWiringScenario(JSON.stringify({ title: s.title, backstory: s.backstory, devices: s.devices, requiredConnections: s.wiring }))
    ).not.toThrow();
  });
});

describe("buildFortigateExecMessages", () => {
  it("embeds scenario, done tasks, and history", () => {
    const s = FALLBACK_FORTIGATE_SCENARIO;
    const msgs = buildFortigateExecMessages(s, [s.tasks[0].id], [{ command: "get system status", output: "v7.4" }], "config system interface");
    expect(msgs[0].content).toContain(s.tasks[1].instruction);
    expect(msgs[0].content).toContain("TASK_DONE");
    expect(msgs).toHaveLength(4);
    expect(msgs[3].content).toBe("config system interface");
  });
});
