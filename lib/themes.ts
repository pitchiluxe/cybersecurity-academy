// Client-side theme registry. A theme is a per-browser preference applied via
// the data-theme attribute on <html>; the token values live in globals.css.
export const THEME_STORAGE_KEY = "tba-theme";

export type ThemeId = "midnight" | "lab" | "chalkboard" | "blueprint" | "amber";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
  // Small preview swatch shown in the theme picker.
  swatch: { bg: string; surface: string; accent: string; ink: string };
}

export const DEFAULT_THEME: ThemeId = "midnight";

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

const THEME_IDS = THEMES.map((t) => t.id);

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

export function applyTheme(id: ThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", id);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* private mode — theme still applies for this session */
  }
}

// Inline <script> that sets the theme before first paint to avoid a flash of
// the default theme. Kept dependency-free and string-embeddable.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var ok=${JSON.stringify(
  THEME_IDS
)};document.documentElement.setAttribute('data-theme',ok.indexOf(t)>-1?t:'${DEFAULT_THEME}');}catch(e){document.documentElement.setAttribute('data-theme','${DEFAULT_THEME}');}})();`;
