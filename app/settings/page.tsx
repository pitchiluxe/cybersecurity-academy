"use client";

import { useEffect, useState } from "react";
import {
  THEMES, applyTheme, applyCustomTheme, getStoredTheme, getStoredCustomTheme,
  type ThemeId, type CustomTheme,
} from "@/lib/themes";

type Provider = "auto" | "openrouter" | "ollama";

interface Settings {
  provider: Provider;
  openrouterModel: string;
  openrouterFallbacks: string[];
  ollamaModel: string;
  ollamaBaseUrl: string;
}

interface ModelLists {
  openrouter: string[];
  ollama: { available: boolean; models: string[] };
}

const SUGGESTED_PULLS = ["llama3.2:3b", "qwen2.5:7b", "phi3:mini", "gemma2:9b", "mistral:7b", "gpt-oss:20b"];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [models, setModels] = useState<ModelLists | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pullName, setPullName] = useState("");
  const [pulling, setPulling] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeId>("lab");
  const [customTheme, setCustomTheme] = useState<CustomTheme | null>(null);
  const [vibe, setVibe] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setTheme(getStoredTheme());
    setCustomTheme(getStoredCustomTheme());
  }, []);

  function pickTheme(id: Exclude<ThemeId, "custom">) {
    applyTheme(id);
    setTheme(id);
  }

  function pickCustomTheme(t: CustomTheme) {
    applyCustomTheme(t);
    setTheme("custom");
  }

  async function generateTheme() {
    setGenerating(true);
    setNotice(null);
    const res = await fetch("/api/theme/generate", {
      method: "POST",
      body: JSON.stringify({ vibe: vibe.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    setGenerating(false);
    if (!res.ok) {
      setNotice({ kind: "error", text: body.error ?? "Theme generation failed." });
      return;
    }
    setCustomTheme(body.theme);
    pickCustomTheme(body.theme);
    setNotice({ kind: "ok", text: `Applied "${body.theme.label}" — generate again for a different take.` });
  }

  async function loadModels() {
    const res = await fetch("/api/settings/models");
    if (res.ok) setModels(await res.json());
  }

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setSettings(body?.settings ?? null))
      .catch(() => setSettings(null));
    loadModels().catch(() => setModels({ openrouter: [], ollama: { available: false, models: [] } }));
  }, []);

  async function save(update: Partial<Settings>) {
    if (!settings) return;
    setSaving(true);
    setNotice(null);
    const res = await fetch("/api/settings", {
      method: "PUT",
      body: JSON.stringify(update),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setNotice({ kind: "error", text: body.error ?? "Could not save settings." });
      setSaving(false);
      return;
    }
    const body = await res.json();
    setSettings(body.settings);
    setNotice({ kind: "ok", text: "Settings saved. New tickets and replies use this model immediately." });
    setSaving(false);
  }

  async function pullModel(name: string) {
    setPulling(name);
    setNotice(null);
    const res = await fetch("/api/settings/pull", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice({ kind: "error", text: body.error ?? "Pull failed." });
    } else {
      setNotice({ kind: "ok", text: `Pulled ${name}. It's now available in the Ollama model list.` });
      await loadModels().catch(() => {});
    }
    setPulling(null);
  }

  if (!settings) {
    return (
      <main className="mx-auto max-w-3xl p-6 sm:p-8">
        <p className="font-mono text-sm" style={{ color: "var(--ink-muted)" }}>
          Loading settings…
        </p>
      </main>
    );
  }

  const installedOllama = models?.ollama.models ?? [];

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-6 sm:p-8">
      <div>
        <div className="font-mono text-xs font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
          Academy settings
        </div>
        <h1 className="font-display mt-1 text-3xl font-bold" style={{ color: "var(--ink)" }}>
          Settings
        </h1>
        <p className="mt-2 max-w-xl text-sm" style={{ color: "var(--ink-muted)" }}>
          Pick a look for the academy, and choose the AI model that powers tickets, end-user replies,
          diagnostics, and grading. Model credentials come from <span className="font-mono text-xs">.env.local</span>;
          everything you change here applies immediately without a restart.
        </p>
      </div>

      {notice && (
        <p
          role="status"
          className="rounded-lg border px-3 py-2 text-sm"
          style={
            notice.kind === "ok"
              ? { color: "var(--good)", background: "var(--good-soft)", borderColor: "var(--good-line)" }
              : { color: "var(--warn)", background: "var(--warn-soft)", borderColor: "var(--warn-line)" }
          }
        >
          {notice.text}
        </p>
      )}

      {/* Appearance / theme */}
      <div className="panel p-5">
        <div className="panel-header mb-1">Appearance</div>
        <p className="mb-3 text-xs" style={{ color: "var(--ink-muted)" }}>
          Themes apply instantly and are saved to this browser.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEMES.map((t) => {
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => pickTheme(t.id)}
                aria-pressed={active}
                className="rounded-xl border p-3 text-left transition-colors duration-200"
                style={{
                  cursor: "pointer",
                  borderColor: active ? "var(--accent)" : "var(--border)",
                  background: active ? "var(--accent-soft)" : "var(--surface)",
                }}
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-full overflow-hidden rounded-lg border"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span style={{ flex: 2, background: t.swatch.bg }} />
                  <span style={{ flex: 1, background: t.swatch.surface }} />
                  <span style={{ flex: 1, background: t.swatch.accent }} />
                  <span style={{ flex: 1, background: t.swatch.ink }} />
                </span>
                <span className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                    {t.label}
                  </span>
                  {active && (
                    <span className="font-mono text-[10px] uppercase" style={{ color: "var(--accent)" }}>
                      Active
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs" style={{ color: "var(--ink-muted)" }}>
                  {t.description}
                </span>
              </button>
            );
          })}
          {customTheme && (
            <button
              type="button"
              onClick={() => pickCustomTheme(customTheme)}
              aria-pressed={theme === "custom"}
              className="rounded-xl border p-3 text-left transition-colors duration-200"
              style={{
                cursor: "pointer",
                borderColor: theme === "custom" ? "var(--accent)" : "var(--border)",
                background: theme === "custom" ? "var(--accent-soft)" : "var(--surface)",
              }}
            >
              <span aria-hidden="true" className="flex h-10 w-full overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
                <span style={{ flex: 2, background: customTheme.vars["--bg"] }} />
                <span style={{ flex: 1, background: customTheme.vars["--surface"] }} />
                <span style={{ flex: 1, background: customTheme.vars["--accent"] }} />
                <span style={{ flex: 1, background: customTheme.vars["--ink"] }} />
              </span>
              <span className="mt-2 flex items-center justify-between gap-2">
                <span className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                  ✨ {customTheme.label}
                </span>
                {theme === "custom" && (
                  <span className="font-mono text-[10px] uppercase" style={{ color: "var(--accent)" }}>
                    Active
                  </span>
                )}
              </span>
              <span className="mt-1 block text-xs" style={{ color: "var(--ink-muted)" }}>
                {customTheme.description || "Your AI-generated theme."}
              </span>
            </button>
          )}
        </div>

        <div className="panel-header mb-1 mt-5">AI theme designer</div>
        <p className="mb-2 text-xs" style={{ color: "var(--ink-muted)" }}>
          Describe a mood and the AI designs a full palette — panels, terminals, even the 3D lab room.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            className="field-input min-w-0 flex-1"
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            placeholder='e.g. "cyberpunk neon", "warm coffee shop", "arctic minimal" — or leave blank to be surprised'
            disabled={generating}
            aria-label="Theme vibe"
            onKeyDown={(e) => { if (e.key === "Enter") generateTheme(); }}
          />
          <button className="btn-primary" onClick={generateTheme} disabled={generating}>
            {generating ? "Designing…" : "✨ Generate theme"}
          </button>
        </div>
      </div>

      {/* Provider selection */}
      <div className="panel p-5">
        <div className="panel-header mb-3">Provider</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            className="rounded-xl border p-4 text-left transition-colors duration-200"
            style={{
              borderColor: settings.provider === "auto" ? "var(--accent)" : "var(--border)",
              background: settings.provider === "auto" ? "var(--accent-soft)" : "var(--surface)",
              cursor: "pointer",
            }}
            onClick={() => save({ provider: "auto" })}
            disabled={saving}
          >
            <div className="text-sm font-bold" style={{ color: "var(--ink)" }}>
              Auto (recommended)
            </div>
            <div className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
              Best free cloud models first; switches to local Ollama automatically when the free tier is capped or you&apos;re offline.
            </div>
          </button>
          <button
            type="button"
            className="rounded-xl border p-4 text-left transition-colors duration-200"
            style={{
              borderColor: settings.provider === "openrouter" ? "var(--accent)" : "var(--border)",
              background: settings.provider === "openrouter" ? "var(--accent-soft)" : "var(--surface)",
              cursor: "pointer",
            }}
            onClick={() => save({ provider: "openrouter" })}
            disabled={saving}
          >
            <div className="text-sm font-bold" style={{ color: "var(--ink)" }}>
              OpenRouter (cloud)
            </div>
            <div className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
              Free hosted models. Needs internet; free tier has daily limits.
            </div>
          </button>
          <button
            type="button"
            className="rounded-xl border p-4 text-left transition-colors duration-200"
            style={{
              borderColor: settings.provider === "ollama" ? "var(--accent)" : "var(--border)",
              background: settings.provider === "ollama" ? "var(--accent-soft)" : "var(--surface)",
              cursor: "pointer",
            }}
            onClick={() => save({ provider: "ollama" })}
            disabled={saving}
          >
            <div className="text-sm font-bold" style={{ color: "var(--ink)" }}>
              Ollama (local)
              {models && !models.ollama.available && (
                <span className="pill pill-warn ml-2">Not running</span>
              )}
            </div>
            <div className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
              Runs on this machine — no rate limits, works offline. Slower on big models.
            </div>
          </button>
        </div>
      </div>

      {/* OpenRouter model */}
      <div className="panel p-5">
        <div className="panel-header mb-1">OpenRouter model</div>
        <p className="mb-3 text-xs" style={{ color: "var(--ink-muted)" }}>
          Live list of free models on your account. Current:{" "}
          <span className="font-mono">{settings.openrouterModel || "none"}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            className="field-input min-w-0 flex-1"
            value={settings.openrouterModel}
            onChange={(e) => save({ openrouterModel: e.target.value })}
            disabled={saving || !models}
            aria-label="OpenRouter model"
          >
            {settings.openrouterModel && !(models?.openrouter ?? []).includes(settings.openrouterModel) && (
              <option value={settings.openrouterModel}>{settings.openrouterModel} (current)</option>
            )}
            {(models?.openrouter ?? []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        {models && models.openrouter.length === 0 && (
          <p className="mt-2 text-xs" style={{ color: "var(--warn)" }}>
            Couldn&apos;t load the free-model list from OpenRouter — check your internet connection.
          </p>
        )}
      </div>

      {/* Ollama model */}
      <div className="panel p-5">
        <div className="panel-header mb-1">Ollama model</div>
        <p className="mb-3 text-xs" style={{ color: "var(--ink-muted)" }}>
          Models installed at <span className="font-mono">{settings.ollamaBaseUrl}</span>. Current:{" "}
          <span className="font-mono">{settings.ollamaModel || "none"}</span>
        </p>
        {models && !models.ollama.available ? (
          <p className="text-sm" style={{ color: "var(--warn)" }}>
            Ollama isn&apos;t reachable. Start the Ollama app, then reload this page.
          </p>
        ) : (
          <select
            className="field-input w-full"
            value={settings.ollamaModel}
            onChange={(e) => save({ ollamaModel: e.target.value })}
            disabled={saving || !models}
            aria-label="Ollama model"
          >
            {settings.ollamaModel && !installedOllama.includes(settings.ollamaModel) && (
              <option value={settings.ollamaModel}>{settings.ollamaModel} (not installed)</option>
            )}
            {installedOllama.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}

        <div className="panel-header mb-2 mt-5">Pull a new Ollama model</div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SUGGESTED_PULLS.map((name) => (
            <button
              key={name}
              type="button"
              className="tool-btn !w-auto"
              onClick={() => pullModel(name)}
              disabled={pulling !== null || !models?.ollama.available}
            >
              {pulling === name ? "Pulling…" : name}
              {installedOllama.includes(name) ? " ✓" : ""}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="field-input min-w-0 flex-1"
            value={pullName}
            onChange={(e) => setPullName(e.target.value)}
            placeholder="Any model from ollama.com/library, e.g. qwen2.5:3b"
            disabled={pulling !== null}
            aria-label="Ollama model to pull"
          />
          <button
            className="btn-primary"
            onClick={() => pullName.trim() && pullModel(pullName.trim())}
            disabled={pulling !== null || pullName.trim() === "" || !models?.ollama.available}
          >
            {pulling && pulling === pullName.trim() ? "Pulling…" : "Pull"}
          </button>
        </div>
        {pulling && (
          <p className="mt-2 font-mono text-xs" style={{ color: "var(--ink-faint)" }}>
            Downloading {pulling} — large models can take several minutes. Keep this page open.
          </p>
        )}
      </div>
    </main>
  );
}
