"use client";

import { useState } from "react";
import {
  BOOTCAMP_SKILLS, BOOTCAMP_START, BOOTCAMP_END,
  type BootcampSkill, type ClientBootcampChapter,
} from "@/lib/bootcamp";
import LabTutor from "@/components/lab/LabTutor";
import { VmOverlay } from "@/components/vm/VmOverlay";

interface QuizState {
  answers: Record<number, number>;
  result: { score: number; passed: boolean; correct: boolean[]; answerKey: number[] } | null;
  submitting: boolean;
}

export default function BootcampPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Record<string, ClientBootcampChapter>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [quiz, setQuiz] = useState<Record<string, QuizState>>({});
  const [vmSkill, setVmSkill] = useState<BootcampSkill | null>(null);
  const [labDone, setLabDone] = useState<Record<string, boolean>>({});

  async function openChapter(skill: BootcampSkill) {
    if (chapters[skill.id] || loading) return;
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
    if (!res.ok) setErrors((prev) => ({ ...prev, [skill.id]: body.error ?? "Grading failed." }));
  }

  function handleLabResolved(skill: BootcampSkill) {
    setLabDone((prev) => ({ ...prev, [skill.id]: true }));
    fetch("/api/lab/complete", {
      method: "POST",
      body: JSON.stringify({ kind: "bootcamp", score: 100 }),
    }).catch(() => {});
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="font-mono text-xs font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
        Summer of CCNA · {BOOTCAMP_START} → {BOOTCAMP_END}
      </div>
      <h1 className="font-display mt-1 text-3xl font-bold" style={{ color: "var(--ink)" }}>
        CCNA Bootcamp
      </h1>
      <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--ink-muted)" }}>
        27 skills over 17 weeks, following the Academy CCNA study plan and the Castle Rysen Coffee build-out.
        Every skill has an AI-written chapter with a quiz, a personal AI tutor, and a hands-on lab on a
        simulated machine you troubleshoot for real.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {BOOTCAMP_SKILLS.map((skill) => {
          const isOpen = expanded === skill.id;
          const chapter = chapters[skill.id];
          const q = quiz[skill.id];
          const err = errors[skill.id];
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
                    {labDone[skill.id] && (
                      <span className="font-mono text-[10px] uppercase" style={{ color: "var(--accent)" }}>lab ✓</span>
                    )}
                    {q?.result?.passed && (
                      <span className="font-mono text-[10px] uppercase" style={{ color: "var(--accent)" }}>quiz ✓</span>
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
                    <button className="btn-ghost text-sm" onClick={() => setVmSkill(skill)}>
                      🖥️ Launch VM lab
                    </button>
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
                          Score: {q.result.score}% — {q.result.passed ? "passed!" : "below 80%, review the lesson and retry."}
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
          seed={vmSkill.labSeed}
          onClose={() => setVmSkill(null)}
          onResolved={() => handleLabResolved(vmSkill)}
        />
      )}
    </main>
  );
}
