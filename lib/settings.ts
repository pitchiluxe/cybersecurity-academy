import path from "path";
import fs from "fs";
import { getAppSettingsJson, saveAppSettingsJson } from "./db";

// "auto" tries OpenRouter's free models first, then falls back to local Ollama.
export type Provider = "auto" | "openrouter" | "ollama";

export interface AppSettings {
  provider: Provider;
  // Model used when provider is "openrouter"
  openrouterModel: string;
  // Comma-joined fallback models for OpenRouter's `models` routing (max 3 total)
  openrouterFallbacks: string[];
  // Model used when provider is "ollama"
  ollamaModel: string;
  ollamaBaseUrl: string;
}

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

export function getDefaultSettings(): AppSettings {
  const envProvider = process.env.AI_PROVIDER;
  return {
    provider: isProvider(envProvider) ? envProvider : "openrouter",
    openrouterModel: process.env.ANTHROPIC_MODEL ?? "",
    openrouterFallbacks: (process.env.ANTHROPIC_FALLBACK_MODELS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    ollamaModel: process.env.OLLAMA_MODEL ?? "llama3.1:8b",
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  };
}

export function isProvider(value: unknown): value is Provider {
  return value === "auto" || value === "openrouter" || value === "ollama";
}

function mergeSaved(defaults: AppSettings, saved: Partial<AppSettings>): AppSettings {
  return {
    provider: isProvider(saved.provider) ? saved.provider : defaults.provider,
    openrouterModel:
      typeof saved.openrouterModel === "string" && saved.openrouterModel ? saved.openrouterModel : defaults.openrouterModel,
    openrouterFallbacks: Array.isArray(saved.openrouterFallbacks)
      ? saved.openrouterFallbacks.filter((m): m is string => typeof m === "string" && m.length > 0)
      : defaults.openrouterFallbacks,
    ollamaModel: typeof saved.ollamaModel === "string" && saved.ollamaModel ? saved.ollamaModel : defaults.ollamaModel,
    ollamaBaseUrl:
      typeof saved.ollamaBaseUrl === "string" && saved.ollamaBaseUrl ? saved.ollamaBaseUrl : defaults.ollamaBaseUrl,
  };
}

function readSettingsFile(): Partial<AppSettings> | null {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8")) as Partial<AppSettings>;
  } catch {
    return null;
  }
}

/**
 * Saved settings override .env defaults. The primary store is the database —
 * the only writable option on serverless hosts like Vercel, where the
 * filesystem is read-only (writing settings.json there silently loses the
 * change). The local settings.json is kept as a dev-friendly mirror and
 * one-time migration source. Jest never touches either store so unit tests
 * stay deterministic against env vars alone.
 */
export async function getSettings(): Promise<AppSettings> {
  const defaults = getDefaultSettings();
  if (process.env.NODE_ENV === "test") return defaults;

  // Two attempts: the schema bootstrap can fail transiently on a cold start,
  // and its memoized promise resets itself for a retry.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await getAppSettingsJson();
      if (raw) return mergeSaved(defaults, JSON.parse(raw) as Partial<AppSettings>);
      break; // no row saved yet — fall through to file/defaults
    } catch {
      /* DB unreachable — retry once, then fall back to the local file below */
    }
  }

  const fromFile = readSettingsFile();
  if (fromFile) {
    const merged = mergeSaved(defaults, fromFile);
    // One-time migration: seed the DB so future reads and writes agree.
    saveAppSettingsJson(JSON.stringify(merged)).catch(() => {});
    return merged;
  }
  return defaults;
}

export async function saveSettings(update: Partial<AppSettings>): Promise<AppSettings> {
  const merged = mergeSaved(getDefaultSettings(), { ...(await getSettings()), ...update });
  await saveAppSettingsJson(JSON.stringify(merged));
  // Dev convenience mirror; read-only hosts (Vercel) just skip it.
  try {
    const dir = path.dirname(SETTINGS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf8");
  } catch {
    /* read-only host */
  }
  return merged;
}
