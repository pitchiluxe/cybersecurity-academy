"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";


interface ClientQuizQuestion {
  question: string;
  choices: string[];
}
interface ClientModule {
  title: string;
  lesson: string;
  quiz: ClientQuizQuestion[];
}
interface ClientCourse {
  track: string;
  title: string;
  modules: ClientModule[];
}
interface TutorMsg {
  role: "user" | "assistant";
  content: string;
}
interface QuizResult {
  score: number;
  passed: boolean;
  correct: boolean[];
  certIssued: boolean;
}

export default function CourseTrackPage() {
  const params = useParams<{ track: string }>();
  const track = params.track;

  const [course, setCourse] = useState<ClientCourse | null>(null);
  const [passed, setPassed] = useState<Set<number>>(new Set());
  const [certified, setCertified] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [tutorChat, setTutorChat] = useState<TutorMsg[]>([]);
  const [tutorInput, setTutorInput] = useState("");
  const [tutorBusy, setTutorBusy] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const tutorEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/course/generate", { method: "POST", body: JSON.stringify({ track }) })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not load course.");
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setCourse(body.course);
        setPassed(new Set<number>(body.passedModules));
        setCertified(body.certified);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [track]);

  useEffect(() => {
    tutorEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [tutorChat, tutorBusy]);

  function switchModule(i: number) {
    setActive(i);
    setAnswers({});
    setQuizResult(null);
    setTutorChat([]);
  }

  async function submitQuiz() {
    if (!course || submitting) return;
    const module = course.modules[active];
    setSubmitting(true);
    const res = await fetch("/api/course/quiz", {
      method: "POST",
      body: JSON.stringify({
        track,
        moduleIndex: active,
        answers: module.quiz.map((_, i) => answers[i] ?? -1),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setLoadError(body.error ?? "Quiz submission failed.");
      return;
    }
    setQuizResult(body);
    if (body.passed) {
      setPassed((prev) => new Set(prev).add(active));
      if (body.certIssued) setCertified(true);
    }
  }

  async function askTutor(e: React.FormEvent) {
    e.preventDefault();
    if (!course || tutorBusy || tutorInput.trim() === "") return;
    const next: TutorMsg[] = [...tutorChat, { role: "user", content: tutorInput.trim() }];
    setTutorChat(next);
    setTutorInput("");
    setTutorBusy(true);
    const res = await fetch("/api/course/tutor", {
      method: "POST",
      body: JSON.stringify({ track, moduleIndex: active, messages: next }),
    });
    const body = await res.json().catch(() => ({}));
    setTutorBusy(false);
    setTutorChat(
      res.ok
        ? [...next, { role: "assistant", content: body.reply }]
        : [
            ...next,
            {
              role: "assistant",
              content: body.error ?? "The tutor is unavailable right now — try again in a moment.",
            },
          ]
    );
  }

  if (loadError && !course) {
    return (
      <>

        <main className="mx-auto max-w-3xl px-6 py-12 text-center">
          <p role="alert" className="text-sm" style={{ color: "var(--warn)" }}>
            {loadError}
          </p>
          <Link href="/courses" className="auth-link mt-4 inline-block text-sm">
            Back to courses
          </Link>
        </main>
      </>
    );
  }

  if (!course) {
    return (
      <>

        <main className="mx-auto max-w-3xl px-6 py-12 text-center">
          <p className="font-mono text-sm" style={{ color: "var(--ink-faint)" }}>
            Generating your course… this one-time step can take up to a minute.
          </p>
        </main>
      </>
    );
  }

  const module = course.modules[active];

  return (
    <>

      <main className="mx-auto max-w-6xl px-6 py-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link
              href="/courses"
              className="font-mono text-[11px] uppercase tracking-wide"
              style={{ color: "var(--ink-faint)" }}
            >
              ← All courses
            </Link>
            <h1 className="font-display text-xl font-bold" style={{ color: "var(--ink)" }}>
              {course.title}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {certified && (
              <span
                className="rounded-full border px-3 py-1 font-mono text-[11px] uppercase"
                style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
              >
                Certified ✓
              </span>
            )}
            <button onClick={() => setTutorOpen((v) => !v)} className="btn-ghost lg:hidden">
              {tutorOpen ? "Hide tutor" : "AI tutor"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr_320px]">
          <nav className="panel h-fit p-3">
            {course.modules.map((m, i) => (
              <button
                key={i}
                onClick={() => switchModule(i)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150"
                style={{
                  color: i === active ? "var(--accent)" : "var(--ink-muted)",
                  background: i === active ? "var(--surface-2)" : "transparent",
                }}
              >
                <span
                  className="font-mono text-[10px]"
                  style={{ color: passed.has(i) ? "var(--accent)" : "var(--ink-faint)" }}
                >
                  {passed.has(i) ? "✓" : `${i + 1}.`}
                </span>
                <span className="truncate">{m.title}</span>
              </button>
            ))}
          </nav>

          <article className="panel p-6">
            <h2 className="font-display text-lg font-bold" style={{ color: "var(--ink)" }}>
              {module.title}
            </h2>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
              {module.lesson}
            </div>

            <hr className="my-6" style={{ borderColor: "var(--border)" }} />
            <h3 className="font-display text-base font-bold" style={{ color: "var(--ink)" }}>
              Module quiz {passed.has(active) && <span style={{ color: "var(--accent)" }}>— passed ✓</span>}
            </h3>
            <div className="mt-3 flex flex-col gap-5">
              {module.quiz.map((q, qi) => (
                <fieldset key={qi}>
                  <legend className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                    {qi + 1}. {q.question}
                    {quizResult && (
                      <span
                        className="ml-2 font-mono text-[11px]"
                        style={{ color: quizResult.correct[qi] ? "var(--accent)" : "var(--warn)" }}
                      >
                        {quizResult.correct[qi] ? "correct" : "wrong"}
                      </span>
                    )}
                  </legend>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {q.choices.map((choice, ci) => (
                      <label
                        key={ci}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                        style={{ color: "var(--ink-muted)" }}
                      >
                        <input
                          type="radio"
                          name={`q-${active}-${qi}`}
                          checked={answers[qi] === ci}
                          onChange={() => setAnswers((prev) => ({ ...prev, [qi]: ci }))}
                        />
                        {choice}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            {quizResult && (
              <p className="mt-4 text-sm" style={{ color: quizResult.passed ? "var(--accent)" : "var(--warn)" }}>
                Score: {quizResult.score}% — {quizResult.passed ? "passed!" : "below 80%, review the lesson and retry."}
                {quizResult.certIssued && " 🎉 Certificate earned — check your profile!"}
              </p>
            )}
            <button
              onClick={submitQuiz}
              disabled={submitting || Object.keys(answers).length < module.quiz.length}
              className="btn-primary mt-4"
            >
              {submitting ? "Grading…" : "Submit quiz"}
            </button>
          </article>

          <aside className={`panel flex h-[70vh] flex-col p-4 ${tutorOpen ? "" : "hidden lg:flex"}`}>
            <h3 className="font-display text-sm font-bold" style={{ color: "var(--ink)" }}>
              AI Tutor
            </h3>
            <p className="mt-1 text-[12px]" style={{ color: "var(--ink-faint)" }}>
              Ask anything about this lesson — I&apos;ll tie it to real-world fixes.
            </p>
            <div className="mt-3 flex-1 overflow-y-auto">
              <div className="flex flex-col gap-3">
                {tutorChat.map((m, i) => (
                  <div
                    key={i}
                    className="max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm"
                    style={{
                      alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                      background: m.role === "user" ? "var(--accent)" : "var(--surface-2)",
                      color: m.role === "user" ? "#fff" : "var(--ink-muted)",
                    }}
                  >
                    {m.content}
                  </div>
                ))}
                {tutorBusy && (
                  <span className="font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
                    Tutor is typing…
                  </span>
                )}
                <div ref={tutorEndRef} />
              </div>
            </div>
            <form onSubmit={askTutor} className="mt-3 flex gap-2">
              <input
                value={tutorInput}
                onChange={(e) => setTutorInput(e.target.value)}
                placeholder="Ask the tutor…"
                className="field-input flex-1"
              />
              <button type="submit" disabled={tutorBusy || tutorInput.trim() === ""} className="btn-primary">
                Send
              </button>
            </form>
          </aside>
        </div>
      </main>
    </>
  );
}
