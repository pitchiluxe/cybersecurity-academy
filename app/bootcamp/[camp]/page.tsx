"use client";

import { useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import type { ScenarioSeed } from "@/lib/types";
import {
  getBootcamp, isBootcampId, skillsForBootcamp, BOOTCAMP_PASS_SCORE,
  type BootcampSkill, type ClientBootcampChapter,
} from "@/lib/bootcamp";
import LabTutor from "@/components/lab/LabTutor";
import { VmOverlay } from "@/components/vm/VmOverlay";

interface QuizState {
  answers: Record<number, number>;
  result: { score: number; passed: boolean; correct: boolean[]; answerKey: number[] } | null;
  submitting: boolean;
}

interface ProgressRow {
  skill: string;
  quiz_score: number;
  lab_done: number;
}

function formatDate(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function BootcampCampPage() {
  const params = useParams<{ camp: string }>();
  const campId = params.camp;
  const valid = isBootcampId(campId);

  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, ProgressRow>>({});
  const [certificate, setCertificate] = useState<{ code: string; issuedAt: string } | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Record<string, ClientBootcampChapter>>({});
  // AI lab seed generated with each chapter, so "Launch VM lab" matches the lesson.
  const [labSeeds, setLabSeeds] = useState<Record<string, ScenarioSeed>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [quiz, setQuiz] = useState<Record<string, QuizState>>({});
  const [vmSkill, setVmSkill] = useState<BootcampSkill | null>(null);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    fetch("/api/bootcamp/enroll", { method: "POST", body: JSON.stringify({ camp: campId }) })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled || !body) return;
        setStartedAt(body.startedAt);
        setCertificate(body.certificate);
        const map: Record<string, ProgressRow> = {};
        for (const row of body.progress ?? []) map[row.skill] = row;
        setProgress(map);
      })
      .catch(() => {});
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled) setEmail(body?.user?.email ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [campId, valid]);

  if (!valid) notFound();
  const camp = getBootcamp(campId)!;
  const skills = skillsForBootcamp(campId);
  const passedCount = skills.filter((s) => (progress[s.id]?.quiz_score ?? 0) >= BOOTCAMP_PASS_SCORE).length;
  const labsDoneCount = skills.filter((s) => !!progress[s.id]?.lab_done).length;

  // Every call generates a brand-new AI chapter: fresh lesson, fresh randomized
  // quiz, fresh lesson-matched VM lab. `fresh` re-rolls an already-open chapter.
  async function openChapter(skill: BootcampSkill, fresh = false) {
    if ((chapters[skill.id] && !fresh) || loading) return;
    setLoading(skill.id);
    setErrors((prev) => ({ ...prev, [skill.id]: "" }));
    const res = await fetch("/api/bootcamp/chapter", {
      method: "POST",
      body: JSON.stringify({ skill: skill.id }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(null);
    if (!res.ok) {
      setErrors((prev) => ({ ...prev, [skill.id]: body.error ?? "Could not load the chapter." }));
      return;
    }
    setChapters((prev) => ({ ...prev, [skill.id]: body.chapter }));
    if (body.labSeed) setLabSeeds((prev) => ({ ...prev, [skill.id]: body.labSeed }));
    setQuiz((prev) => ({ ...prev, [skill.id]: { answers: {}, result: null, submitting: false } }));
  }

  async function submitQuiz(skill: BootcampSkill) {
    const chapter = chapters[skill.id];
    const q = quiz[skill.id];
    if (!chapter || !q || q.submitting) return;
    setQuiz((prev) => ({ ...prev, [skill.id]: { ...q, submitting: true } }));
    const answers = chapter.quiz.map((_, i) => (i in q.answers ? q.answers[i] : null));
    const res = await fetch("/api/bootcamp/quiz", {
      method: "POST",
      body: JSON.stringify({ skill: skill.id, answers }),
    });
    const body = await res.json().catch(() => ({}));
    setQuiz((prev) => ({
      ...prev,
      [skill.id]: {
        ...q,
        submitting: false,
        result: res.ok ? { score: body.score, passed: body.passed, correct: body.correct, answerKey: body.answerKey } : null,
      },
    }));
    if (!res.ok) {
      setErrors((prev) => ({ ...prev, [skill.id]: body.error ?? "Grading failed." }));
      return;
    }
    setProgress((prev) => ({
      ...prev,
      [skill.id]: {
        skill: skill.id,
        quiz_score: Math.max(prev[skill.id]?.quiz_score ?? 0, body.score),
        lab_done: prev[skill.id]?.lab_done ?? 0,
      },
    }));
    if (body.newCertificate) {
      setCertificate({ code: body.newCertificate, issuedAt: new Date().toISOString() });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleLabResolved(skill: BootcampSkill) {
    setProgress((prev) => ({
      ...prev,
      [skill.id]: { skill: skill.id, quiz_score: prev[skill.id]?.quiz_score ?? 0, lab_done: 1 },
    }));
    // The lab may complete the camp's material and earn the certificate.
    fetch("/api/bootcamp/lab", { method: "POST", body: JSON.stringify({ skill: skill.id }) })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (body?.newCertificate) {
          setCertificate({ code: body.newCertificate, issuedAt: new Date().toISOString() });
        }
      })
      .catch(() => {});
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="font-mono text-xs font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
        {camp.certName} bootcamp
        {startedAt && <> · your training started {formatDate(startedAt)}</>}
      </div>
      <h1 className="font-display mt-1 text-3xl font-bold" style={{ color: "var(--ink)" }}>
        {camp.title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
        {camp.blurb}
      </p>
      <p className="mt-2 font-mono text-xs" style={{ color: "var(--ink-faint)" }}>
        {passedCount}/{skills.length} quizzes passed · {labsDoneCount}/{skills.length} labs completed — finish every
        chapter quiz and VM lab to unlock your {camp.certName} certificate ·{" "}
        <Link href="/bootcamp" className="underline">switch bootcamp</Link>
      </p>

      {certificate && (
        <div className="cert-card mt-6 rounded-2xl border-2 p-8 text-center" style={{ borderColor: "var(--accent)", background: "var(--surface)" }}>
          <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>
            Cybersecurity Academy · Certificate of Completion
          </div>
          <div className="font-display mt-4 text-2xl font-bold" style={{ color: "var(--ink)" }}>
            {camp.certName}
          </div>
          <div className="mt-3 text-sm" style={{ color: "var(--ink-muted)" }}>
            Awarded to{" "}
            <span className="font-semibold" style={{ color: "var(--ink)" }}>{email ?? "you"}</span>
            <br />
            for completing all {skills.length} chapters and hands-on labs of the {camp.title}.
          </div>
          <div className="mt-4 font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
            {certificate.code} · issued {formatDate(certificate.issuedAt)}
          </div>
          <button onClick={() => window.print()} className="btn-primary print-hide mt-4">
            Print certificate
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {skills.map((skill) => {
          const isOpen = expanded === skill.id;
          const chapter = chapters[skill.id];
          const q = quiz[skill.id];
          const err = errors[skill.id];
          const saved = progress[skill.id];
          const quizPassed = (saved?.quiz_score ?? 0) >= BOOTCAMP_PASS_SCORE;
          return (
            <div key={skill.id} className="panel overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : skill.id)}
                className="flex w-full cursor-pointer items-center gap-3 p-4 text-left"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  {String(skill.num).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="font-display text-base font-bold" style={{ color: "var(--ink)" }}>{skill.title}</span>
                    <span className="font-mono text-[10px] uppercase" style={{ color: "var(--ink-faint)" }}>{skill.week}</span>
                    {quizPassed && (
                      <span className="font-mono text-[10px] uppercase" style={{ color: "var(--accent)" }}>quiz ✓</span>
                    )}
                    {!!saved?.lab_done && (
                      <span className="font-mono text-[10px] uppercase" style={{ color: "var(--accent)" }}>lab ✓</span>
                    )}
                  </span>
                  {!isOpen && (
                    <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--ink-muted)" }}>{skill.blurb}</span>
                  )}
                </span>
                <span className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>{isOpen ? "▲" : "▼"}</span>
              </button>

              {isOpen && (
                <div className="border-t px-4 pb-4" style={{ borderColor: "var(--border)" }}>
                  <p className="mt-3 text-sm" style={{ color: "var(--ink-muted)" }}>{skill.blurb}</p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {skill.lessons.map((l, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--ink-muted)" }}>
                        <span className="font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>{i + 1}.</span>
                        <span>{l}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {!chapter && (
                      <button className="btn-primary text-sm" onClick={() => openChapter(skill)} disabled={loading !== null}>
                        {loading === skill.id ? "Writing your chapter…" : "📖 Open chapter (AI lesson + quiz)"}
                      </button>
                    )}
                    {chapter && (
                      <button className="btn-ghost text-sm" onClick={() => openChapter(skill, true)} disabled={loading !== null}>
                        {loading === skill.id ? "Rewriting…" : "🎲 New lesson + quiz"}
                      </button>
                    )}
                    {skill.labKind === "hardware" ? (
                      <Link className="btn-ghost text-sm" href={`/labs/hardware?skill=${skill.id}`}>
                        🔧 Launch 3D hardware lab
                      </Link>
                    ) : skill.labKind === "wiring" ? (
                      <Link className="btn-ghost text-sm" href={`/labs/wiring?skill=${skill.id}`}>
                        🔌 Launch 3D wiring lab
                      </Link>
                    ) : (
                      <button className="btn-ghost text-sm" onClick={() => setVmSkill(skill)}>
                        🖥️ Launch VM lab
                      </button>
                    )}
                  </div>

                  {err && (
                    <p role="alert" className="mt-2 text-sm" style={{ color: "var(--warn)" }}>{err}</p>
                  )}

                  {chapter && (
                    <div className="mt-4">
                      <div className="panel-header">Lesson</div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                        {chapter.lesson}
                      </p>

                      <div className="panel-header mt-5">Chapter quiz</div>
                      <div className="mt-2 flex flex-col gap-3">
                        {chapter.quiz.map((question, qi) => {
                          const chosen = q?.answers[qi];
                          const result = q?.result;
                          return (
                            <fieldset key={qi}>
                              <legend className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                                {qi + 1}. {question.question}
                                {result && (
                                  <span className="ml-2 font-mono text-[11px]" style={{ color: result.correct[qi] ? "var(--accent)" : "var(--danger)" }}>
                                    {result.correct[qi] ? "✓" : "✗"}
                                  </span>
                                )}
                              </legend>
                              <div className="mt-1 flex flex-col gap-1">
                                {question.choices.map((c, ci) => (
                                  <label
                                    key={ci}
                                    className="flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-1.5 text-sm"
                                    style={{
                                      borderColor:
                                        result && result.answerKey[qi] === ci
                                          ? "var(--accent)"
                                          : chosen === ci
                                            ? "var(--accent-line)"
                                            : "var(--border)",
                                      background: chosen === ci && !result ? "var(--accent-soft)" : "var(--surface)",
                                      color: "var(--ink-muted)",
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name={`${skill.id}-q${qi}`}
                                      className="mt-0.5"
                                      checked={chosen === ci}
                                      disabled={!!result}
                                      onChange={() =>
                                        setQuiz((prev) => ({
                                          ...prev,
                                          [skill.id]: { ...prev[skill.id], answers: { ...prev[skill.id].answers, [qi]: ci } },
                                        }))
                                      }
                                    />
                                    <span>{c}</span>
                                  </label>
                                ))}
                              </div>
                            </fieldset>
                          );
                        })}
                      </div>
                      {q?.result ? (
                        <p className="mt-3 text-sm" style={{ color: q.result.passed ? "var(--accent)" : "var(--warn)" }}>
                          Score: {q.result.score}% — {q.result.passed ? "passed!" : `below ${BOOTCAMP_PASS_SCORE}%, review the lesson and retry.`}
                          {!q.result.passed && (
                            <button
                              className="btn-ghost ml-2 text-xs"
                              onClick={() => setQuiz((prev) => ({ ...prev, [skill.id]: { answers: {}, result: null, submitting: false } }))}
                            >
                              Retry
                            </button>
                          )}
                        </p>
                      ) : (
                        <button
                          className="btn-primary mt-3"
                          onClick={() => submitQuiz(skill)}
                          disabled={!q || q.submitting || Object.keys(q?.answers ?? {}).length < chapter.quiz.length}
                        >
                          {q?.submitting ? "Grading…" : "Submit quiz"}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="mt-4">
                    <LabTutor
                      context={{
                        engine: "bootcamp",
                        title: `Skill ${String(skill.num).padStart(2, "0")} — ${skill.title}`,
                        backstory: skill.blurb,
                        steps: skill.lessons,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {vmSkill && (
        <VmOverlay
          seed={labSeeds[vmSkill.id] ?? vmSkill.labSeed}
          onClose={() => setVmSkill(null)}
          onResolved={() => handleLabResolved(vmSkill)}
        />
      )}
    </main>
  );
}
