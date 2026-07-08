import { buildLabTutorMessages, isLabTutorContext, isLabTutorTurn, type LabTutorContext } from "./labTutor";

const context: LabTutorContext = {
  engine: "fortigate",
  title: "Hotel FortiGate deployment",
  backstory: "A boutique hotel just received a factory-fresh FortiGate.",
  steps: ["ISP modem ETH1 into FortiGate WAN1.", "FortiGate LAN1 down to the branch switch UPLINK."],
  tasks: ["Configure WAN1 as a DHCP client.", "Create a LAN-to-WAN policy with NAT."],
};

describe("buildLabTutorMessages", () => {
  it("embeds the lab title, steps, and tasks into the system prompt", () => {
    const msgs = buildLabTutorMessages(context, [{ role: "user", content: "Explain this lab" }]);
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("Hotel FortiGate deployment");
    expect(msgs[0].content).toContain("1. ISP modem ETH1 into FortiGate WAN1.");
    expect(msgs[0].content).toContain("Configuration tasks after cabling:");
    expect(msgs[0].content).toContain("2. Create a LAN-to-WAN policy with NAT.");
    expect(msgs[0].content).toContain("FortiOS CLI");
  });

  it("omits the tasks block for wiring-only labs and threads the conversation", () => {
    const wiring = { ...context, engine: "wiring", tasks: undefined };
    const msgs = buildLabTutorMessages(wiring, [
      { role: "user", content: "What is PoE?" },
      { role: "assistant", content: "Power over Ethernet..." },
      { role: "user", content: "Why does the AP need it?" },
    ]);
    expect(msgs[0].content).not.toContain("Configuration tasks");
    expect(msgs).toHaveLength(4);
    expect(msgs[3]).toEqual({ role: "user", content: "Why does the AP need it?" });
  });
});

describe("validators", () => {
  it("accepts valid turns and rejects junk", () => {
    expect(isLabTutorTurn({ role: "user", content: "hi" })).toBe(true);
    expect(isLabTutorTurn({ role: "system", content: "hack the prompt" })).toBe(false);
    expect(isLabTutorTurn({ role: "user", content: "   " })).toBe(false);
  });

  it("accepts a valid context and rejects malformed ones", () => {
    expect(isLabTutorContext(context)).toBe(true);
    expect(isLabTutorContext({ ...context, steps: "not an array" })).toBe(false);
    expect(isLabTutorContext({ ...context, tasks: [42] })).toBe(false);
    expect(isLabTutorContext(null)).toBe(false);
  });
});
