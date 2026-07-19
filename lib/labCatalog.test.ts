import {
  buildLabCatalogMessages,
  parseLabCatalog,
  FALLBACK_LAB_CATALOG,
  MIN_CATALOG_LABS,
  MAX_CATALOG_LABS,
  type LabBrief,
} from "./labCatalog";

const validLab = (over: Partial<LabBrief> = {}): LabBrief => ({
  id: "branch-buildout",
  engine: "wiring",
  title: "New branch office buildout",
  blurb: "Nothing behind the ISP handoff is wired. Bring the front desk online.",
  tags: "Network+ · CCNA",
  brief: "Wire a brand-new branch office.",
  ...over,
});

const catalogOf = (n: number): LabBrief[] =>
  Array.from({ length: n }, (_, i) => validLab({ id: `lab-${i}`, engine: i % 2 === 0 ? "wiring" : "fortigate" }));

describe("buildLabCatalogMessages", () => {
  it("asks for 8-14 labs as a JSON array covering the engines", () => {
    const msgs = buildLabCatalogMessages();
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain('"wiring"');
    expect(msgs[0].content).toContain('"fortigate"');
    const m = msgs[0].content.match(/Invent (\d+) distinct/);
    expect(m).not.toBeNull();
    const count = Number(m![1]);
    expect(count).toBeGreaterThanOrEqual(MIN_CATALOG_LABS);
    expect(count).toBeLessThanOrEqual(MAX_CATALOG_LABS);
  });
});

describe("parseLabCatalog", () => {
  it("parses a valid catalog", () => {
    const labs = parseLabCatalog(JSON.stringify(catalogOf(9)));
    expect(labs).toHaveLength(9);
    expect(labs[1].engine).toBe("fortigate");
  });

  it("rejects a catalog with fewer than the minimum labs", () => {
    expect(() => parseLabCatalog(JSON.stringify(catalogOf(4)))).toThrow(/at least/);
  });

  it("caps oversized catalogs at the maximum", () => {
    expect(parseLabCatalog(JSON.stringify(catalogOf(18)))).toHaveLength(MAX_CATALOG_LABS);
  });

  it("rejects an invalid engine", () => {
    const bad = catalogOf(9);
    (bad[2] as unknown as Record<string, unknown>).engine = "cisco";
    expect(() => parseLabCatalog(JSON.stringify(bad))).toThrow(/engine/);
  });

  it("de-duplicates repeated ids", () => {
    const dupes = catalogOf(9).map((l) => ({ ...l, id: "same-id" }));
    const labs = parseLabCatalog(JSON.stringify(dupes));
    expect(new Set(labs.map((l) => l.id)).size).toBe(9);
  });

  it("rejects payloads with no JSON array", () => {
    expect(() => parseLabCatalog("Sorry, I cannot generate labs right now.")).toThrow(/array/i);
  });
});

describe("fallback catalog", () => {
  it("is a valid catalog within the 8-14 range covering all engines", () => {
    expect(FALLBACK_LAB_CATALOG.length).toBeGreaterThanOrEqual(MIN_CATALOG_LABS);
    expect(FALLBACK_LAB_CATALOG.length).toBeLessThanOrEqual(MAX_CATALOG_LABS);
    expect(() => parseLabCatalog(JSON.stringify(FALLBACK_LAB_CATALOG))).not.toThrow();
    const engines = new Set(FALLBACK_LAB_CATALOG.map((l) => l.engine));
    expect(engines).toEqual(new Set(["wiring", "fortigate", "router", "hardware"]));
  });
});
