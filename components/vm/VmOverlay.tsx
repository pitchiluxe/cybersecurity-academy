"use client";

import { useEffect, useRef, useState } from "react";
import type { ScenarioSeed } from "@/lib/types";
import type { VmExchange, VmSpec } from "@/lib/vm";

type Phase = "provisioning" | "error" | "locked" | "desktop";
type WindowId = "terminal" | "settings" | "files";

// Fixed dark hex palette on purpose: this is the "remote machine screen",
// visually distinct from the console UI in both themes.
export function VmOverlay({
  seed,
  onClose,
  onResolved,
}: {
  seed: ScenarioSeed;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("provisioning");
  const [error, setError] = useState<string | null>(null);
  const [spec, setSpec] = useState<VmSpec | null>(null);

  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState(false);

  const [openWindow, setOpenWindow] = useState<WindowId>("terminal");
  const [history, setHistory] = useState<VmExchange[]>([]);
  const [command, setCommand] = useState("");
  const [running, setRunning] = useState(false);
  const [resolved, setResolved] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/vm/init", { method: "POST", body: JSON.stringify({ seed }) })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not provision the machine.");
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setSpec(body.spec);
        setPhase("locked");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [seed]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, running]);

  function tryLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!spec) return;
    if (passwordInput === spec.password) {
      setPhase("desktop");
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  }

  async function runCommand(e: React.FormEvent) {
    e.preventDefault();
    if (!spec || running || command.trim() === "") return;
    const cmd = command.trim();
    setCommand("");
    setRunning(true);
    const res = await fetch("/api/vm/exec", {
      method: "POST",
      body: JSON.stringify({ seed, spec, history, command: cmd }),
    });
    const body = await res.json().catch(() => ({}));
    setRunning(false);
    const output = res.ok
      ? body.output
      : `[connection error] ${body.error ?? "remote session dropped, retry the command"}`;
    setHistory((prev) => [...prev, { command: cmd, output }]);
    if (res.ok && body.resolved && !resolved) {
      setResolved(true);
      onResolved();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0b1220" }}>
      <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: "#1e293b" }}>
        <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>
          Remote session — {spec ? `${spec.username}@${spec.hostname}` : "connecting…"} ({seed.environment.os})
        </span>
        <div className="flex items-center gap-3">
          {resolved && (
            <span
              className="rounded-full border px-3 py-0.5 font-mono text-[11px] uppercase"
              style={{ color: "#4ade80", borderColor: "#4ade80" }}
            >
              Fault resolved ✓
            </span>
          )}
          <button
            onClick={onClose}
            className="cursor-pointer rounded border px-3 py-1 font-mono text-[11px] uppercase"
            style={{ color: "#94a3b8", borderColor: "#334155" }}
          >
            Disconnect
          </button>
        </div>
      </div>

      {phase === "provisioning" && (
        <div className="flex flex-1 items-center justify-center">
          <p className="font-mono text-sm" style={{ color: "#64748b" }}>
            Provisioning machine…
          </p>
        </div>
      )}

      {phase === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p role="alert" className="max-w-lg px-6 text-center font-mono text-sm" style={{ color: "#f87171" }}>
            {error}
          </p>
          <button
            onClick={onClose}
            className="cursor-pointer rounded border px-4 py-1.5 font-mono text-xs"
            style={{ color: "#94a3b8", borderColor: "#334155" }}
          >
            Close
          </button>
        </div>
      )}

      {phase === "locked" && spec && (
        <div className="flex flex-1 items-center justify-center">
          <form
            onSubmit={tryLogin}
            className="w-80 rounded-2xl border p-8 text-center"
            style={{ borderColor: "#1e293b", background: "#111a2e" }}
          >
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl"
              style={{ background: "#1e293b", color: "#94a3b8" }}
            >
              👤
            </div>
            <div className="mt-3 font-mono text-sm" style={{ color: "#e2e8f0" }}>
              {spec.username}
            </div>
            <div className="font-mono text-[11px]" style={{ color: "#64748b" }}>
              {spec.hostname}
            </div>
            <input
              type="password"
              autoFocus
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Password"
              className="mt-4 w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none"
              style={{ background: "#0b1220", borderColor: loginError ? "#f87171" : "#334155", color: "#e2e8f0" }}
            />
            {loginError && (
              <p className="mt-2 font-mono text-[11px]" style={{ color: "#f87171" }}>
                Incorrect password.
              </p>
            )}
            <button
              type="submit"
              className="mt-4 w-full cursor-pointer rounded-lg py-2 font-mono text-sm"
              style={{ background: "#2563eb", color: "#fff" }}
            >
              Sign in
            </button>
            <p className="mt-3 font-mono text-[10px]" style={{ color: "#475569" }}>
              Password: {spec.password} (from the IT remote-access vault)
            </p>
          </form>
        </div>
      )}

      {phase === "desktop" && spec && (
        <>
          <div className="flex-1 overflow-hidden p-4">
            {openWindow === "terminal" && (
              <div
                className="mx-auto flex h-full max-w-3xl flex-col rounded-xl border"
                style={{ borderColor: "#1e293b", background: "#020617" }}
              >
                <div className="border-b px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: "#1e293b", color: "#64748b" }}>
                  Terminal — {spec.hostname}
                </div>
                <div className="flex-1 overflow-y-auto p-3 font-mono text-[13px] leading-relaxed" style={{ color: "#cbd5e1" }}>
                  <div style={{ color: "#64748b" }}>Connected. Type commands to troubleshoot this machine.</div>
                  {history.map((h, i) => (
                    <div key={i} className="mt-2">
                      <div style={{ color: "#4ade80" }}>
                        {spec.username}@{spec.hostname}&gt; {h.command}
                      </div>
                      <pre className="whitespace-pre-wrap" style={{ color: "#cbd5e1" }}>
                        {h.output}
                      </pre>
                    </div>
                  ))}
                  {running && (
                    <div className="mt-2" style={{ color: "#64748b" }}>
                      …
                    </div>
                  )}
                  <div ref={terminalEndRef} />
                </div>
                <form onSubmit={runCommand} className="flex gap-2 border-t p-2" style={{ borderColor: "#1e293b" }}>
                  <span className="py-1.5 font-mono text-[13px]" style={{ color: "#4ade80" }}>
                    &gt;
                  </span>
                  <input
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    disabled={running}
                    autoFocus
                    spellCheck={false}
                    className="flex-1 bg-transparent font-mono text-[13px] outline-none"
                    style={{ color: "#e2e8f0" }}
                    placeholder={running ? "running…" : "type a command"}
                  />
                </form>
              </div>
            )}

            {openWindow === "settings" && (
              <div
                className="mx-auto h-full max-w-3xl overflow-y-auto rounded-xl border p-4"
                style={{ borderColor: "#1e293b", background: "#0f172a" }}
              >
                <div className="font-mono text-[11px] uppercase" style={{ color: "#64748b" }}>
                  System settings
                </div>
                {spec.settingsPanels.map((p) => (
                  <div key={p.title} className="mt-4">
                    <div className="font-mono text-sm font-bold" style={{ color: "#e2e8f0" }}>
                      {p.title}
                    </div>
                    <div className="mt-2 flex flex-col gap-1">
                      {p.entries.map((entry) => (
                        <div
                          key={entry.label}
                          className="flex justify-between gap-4 border-b py-1.5 font-mono text-[12px]"
                          style={{ borderColor: "#1e293b" }}
                        >
                          <span style={{ color: "#94a3b8" }}>{entry.label}</span>
                          <span className="text-right" style={{ color: "#e2e8f0" }}>
                            {entry.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {openWindow === "files" && (
              <div
                className="mx-auto h-full max-w-3xl overflow-y-auto rounded-xl border p-4"
                style={{ borderColor: "#1e293b", background: "#0f172a" }}
              >
                <div className="font-mono text-[11px] uppercase" style={{ color: "#64748b" }}>
                  Files of interest
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {spec.files.map((f) => (
                    <div key={f.path} className="rounded-lg border p-3" style={{ borderColor: "#1e293b" }}>
                      <div className="font-mono text-[12px]" style={{ color: "#e2e8f0" }}>
                        {f.path}
                      </div>
                      <div className="mt-1 text-[12px]" style={{ color: "#94a3b8" }}>
                        {f.description}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 font-mono text-[11px]" style={{ color: "#475569" }}>
                  Use the terminal to view or edit file contents (type, cat, notepad…).
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t px-4 py-2" style={{ borderColor: "#1e293b", background: "#0f172a" }}>
            {(
              [
                ["terminal", "Terminal"],
                ["settings", "Settings"],
                ["files", "Files"],
              ] as [WindowId, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setOpenWindow(id)}
                className="cursor-pointer rounded px-3 py-1.5 font-mono text-[11px] uppercase"
                style={{
                  color: openWindow === id ? "#e2e8f0" : "#64748b",
                  background: openWindow === id ? "#1e293b" : "transparent",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
