import { SCENARIO_CATEGORIES, isScenarioCategory, buildStartMessages, buildQueueMessages, buildReplyMessages, buildGradeMessages } from "./scenarios";
import type { ScenarioSeed, TranscriptMessage } from "./types";

describe("SCENARIO_CATEGORIES", () => {
  it("has exactly the fourteen fixed categories", () => {
    expect(SCENARIO_CATEGORIES.map((c) => c.id).sort()).toEqual(
      [
        "app-crash", "hardware", "malware", "network", "password", "printer", "vm",
        "phishing", "firewall", "siem", "access", "cloud", "linux", "pentest",
      ].sort()
    );
  });
});

describe("expanded category catalog (v3)", () => {
  it("has 14 categories with unique ids and ticket ids", () => {
    expect(SCENARIO_CATEGORIES).toHaveLength(14);
    const ids = SCENARIO_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(14);
    const ticketIds = SCENARIO_CATEGORIES.map((c) => c.ticketId);
    expect(new Set(ticketIds).size).toBe(14);
  });

  it("includes the security categories", () => {
    for (const id of ["phishing", "firewall", "siem", "access", "cloud", "linux", "pentest"]) {
      expect(isScenarioCategory(id)).toBe(true);
    }
  });
});

describe("isScenarioCategory", () => {
  it("accepts a known category id", () => {
    expect(isScenarioCategory("network")).toBe(true);
  });
  it("rejects an unknown string", () => {
    expect(isScenarioCategory("spaceship")).toBe(false);
  });
});

describe("buildStartMessages", () => {
  it("includes the category label and a JSON schema instruction", () => {
    const messages = buildStartMessages("printer");
    const system = messages.find((m) => m.role === "system");
    expect(system).toBeDefined();
    expect(system!.content).toContain("Printer");
    expect(system!.content).toContain("rootCause");
    expect(system!.content).toContain("openingMessage");
  });
});

describe("buildQueueMessages", () => {
  it("includes the requested count, every category id, and a JSON array schema instruction", () => {
    const messages = buildQueueMessages(9);
    const system = messages.find((m) => m.role === "system")!;
    expect(system.content).toContain("9");
    for (const c of SCENARIO_CATEGORIES) {
      expect(system.content).toContain(c.id);
    }
    expect(system.content).toContain("rootCause");
    expect(system.content).toContain("openingMessage");
    expect(system.content).toContain("category");
  });
});

const seed: ScenarioSeed = {
  category: "network",
  persona: { name: "Maria Chen", department: "Marketing" },
  environment: { os: "Windows 11", device: "Latitude 5540", detail: "GlobalProtect 6.2.1" },
  rootCause: "TAP adapter driver corrupted by cumulative update",
  openingMessage: "My VPN won't connect this morning.",
};

const transcript: TranscriptMessage[] = [
  { role: "enduser", content: seed.openingMessage },
  { role: "tech", content: "Can you tell me the exact error message?" },
];

describe("buildReplyMessages", () => {
  it("embeds the persona, environment, and root cause but instructs never to reveal the root cause outright", () => {
    const messages = buildReplyMessages(seed, transcript);
    const system = messages.find((m) => m.role === "system")!;
    expect(system.content).toContain("Maria Chen");
    expect(system.content).toContain("TAP adapter driver corrupted by cumulative update");
    expect(system.content.toLowerCase()).toContain("never state the root cause");
  });

  it("maps the transcript onto user/assistant turns from the end-user's point of view", () => {
    const messages = buildReplyMessages(seed, transcript);
    const turns = messages.filter((m) => m.role !== "system");
    expect(turns).toEqual([
      { role: "assistant", content: seed.openingMessage },
      { role: "user", content: "Can you tell me the exact error message?" },
    ]);
  });
});

describe("buildGradeMessages", () => {
  it("includes the fixed rubric items and the full transcript", () => {
    const messages = buildGradeMessages(seed, transcript);
    const system = messages.find((m) => m.role === "system")!;
    expect(system.content).toContain("clarifying questions");
    expect(system.content).toContain("score");
    const userMsg = messages.find((m) => m.role === "user")!;
    expect(userMsg.content).toContain("My VPN won't connect this morning.");
    expect(userMsg.content).toContain("Can you tell me the exact error message?");
  });
});
