"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  validateInstall, isBuildComplete, scoreHardwareLab,
  type HardwareScenario, type RequiredInstall,
} from "@/lib/hardwareLab";
import { readStashedBrief } from "@/lib/labCatalog";
import { getBootcampSkill, isBootcampSkillId } from "@/lib/bootcamp";
import LabTutor from "@/components/lab/LabTutor";

const HardwareScene = dynamic(() => import("@/components/lab/HardwareScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-sm" style={{ color: "var(--ink-faint)" }}>
      Loading 3D lab…
    </div>
  ),
});

export default function HardwareLabPage() {
  return (
    // useSearchParams needs a Suspense boundary on statically generated pages.
    <Suspense fallback={null}>
      <HardwareLab />
    </Suspense>
  );
}

const WRONG_HINTS: Record<string, string> = {
  "part-installed": "That part is already installed.",
  "slot-occupied": "That slot is already populated.",
  "wrong-slot": "Wrong part or wrong slot — check the build sheet.",
};

function HardwareLab() {
  const searchParams = useSearchParams();
  const labIdParam = searchParams.get("lab");
  // Opened from a bootcamp chapter: seed the scenario from that skill and
  // record completion against the camp instead of the generic lab counter.
  const skillParam = searchParams.get("skill");
  const bootcampSkill = isBootcampSkillId(skillParam) ? getBootcampSkill(skillParam!) : undefined;

  const [scenario, setScenario] = useState<HardwareScenario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<RequiredInstall[]>([]);
  const [wrong, setWrong] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [flashSlot, setFlashSlot] = useState<{ slot: string; ok: boolean } | null>(null);
  const [done, setDone] = useState(false);
  const [recorded, setRecorded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const brief = bootcampSkill
      ? `Bootcamp chapter "${bootcampSkill.title}": ${bootcampSkill.blurb} Design a bench job exercising exactly these topics: ${bootcampSkill.lessons.join("; ")}.`
      : readStashedBrief(labIdParam);
    fetch("/api/lab/hardware", { method: "POST", body: JSON.stringify({ brief }) })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labIdParam, skillParam]);

  const score = scoreHardwareLab(wrong);

  function handleAttempt(partId: string, slotId: string) {
    if (!scenario || done) return;
    const result = validateInstall(scenario, made, partId, slotId);
    if (result.ok) {
      const next = [...made, result.install];
      setMade(next);
      setHint(null);
      setFlashSlot({ slot: slotId, ok: true });
      if (isBuildComplete(scenario, next)) {
        setDone(true);
        const finalScore = scoreHardwareLab(wrong);
        const req = bootcampSkill
          ? fetch("/api/bootcamp/lab", { method: "POST", body: JSON.stringify({ skill: bootcampSkill.id }) })
          : fetch("/api/lab/complete", { method: "POST", body: JSON.stringify({ kind: "hardware", score: finalScore }) });
        req.then((res) => setRecorded(res.ok)).catch(() => {});
      }
    } else {
      setWrong((w) => w + 1);
      setHint(WRONG_HINTS[result.reason]);
      setFlashSlot({ slot: slotId, ok: false });
      setTimeout(() => setFlashSlot(null), 900);
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
        <p className="font-mono text-sm" style={{ color: "var(--ink-faint)" }}>Staging your bench and parts…</p>
      </main>
    );
  }

  const steps = [...scenario.requiredInstalls].sort((x, y) => x.step - y.step);
  const doneKeys = new Set(made.map((m) => `${m.part}>${m.slot}`));

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <h1 className="font-display text-xl font-bold" style={{ color: "var(--ink)" }}>{scenario.title}</h1>
      <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--ink-muted)" }}>{scenario.backstory}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="h-[540px] overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
          <HardwareScene scenario={scenario} made={made} poweredOn={done} onAttempt={handleAttempt} flashSlot={flashSlot} />
        </div>

        <aside className="panel h-fit p-4">
          <div className="panel-header">Build sheet</div>
          <ol className="mt-3 flex flex-col gap-2">
            {steps.map((s) => {
              const complete = doneKeys.has(`${s.part}>${s.slot}`);
              return (
                <li key={s.step} className="flex items-start gap-2 text-sm" style={{ color: complete ? "var(--accent)" : "var(--ink-muted)" }}>
                  <span className="font-mono text-[11px]">{complete ? "✓" : `${s.step}.`}</span>
                  <span>{s.instruction}</span>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex justify-between font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
            <span>Wrong attempts: {wrong}</span>
            <span>Score: {score}</span>
          </div>
          {hint && !done && (
            <p className="mt-2 text-[12px]" style={{ color: "var(--warn)" }}>{hint}</p>
          )}
          {done && (
            <div className="mt-4 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
              POST passed — the machine powers up! Lab complete, score {score}.
              {recorded && (bootcampSkill ? " Counted toward your bootcamp." : " Counted toward your cert labs.")}
            </div>
          )}
          <p className="mt-4 text-[12px]" style={{ color: "var(--ink-faint)" }}>
            Click a part in the tray, then click the slot it belongs in. Beware distractor parts that should stay on the bench. Arrow keys move around · left-drag to orbit · right-drag to pan · scroll to zoom.
          </p>
          <div className="mt-4">
            <LabTutor
              context={{
                engine: "hardware",
                title: scenario.title,
                backstory: scenario.backstory,
                steps: steps.map((s) => s.instruction),
              }}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
