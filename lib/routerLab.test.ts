import {
  buildRouterScenarioMessages,
  buildRouterExecMessages,
  parseRouterScenario,
  FALLBACK_ROUTER_SCENARIO,
} from "./routerLab";
import { LAB_COMPLETE_MARKER, extractTaskMarkers } from "./fortigateLab";

describe("buildRouterScenarioMessages", () => {
  it("prompts for a Cisco router lab as JSON with wiring and tasks", () => {
    const msgs = buildRouterScenarioMessages();
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("Cisco");
    expect(msgs[0].content).toContain('"wiring"');
    expect(msgs[0].content).toContain('"tasks"');
  });

  it("seeds the prompt with a dispatched brief when given", () => {
    const msgs = buildRouterScenarioMessages("Turn up a café router with DHCP and NAT.");
    expect(msgs[0].content).toContain("Turn up a café router with DHCP and NAT.");
  });
});

describe("parseRouterScenario / fallback", () => {
  it("fallback scenario is internally valid", () => {
    const parsed = parseRouterScenario(JSON.stringify(FALLBACK_ROUTER_SCENARIO));
    expect(parsed.devices).toHaveLength(3);
    expect(parsed.tasks.length).toBeGreaterThanOrEqual(3);
    expect(parsed.wiring.length).toBeGreaterThanOrEqual(2);
  });
});

describe("buildRouterExecMessages", () => {
  it("simulates IOS, lists task state, threads history, and defines both markers", () => {
    const msgs = buildRouterExecMessages(
      FALLBACK_ROUTER_SCENARIO,
      ["hostname"],
      [{ command: "enable", output: "OAKDALE-R1#" }],
      "show ip interface brief"
    );
    const system = msgs[0].content;
    expect(system).toContain("IOS");
    expect(system).toContain("[done] id=hostname");
    expect(system).toContain("[open] id=wan-dhcp");
    expect(system).toContain("[TASK_DONE:");
    expect(system).toContain(LAB_COMPLETE_MARKER);
    expect(msgs).toHaveLength(4);
    expect(msgs[1]).toEqual({ role: "user", content: "enable" });
    expect(msgs[3]).toEqual({ role: "user", content: "show ip interface brief" });
  });

  it("markers extract cleanly from router output", () => {
    const { cleaned, doneIds, complete } = extractTaskMarkers(
      "OAKDALE-R1(config)#end\n[TASK_DONE:nat-overload]\n" + LAB_COMPLETE_MARKER
    );
    expect(doneIds).toEqual(["nat-overload"]);
    expect(complete).toBe(true);
    expect(cleaned).not.toContain("[TASK_DONE");
  });
});
