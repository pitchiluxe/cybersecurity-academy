import { buildVmInitMessages, buildVmExecMessages, parseVmSpec, VM_RESOLVED_MARKER, type VmSpec } from "./vm";
import type { ScenarioSeed } from "./types";

const seed: ScenarioSeed = {
  category: "network",
  persona: { name: "Ana", department: "Sales" },
  environment: { os: "Windows 11", device: "Dell Latitude", detail: "docked, wired ethernet" },
  rootCause: "static DNS server entry points at a decommissioned server",
  openingMessage: "Internet stopped working!",
};

const spec: VmSpec = {
  os: "Windows 11",
  hostname: "SALES-LAT-042",
  username: "support-admin",
  password: "Passw0rd!",
  settingsPanels: [{ title: "Network", entries: [{ label: "IPv4", value: "10.1.4.20" }] }],
  files: [{ path: "C:\\Windows\\System32\\drivers\\etc\\hosts", description: "hosts file" }],
  faultSummary: "DNS misconfigured",
};

describe("buildVmInitMessages", () => {
  it("embeds the root cause and requires JSON", () => {
    const msgs = buildVmInitMessages(seed);
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain(seed.rootCause);
    expect(msgs[0].content).toContain("settingsPanels");
  });
});

describe("parseVmSpec", () => {
  it("round-trips a valid spec", () => {
    const parsed = parseVmSpec(JSON.stringify(spec));
    expect(parsed.hostname).toBe("SALES-LAT-042");
    expect(parsed.settingsPanels[0].entries[0].label).toBe("IPv4");
  });

  it("rejects a spec missing credentials", () => {
    const bad = JSON.stringify({ ...spec, password: "" });
    expect(() => parseVmSpec(bad)).toThrow(/password/);
  });

  it("repairs unescaped Windows-path backslashes the model tends to emit", () => {
    const sloppy = JSON.stringify(spec).replace(
      '"C:\\\\Windows\\\\System32\\\\drivers\\\\etc\\\\hosts"',
      '"C:\\Windows\\System32\\drivers\\etc\\hosts"'
    );
    expect(sloppy).toContain("C:\\Windows"); // single backslashes = invalid JSON
    const parsed = parseVmSpec(sloppy);
    expect(parsed.files[0].path).toBe("C:\\Windows\\System32\\drivers\\etc\\hosts");
  });
});

describe("buildVmExecMessages", () => {
  it("maps history to alternating turns and ends with the new command", () => {
    const msgs = buildVmExecMessages(seed, spec, [{ command: "ipconfig", output: "IPv4 10.1.4.20" }], "nslookup intranet");
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain(VM_RESOLVED_MARKER);
    expect(msgs[0].content).toContain(seed.rootCause);
    expect(msgs.slice(1)).toEqual([
      { role: "user", content: "ipconfig" },
      { role: "assistant", content: "IPv4 10.1.4.20" },
      { role: "user", content: "nslookup intranet" },
    ]);
  });
});
