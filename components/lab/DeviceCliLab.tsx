"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  validateAttempt, isComplete, requiredKey, connectionKey,
  type WiringScenario, type RequiredConnection, type PortRef,
} from "@/lib/wiringLab";
import { scoreFortigateLab, type FortigateScenario } from "@/lib/fortigateLab";
import { readStashedBrief } from "@/lib/labCatalog";
import LabTutor from "@/components/lab/LabTutor";
import type { VmExchange } from "@/lib/vm";

const WiringScene = dynamic(() => import("@/components/lab/WiringScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-sm" style={{ color: "var(--ink-faint)" }}>
      Loading 3D lab…
    </div>
  ),
});

/** Rack-cable-then-configure lab: 3D wiring phase followed by a simulated device CLI. */
export interface DeviceCliLabConfig {
  initEndpoint: string;
  execEndpoint: string;
  /** `kind` sent to /api/lab/complete. */
  completeKind: "fortigate" | "router";
  loadingText: string;
  consoleName: string;
  /** Prefix shown before each command in the console history (e.g. "FortiGate-60F #"). */
  historyPrompt: string;
  /** Short prompt symbol shown next to the input field. */
  inputPrompt: string;
  loginHint: string;
  /** Suffix shown in the console header while the device is uncabled. */
  lockedHint: string;
  inputPlaceholder: string;
  completeMessage: string;
}

export default function DeviceCliLab({ config }: { config: DeviceCliLabConfig }) {
  const searchParams = useSearchParams();
  const labIdParam = searchParams.get("lab");
  const [scenario, setScenario] = useState<FortigateScenario | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [made, setMade] = useState<RequiredConnection[]>([]);
  const [wrong, setWrong] = useState(0);
  const [flash, setFlash] = useState<{ key: string; ok: boolean } | null>(null);

  const [doneTasks, setDoneTasks] = useState<string[]>([]);
  const [history, setHistory] = useState<VmExchange[]>([]);
  const [command, setCommand] = useState("");
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const brief = readStashedBrief(labIdParam);
    fetch(config.initEndpoint, { method: "POST", body: JSON.stringify({ brief }) })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not load the lab.");
        return body;
      })
      .then((body) => {
        if (!cancelled) setScenario(body.scenario);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [labIdParam, config.initEndpoint]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, running]);

  const wiringScenario: WiringScenario | null = useMemo(
    () =>
      scenario
        ? { title: scenario.title, backstory: scenario.backstory, devices: scenario.devices, requiredConnections: scenario.wiring }
        : null,
    [scenario]
  );
  const madeKeys = useMemo(() => new Set(made.map(requiredKey)), [made]);
  const wired = wiringScenario ? isComplete(wiringScenario, madeKeys) : false;
  const score = scoreFortigateLab(wrong, 0);

  function handleAttempt(a: PortRef, b: PortRef) {
    if (!wiringScenario || wired) return;
    const result = validateAttempt(wiringScenario, madeKeys, a, b);
    if (result.ok) {
      setMade((prev) => [...prev, result.connection]);
      setFlash({ key: connectionKey(a, b), ok: true });
    } else if (result.reason === "not-required") {
      setWrong((w) => w + 1);
      setFlash({ key: connectionKey(a, b), ok: false });
      setTimeout(() => setFlash(null), 900);
    }
  }

  async function runCommand(e: React.FormEvent) {
    e.preventDefault();
    if (!scenario || running || complete || command.trim() === "") return;
    const cmd = command.trim();
    setCommand("");
    setRunning(true);
    const res = await fetch(config.execEndpoint, {
      method: "POST",
      body: JSON.stringify({ scenario, doneTaskIds: doneTasks, history, command: cmd }),
    });
    const body = await res.json().catch(() => ({}));
    setRunning(false);
    const output = res.ok ? body.output : `[connection error] ${body.error ?? "console dropped, retry"}`;
    setHistory((prev) => [...prev, { command: cmd, output }]);
    if (res.ok) {
      if (body.doneIds.length > 0) {
        setDoneTasks((prev) => [...prev, ...body.doneIds.filter((id: string) => !prev.includes(id))]);
      }
      if (body.complete && !complete) {
        setComplete(true);
        fetch("/api/lab/complete", {
          method: "POST",
          body: JSON.stringify({ kind: config.completeKind, score: scoreFortigateLab(wrong, 0) }),
        }).then((r) => setRecorded(r.ok));
      }
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-center">
        <p role="alert" className="text-sm" style={{ color: "var(--warn)" }}>{error}</p>
      </main>
    );
  }
  if (!scenario || !wiringScenario) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-center">
        <p className="font-mono text-sm" style={{ color: "var(--ink-faint)" }}>{config.loadingText}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <h1 className="font-display text-xl font-bold" style={{ color: "var(--ink)" }}>{scenario.title}</h1>
      <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--ink-muted)" }}>{scenario.backstory}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="h-[520px] overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
          <WiringScene scenario={wiringScenario} made={made} packetsActive={complete} onAttempt={handleAttempt} flash={flash} />
        </div>

        <aside className="flex h-[520px] flex-col gap-3">
          <div className="panel p-4">
            <div className="panel-header">{wired ? "Configuration tasks" : "Step 1 — cable it in"}</div>
            <ol className="mt-2 flex flex-col gap-1.5">
              {!wired &&
                [...scenario.wiring].sort((x, y) => x.step - y.step).map((s) => (
                  <li key={s.step} className="flex items-start gap-2 text-sm" style={{ color: madeKeys.has(requiredKey(s)) ? "var(--accent)" : "var(--ink-muted)" }}>
                    <span className="font-mono text-[11px]">{madeKeys.has(requiredKey(s)) ? "✓" : `${s.step}.`}</span>
                    <span>{s.instruction}</span>
                  </li>
                ))}
              {wired &&
                scenario.tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-2 text-sm" style={{ color: doneTasks.includes(t.id) ? "var(--accent)" : "var(--ink-muted)" }}>
                    <span className="font-mono text-[11px]">{doneTasks.includes(t.id) ? "✓" : "○"}</span>
                    <span>{t.instruction}</span>
                  </li>
                ))}
            </ol>
            <div className="mt-2 flex justify-between font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
              <span>Wrong cables: {wrong}</span>
              <span>Score: {score}</span>
            </div>
            {complete && (
              <div className="mt-2 rounded-xl border p-2 text-sm" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
                {config.completeMessage}, score {score}.{recorded && " Counted toward your cert labs."}
              </div>
            )}
            {!wired && (
              <p className="mt-2 text-[11px]" style={{ color: "var(--ink-faint)" }}>
                Click a port then its match. Arrow keys move around · left-drag to orbit · right-drag to pan · scroll to zoom · axis cube snaps views.
              </p>
            )}
          </div>

          <LabTutor
            context={{
              engine: config.completeKind,
              title: scenario.title,
              backstory: scenario.backstory,
              steps: [...scenario.wiring].sort((x, y) => x.step - y.step).map((s) => s.instruction),
              tasks: scenario.tasks.map((t) => t.instruction),
            }}
          />

          <div className="flex min-h-0 flex-1 flex-col rounded-xl border" style={{ borderColor: "#1e293b", background: "#020617" }}>
            <div className="border-b px-3 py-1.5 font-mono text-[11px]" style={{ borderColor: "#1e293b", color: "#64748b" }}>
              {config.consoleName} {wired ? "— connected" : `— ${config.lockedHint}`}
            </div>
            <div className="flex-1 overflow-y-auto p-3 font-mono text-[12px] leading-relaxed" style={{ color: "#cbd5e1" }}>
              {!wired && <div style={{ color: "#64748b" }}>Console locked until the unit is cabled.</div>}
              {wired && <div style={{ color: "#64748b" }}>{config.loginHint}</div>}
              {history.map((h, i) => (
                <div key={i} className="mt-2">
                  <div style={{ color: "#4ade80" }}>{config.historyPrompt} {h.command}</div>
                  <pre className="whitespace-pre-wrap" style={{ color: "#cbd5e1" }}>{h.output}</pre>
                </div>
              ))}
              {running && <div className="mt-2" style={{ color: "#64748b" }}>…</div>}
              <div ref={endRef} />
            </div>
            <form onSubmit={runCommand} className="flex gap-2 border-t p-2" style={{ borderColor: "#1e293b" }}>
              <span className="py-1 font-mono text-[12px]" style={{ color: "#4ade80" }}>{config.inputPrompt}</span>
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                disabled={!wired || running || complete}
                spellCheck={false}
                className="flex-1 bg-transparent font-mono text-[12px] outline-none"
                style={{ color: "#e2e8f0" }}
                placeholder={!wired ? "cable the unit first" : running ? "running…" : config.inputPlaceholder}
              />
            </form>
          </div>
        </aside>
      </div>
    </main>
  );
}
