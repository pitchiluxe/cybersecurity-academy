"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  validateAttempt, isComplete, scoreLab, requiredKey, connectionKey,
  type WiringScenario, type RequiredConnection, type PortRef,
} from "@/lib/wiringLab";
import { readStashedBrief } from "@/lib/labCatalog";

const WiringScene = dynamic(() => import("@/components/lab/WiringScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-sm" style={{ color: "var(--ink-faint)" }}>
      Loading 3D lab…
    </div>
  ),
});

export default function WiringLabPage() {
  return (
    // useSearchParams needs a Suspense boundary on statically generated pages.
    <Suspense fallback={null}>
      <WiringLab />
    </Suspense>
  );
}

function WiringLab() {
  const searchParams = useSearchParams();
  const labIdParam = searchParams.get("lab");
  const [scenario, setScenario] = useState<WiringScenario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<RequiredConnection[]>([]);
  const [wrong, setWrong] = useState(0);
  const [flash, setFlash] = useState<{ key: string; ok: boolean } | null>(null);
  const [done, setDone] = useState(false);
  const [recorded, setRecorded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const brief = readStashedBrief(labIdParam);
    fetch("/api/lab/wiring", { method: "POST", body: JSON.stringify({ brief }) })
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
  }, [labIdParam]);

  const madeKeys = useMemo(() => new Set(made.map(requiredKey)), [made]);
  const score = scoreLab(wrong);

  function handleAttempt(a: PortRef, b: PortRef) {
    if (!scenario || done) return;
    const result = validateAttempt(scenario, madeKeys, a, b);
    if (result.ok) {
      const next = [...made, result.connection];
      setMade(next);
      setFlash({ key: connectionKey(a, b), ok: true });
      if (isComplete(scenario, new Set(next.map(requiredKey)))) {
        setDone(true);
        fetch("/api/lab/complete", {
          method: "POST",
          body: JSON.stringify({ kind: "wiring", score: scoreLab(wrong) }),
        }).then((res) => setRecorded(res.ok));
      }
    } else if (result.reason === "not-required") {
      setWrong((w) => w + 1);
      setFlash({ key: connectionKey(a, b), ok: false });
      setTimeout(() => setFlash(null), 900);
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-center">
        <p role="alert" className="text-sm" style={{ color: "var(--warn)" }}>{error}</p>
      </main>
    );
  }

  if (!scenario) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-center">
        <p className="font-mono text-sm" style={{ color: "var(--ink-faint)" }}>Designing your wiring job…</p>
      </main>
    );
  }

  const steps = [...scenario.requiredConnections].sort((x, y) => x.step - y.step);

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <h1 className="font-display text-xl font-bold" style={{ color: "var(--ink)" }}>{scenario.title}</h1>
      <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--ink-muted)" }}>{scenario.backstory}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="h-[540px] overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
          <WiringScene scenario={scenario} made={made} packetsActive={done} onAttempt={handleAttempt} flash={flash} />
        </div>

        <aside className="panel h-fit p-4">
          <div className="panel-header">Wiring instructions</div>
          <ol className="mt-3 flex flex-col gap-2">
            {steps.map((s) => {
              const complete = madeKeys.has(requiredKey(s));
              return (
                <li key={s.step} className="flex items-start gap-2 text-sm" style={{ color: complete ? "var(--accent)" : "var(--ink-muted)" }}>
                  <span className="font-mono text-[11px]">{complete ? "✓" : `${s.step}.`}</span>
                  <span>{s.instruction} <span className="font-mono text-[10px] uppercase" style={{ color: "var(--ink-faint)" }}>({s.cable})</span></span>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex justify-between font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
            <span>Wrong attempts: {wrong}</span>
            <span>Score: {score}</span>
          </div>
          {done && (
            <div className="mt-4 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
              All links up — packets flowing! Lab complete, score {score}.
              {recorded && " Counted toward your cert labs."}
            </div>
          )}
          <p className="mt-4 text-[12px]" style={{ color: "var(--ink-faint)" }}>
            Click a port, then click the port it connects to. Arrow keys move around · left-drag to orbit · right-drag to pan · scroll to zoom · click the axis cube (bottom-right) to snap to a view.
          </p>
        </aside>
      </div>
    </main>
  );
}
