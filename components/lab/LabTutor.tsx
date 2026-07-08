"use client";

import { useEffect, useRef, useState } from "react";
import type { LabTutorContext, LabTutorTurn } from "@/lib/labTutor";

/** Collapsible AI mentor panel shown inside every lab — explains the job, steps, and concepts. */
export default function LabTutor({ context }: { context: LabTutorContext }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<LabTutorTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (q === "" || busy) return;
    setError(null);
    setInput("");
    const next: LabTutorTurn[] = [...turns, { role: "user", content: q }];
    setTurns(next);
    setBusy(true);
    try {
      const res = await fetch("/api/lab/tutor", {
        method: "POST",
        body: JSON.stringify({ context, messages: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "The tutor is unavailable right now.");
      setTurns((prev) => [...prev, { role: "assistant", content: body.reply }]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-ghost w-full text-sm" onClick={() => setOpen(true)}>
        🎓 AI lab tutor — ask what this lab is about
      </button>
    );
  }

  return (
    <div className="panel flex min-h-0 flex-col p-3">
      <div className="flex items-center justify-between">
        <div className="panel-header">AI lab tutor</div>
        <button
          type="button"
          className="font-mono text-[11px] uppercase"
          style={{ color: "var(--ink-faint)", cursor: "pointer" }}
          onClick={() => setOpen(false)}
        >
          Hide
        </button>
      </div>

      <div className="mt-2 max-h-44 min-h-0 flex-1 overflow-y-auto text-sm">
        {turns.length === 0 && !busy && (
          <div className="flex flex-wrap gap-1.5">
            {["Explain this lab", "Why these steps?", "What should I do first?"].map((q) => (
              <button key={q} type="button" className="cmd-chip" onClick={() => ask(q)}>
                {q}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <p
            key={i}
            className="mt-1.5 whitespace-pre-wrap"
            style={{ color: t.role === "user" ? "var(--accent)" : "var(--ink-muted)" }}
          >
            <span className="font-mono text-[10px] uppercase" style={{ color: "var(--ink-faint)" }}>
              {t.role === "user" ? "you " : "tutor "}
            </span>
            {t.content}
          </p>
        ))}
        {busy && (
          <p className="mt-1.5 font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
            Tutor is thinking…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-1.5 text-[12px]" style={{ color: "var(--warn)" }}>
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="mt-2 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          className="field-input min-w-0 flex-1 !py-1.5 text-sm"
          placeholder={busy ? "thinking…" : "Ask about this lab…"}
          aria-label="Ask the lab tutor"
        />
        <button type="submit" className="btn-primary !px-3 !py-1.5 text-sm" disabled={busy || input.trim() === ""}>
          Ask
        </button>
      </form>
    </div>
  );
}
