// Client-side theme registry. A theme is a per-browser preference applied via
// the data-theme attribute on <html>; the token values live in globals.css.
export const THEME_STORAGE_KEY = "tba-theme";

export type ThemeId = "lab" | "console" | "chalkboard" | "blueprint" | "amber";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
  // Small preview swatch shown in the theme picker.
  swatch: { bg: string; surface: string; accent: string; ink: string };
}

export const DEFAULT_THEME: ThemeId = "lab";

export const THEMES: ThemeMeta[] = [
  {
    id: "lab",
    label: "Computer Lab",
    description: "Bright school-IT-room light theme with cool blue accents.",
    swatch: { bg: "#F1F6FC", surface: "#FFFFFF", accent: "#2563EB", ink: "#0F1E33" },
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
    id: "console",
    label: "Night Console",
    description: "Classic dark slate service-desk look.",
    swatch: { bg: "#0B1220", surface: "#111A2E", accent: "#60A5FA", ink: "#E2E8F0" },
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
