import path from "path";
import fs from "fs";

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

// Saved settings override .env.local defaults. Jest never touches the file so
// unit tests stay deterministic against env vars alone.
export function getSettings(): AppSettings {
  const defaults = getDefaultSettings();
  if (process.env.NODE_ENV === "test") return defaults;
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf8");
    const saved = JSON.parse(raw) as Partial<AppSettings>;
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
  } catch {
    return defaults;
  }
}

export function saveSettings(update: Partial<AppSettings>): AppSettings {
  const merged = { ...getSettings(), ...update };
  if (!isProvider(merged.provider)) {
    merged.provider = "openrouter";
  }
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}
