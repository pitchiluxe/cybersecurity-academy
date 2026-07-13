import type { ChatMessage } from "./openrouter";
import { extractJsonFromText, ParseError } from "./parsing";
import { THEME_VARS, type CustomTheme } from "./themes";

// Hex (#rgb → #rrggbbaa) or rgb()/rgba() functional notation.
const CSS_COLOR_RE = /^(#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/i;

export function buildThemeMessages(vibe: string): ChatMessage[] {
  const system = `You are a senior UI designer creating a color theme for "TechBench Academy", an IT-support training web app (panels, pills, terminals, a 3D wiring lab).
The user wants a theme with this vibe: "${vibe}".
Design a cohesive, accessible palette:
- --ink on --bg and on --surface must meet WCAG AA contrast (4.5:1). --ink-muted must still be readable on --surface.
- --accent-ink must be readable on --accent (it is used for button text).
- The *-soft variants are subtle tinted backgrounds of their base color; the *-line variants are stronger borders of the same hue.
- --terminal-bg is a console background (keep it dark enough that --terminal-ink, a bright terminal text color, pops). --terminal-muted is dim console text.
- The --scene-* variables color a 3D room: background, floor, grid lines (grid-strong slightly stronger), and device label text (--scene-label must contrast with --scene-bg).
Respond with ONLY a JSON object, no prose, no markdown fences:
{
  "label": "short theme name, max 3 words",
  "description": "one sentence describing the mood",
  "vars": { ${THEME_VARS.map((v) => `"${v}": "#RRGGBB or rgba(...)"`).join(", ")} }
}`;
  return [
    { role: "system", content: system },
    { role: "user", content: "Design the theme now." },
  ];
}

export function parseGeneratedTheme(text: string): CustomTheme {
  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonFromText(text));
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw new ParseError(`Failed to JSON.parse theme: ${(err as Error).message}`);
  }
  if (typeof raw !== "object" || raw === null) throw new ParseError("Theme was not a JSON object");
  const obj = raw as Record<string, unknown>;

  if (typeof obj.label !== "string" || obj.label.trim() === "") throw new ParseError("Theme label missing");
  if (typeof obj.vars !== "object" || obj.vars === null) throw new ParseError("Theme vars missing");
  const vars = obj.vars as Record<string, unknown>;

  const clean: Record<string, string> = {};
  for (const v of THEME_VARS) {
    const value = vars[v];
    if (typeof value !== "string" || !CSS_COLOR_RE.test(value.trim())) {
      throw new ParseError(`Theme var ${v} missing or not a valid CSS color: ${JSON.stringify(value)}`);
    }
    clean[v] = value.trim();
  }

  return {
    label: obj.label.trim().slice(0, 40),
    description: typeof obj.description === "string" ? obj.description.trim().slice(0, 140) : "",
    vars: clean,
  };
}
