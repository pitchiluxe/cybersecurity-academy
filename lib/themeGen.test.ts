import { buildThemeMessages, parseGeneratedTheme } from "./themeGen";
import { THEME_VARS } from "./themes";

const validVars = Object.fromEntries(THEME_VARS.map((v, i) => [v, i % 3 === 0 ? "#112233" : i % 3 === 1 ? "#abc" : "rgba(10, 20, 30, 0.14)"]));
const validTheme = { label: "Neon Harbor", description: "Electric teal on deep charcoal.", vars: validVars };

describe("buildThemeMessages", () => {
  it("includes the vibe and every required variable", () => {
    const msgs = buildThemeMessages("cyberpunk neon");
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("cyberpunk neon");
    for (const v of THEME_VARS) expect(msgs[0].content).toContain(v);
  });
});

describe("parseGeneratedTheme", () => {
  it("parses a complete valid theme", () => {
    const t = parseGeneratedTheme(JSON.stringify(validTheme));
    expect(t.label).toBe("Neon Harbor");
    expect(Object.keys(t.vars)).toHaveLength(THEME_VARS.length);
  });

  it("rejects a theme missing a variable", () => {
    const vars = { ...validVars };
    delete (vars as Record<string, string>)["--terminal-bg"];
    expect(() => parseGeneratedTheme(JSON.stringify({ ...validTheme, vars }))).toThrow(/--terminal-bg/);
  });

  it("rejects non-color values (no CSS injection through var values)", () => {
    const vars = { ...validVars, "--bg": "url(javascript:alert(1))" };
    expect(() => parseGeneratedTheme(JSON.stringify({ ...validTheme, vars }))).toThrow(/--bg/);
    const vars2 = { ...validVars, "--accent": "red; } body { display:none" };
    expect(() => parseGeneratedTheme(JSON.stringify({ ...validTheme, vars: vars2 }))).toThrow(/--accent/);
  });

  it("rejects a theme without a label", () => {
    expect(() => parseGeneratedTheme(JSON.stringify({ vars: validVars }))).toThrow(/label/);
  });
});
