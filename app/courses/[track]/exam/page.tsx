"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import { isTrackId, getTrack } from "@/lib/courses";
import type { ExamSpec, ExamResult, ExamAttempt, ClientExamQuestion } from "@/lib/exam";

interface ClientExam {
  track: string;
  code: string;
  questions: ClientExamQuestion[];
}

export default function ExamPage() {
  const params = useParams<{ track: string }>();
  const track = params.track;

  const [exam, setExam] = useState<ClientExam | null>(null);
  const [spec, setSpec] = useState<ExamSpec | null>(null);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const valid = isTrackId(track);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    fetch("/api/exam/generate", { method: "POST", body: JSON.stringify({ track }) })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not load the exam.");
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setExam(body.exam);
        setSpec(body.spec);
        setAttempts(body.attempts ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [track, valid]);

  if (!valid) notFound();
  const meta = getTrack(track);

  async function submit() {
    if (!exam || submitting) return;
    setSubmitting(true);
    setError(null);
    const list = exam.questions.map((q) => (q.id in answers ? answers[q.id] : null));
    const res = await fetch("/api/exam/grade", {
      method: "POST",
      body: JSON.stringify({ track, answers: list }),
    });
    const body = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(body.error ?? "Grading failed.");
      return;
    }
    setResult(body.result);
    setAttempts(body.attempts ?? []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function newExam() {
    setRegenerating(true);
    setResult(null);
    setAnswers({});
    setExam(null);
    setError(null);
    const res = await fetch("/api/exam/generate", { method: "POST", body: JSON.stringify({ track, fresh: true }) });
    const body = await res.json().catch(() => ({}));
    setRegenerating(false);
    if (!res.ok) {
      setError(body.error ?? "Could not generate a new exam.");
      return;
    }
    setExam(body.exam);
    setSpec(body.spec);
    setAttempts(body.attempts ?? []);
  }

  const answered = exam ? exam.questions.filter((q) => q.id in answers).length : 0;

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="font-mono text-xs font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
        Final exam · {meta.title}
      </div>
      <h1 className="font-display mt-1 text-2xl font-bold" style={{ color: "var(--ink)" }}>
        {spec ? `${spec.code} practice exam` : "Practice exam"}
      </h1>
      {spec && (
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          {spec.questions} questions — same as the real exam · real time limit {spec.minutes} min · scored{" "}
          {spec.scaleMin}–{spec.scaleMax}, pass mark {spec.passMark}.
        </p>
      )}
      <p className="mt-1">
        <Link href={`/courses/${track}`} className="text-sm underline" style={{ color: "var(--accent)" }}>
          ← Back to the course
        </Link>
      </p>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border px-3 py-2 text-sm" style={{ color: "var(--warn)", borderColor: "var(--warn-line)", background: "var(--warn-soft)" }}>
          {error}
        </p>
      )}

      {!exam && !error && (
        <div className="mt-8 text-center">
          <p className="font-mono text-sm" style={{ color: "var(--ink-faint)" }}>
            {regenerating ? "Writing a fresh exam…" : "Preparing your exam…"}
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--ink-faint)" }}>
            First time takes a while — the AI writes the full real-world question count in batches. It's cached afterwards.
          </p>
        </div>
      )}

      {result && spec && (
        <div className="panel mt-6 p-5">
          <div className="panel-header">Result</div>
          <div className="mt-3 flex flex-wrap items-baseline gap-4">
            <span className="font-display text-4xl font-bold" style={{ color: result.passed ? "var(--good, var(--accent))" : "var(--danger)" }}>
              {result.scaled}
            </span>
            <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
              pass mark {result.passMark} · {result.correct}/{result.total} correct ({result.percent}%)
            </span>
            <span
              className="rounded-full border px-3 py-0.5 font-mono text-xs font-bold uppercase"
              style={
                result.passed
                  ? { color: "var(--accent)", borderColor: "var(--accent)" }
                  : { color: "var(--danger)", borderColor: "var(--danger)" }
              }
            >
              {result.passed ? "PASS" : "FAIL"}
            </span>
          </div>
          <div className="mt-4">
            <div className="font-mono text-[11px] uppercase" style={{ color: "var(--ink-faint)" }}>By exam domain</div>
            <ul className="mt-1 flex flex-col gap-1">
              {result.domains.map((d) => (
                <li key={d.domain} className="flex justify-between text-sm" style={{ color: "var(--ink-muted)" }}>
                  <span>{d.domain}</span>
                  <span className="font-mono text-xs">{d.correct}/{d.total}</span>
                </li>
              ))}
            </ul>
          </div>
          {attempts.length > 1 && (
            <p className="mt-3 font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
              Attempts: {attempts.map((a) => `${a.scaled}${a.passed ? "✓" : "✗"}`).join(" · ")}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button className="btn-ghost text-sm" onClick={() => { setResult(null); setAnswers({}); window.scrollTo({ top: 0 }); }}>
              Retake this exam
            </button>
            <button className="btn-ghost text-sm" onClick={newExam} disabled={regenerating}>
              {regenerating ? "Writing…" : "Generate a brand-new exam"}
            </button>
          </div>
        </div>
      )}

      {exam && (
        <div className="mt-6 flex flex-col gap-4">
          {exam.questions.map((q, qi) => {
            const missed = result?.review.find((r) => r.id === q.id);
            return (
              <div key={q.id} className="panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                    {qi + 1}. {q.question}
                  </p>
                  <span className="whitespace-nowrap font-mono text-[10px] uppercase" style={{ color: "var(--ink-faint)" }}>
                    {q.domain}
                  </span>
                </div>
                <div className="mt-2 flex flex-col gap-1.5">
                  {q.choices.map((c, ci) => {
                    const chosen = answers[q.id] === ci;
                    const showRight = result && missed && missed.correctIndex === ci;
                    const showWrong = result && missed && missed.yourIndex === ci;
                    return (
                      <label
                        key={ci}
                        className="flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-1.5 text-sm"
                        style={{
                          borderColor: showRight ? "var(--accent)" : showWrong ? "var(--danger)" : chosen ? "var(--accent-line)" : "var(--border)",
                          background: chosen && !result ? "var(--accent-soft)" : "var(--surface)",
                          color: "var(--ink-muted)",
                        }}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          className="mt-0.5"
                          checked={chosen}
                          disabled={!!result}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: ci }))}
                        />
                        <span>{c}</span>
                      </label>
                    );
                  })}
                </div>
                {result && missed && (
                  <p className="mt-2 text-xs" style={{ color: "var(--ink-faint)" }}>
                    {missed.explanation}
                  </p>
                )}
              </div>
            );
          })}

          {!result && (
            <div className="sticky bottom-4 flex items-center justify-between rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <span className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>
                {answered}/{exam.questions.length} answered
              </span>
              <button className="btn-primary" onClick={submit} disabled={submitting}>
                {submitting ? "Grading…" : "Submit exam"}
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
