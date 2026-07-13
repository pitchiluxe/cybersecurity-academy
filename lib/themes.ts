// Client-side theme registry. A theme is a per-browser preference applied via
// the data-theme attribute on <html>; the token values live in globals.css.
// An AI-generated "custom" theme instead sets every token as an inline CSS
// variable on <html> and persists the palette in localStorage.
export const THEME_STORAGE_KEY = "tba-theme";
export const CUSTOM_THEME_STORAGE_KEY = "tba-custom-theme";

export type ThemeId = "midnight" | "lab" | "chalkboard" | "blueprint" | "amber" | "custom";

/** Every CSS variable a complete theme must define (see globals.css). */
export const THEME_VARS = [
  "--bg", "--surface", "--surface-2", "--ink", "--ink-muted", "--ink-faint", "--border",
  "--accent", "--accent-ink", "--accent-soft", "--accent-line",
  "--warn", "--warn-soft", "--warn-line",
  "--danger", "--danger-soft", "--danger-line",
  "--good", "--good-soft", "--good-line",
  "--terminal-bg", "--terminal-ink", "--terminal-muted",
  "--scene-bg", "--scene-floor", "--scene-grid", "--scene-grid-strong", "--scene-label",
] as const;

export interface CustomTheme {
  label: string;
  description: string;
  vars: Record<string, string>;
}

export interface ThemeMeta {
  id: Exclude<ThemeId, "custom">;
  label: string;
  description: string;
  // Small preview swatch shown in the theme picker.
  swatch: { bg: string; surface: string; accent: string; ink: string };
}

export const DEFAULT_THEME: Exclude<ThemeId, "custom"> = "midnight";

export const THEMES: ThemeMeta[] = [
  {
    id: "midnight",
    label: "Midnight",
    description: "Indigo on deep navy — the default, dark and focused.",
    swatch: { bg: "#070B12", surface: "#0D1421", accent: "#6366F1", ink: "#E2E8F0" },
  },
  {
    id: "lab",
    label: "Daylight",
    description: "Clean zinc-neutral light theme with indigo accents.",
    swatch: { bg: "#F7F8FA", surface: "#FFFFFF", accent: "#6366F1", ink: "#0A0A0A" },
  },
  {
    id: "blueprint",
    label: "Blueprint",
    description: "Light, blue-tinted technical drawing palette.",
    swatch: { bg: "#EAF1FB", surface: "#FFFFFF", accent: "#1D4ED8", ink: "#10233D" },
  },
  {
    id: "chalkboard",
    label: "Chalkboard",
    description: "Deep classroom green with warm chalk-white text.",
    swatch: { bg: "#14261E", surface: "#1B3126", accent: "#FCD34D", ink: "#ECF3E9" },
  },
  {
    id: "amber",
    label: "Amber CRT",
    description: "Retro amber terminal glow for the lab bench.",
    swatch: { bg: "#0A0A08", surface: "#14120C", accent: "#FFB000", ink: "#F5E6C8" },
  },
];

const THEME_IDS = [...THEMES.map((t) => t.id), "custom"];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as string[]).includes(value);
}

export function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const t = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(t) ? t : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function getStoredCustomTheme(): CustomTheme | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw) as CustomTheme;
    return typeof t.label === "string" && t.vars && typeof t.vars === "object" ? t : null;
  } catch {
    return null;
  }
}

function clearInlineVars(): void {
  for (const v of THEME_VARS) document.documentElement.style.removeProperty(v);
}

export function applyTheme(id: Exclude<ThemeId, "custom">): void {
  if (typeof document === "undefined") return;
  clearInlineVars();
  document.documentElement.setAttribute("data-theme", id);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* private mode — theme still applies for this session */
  }
}

/** Applies an AI-generated palette: inline vars on <html> + persisted for the init script. */
export function applyCustomTheme(theme: CustomTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", "custom");
  for (const v of THEME_VARS) {
    const value = theme.vars[v];
    if (value) document.documentElement.style.setProperty(v, value);
  }
  try {
    window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(theme));
    window.localStorage.setItem(THEME_STORAGE_KEY, "custom");
  } catch {
    /* private mode — theme still applies for this session */
  }
}

// Inline <script> that sets the theme before first paint to avoid a flash of
// the default theme. For "custom" it also replays the stored palette as inline
// variables. Kept dependency-free and string-embeddable.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var ok=${JSON.stringify(
  THEME_IDS
)};var id=ok.indexOf(t)>-1?t:'${DEFAULT_THEME}';if(id==='custom'){try{var c=JSON.parse(localStorage.getItem('${CUSTOM_THEME_STORAGE_KEY}'));if(c&&c.vars){for(var k in c.vars){if(k.indexOf('--')===0)document.documentElement.style.setProperty(k,c.vars[k]);}}else{id='${DEFAULT_THEME}';}}catch(e){id='${DEFAULT_THEME}';}}document.documentElement.setAttribute('data-theme',id);}catch(e){document.documentElement.setAttribute('data-theme','${DEFAULT_THEME}');}})();`;
