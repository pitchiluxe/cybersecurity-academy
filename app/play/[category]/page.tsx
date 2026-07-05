"use client";

import { useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { isScenarioCategory, getCategoryMeta } from "@/lib/scenarios";
import { TicketHeader } from "@/components/TicketHeader";
import { Sidebar } from "@/components/Sidebar";
import { ChatBubble } from "@/components/ChatBubble";
import { ResolutionBanner } from "@/components/ResolutionBanner";
import type { ScenarioSeed, TranscriptMessage, GradeResult } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

function friendlyError(raw: string): string {
  if (raw.includes("ANTHROPIC_AUTH_TOKEN")) return "IT Playground isn't configured with an API key yet.";
  if (raw.includes("no message content") || raw.includes("OpenRouter request failed")) {
    return "The ticket system didn't respond. Try again.";
  }
  return "Something went wrong loading this ticket. Try again.";
}

export default function PlayPage() {
  const params = useParams<{ category: string }>();
  const category = params.category;

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [seed, setSeed] = useState<ScenarioSeed | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);

  useEffect(() => {
    if (!isScenarioCategory(category)) return;

    let cancelled = false;
    async function start() {
      setLoadState("loading");
      const res = await fetch("/api/scenario/start", {
        method: "POST",
        body: JSON.stringify({ category }),
      });
      if (cancelled) return;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("scenario/start failed:", body.error);
        setErrorMessage(friendlyError(body.error ?? ""));
        setLoadState("error");
        return;
      }
      const body = await res.json();
      setSeed(body.seed);
      setTranscript([{ role: "enduser", content: body.seed.openingMessage }]);
      setLoadState("ready");
    }
    start();
    return () => {
      cancelled = true;
    };
  }, [category]);

  if (!isScenarioCategory(category)) {
    notFound();
  }

  async function sendMessage() {
    if (!seed || input.trim() === "" || sending) return;
    const nextTranscript: TranscriptMessage[] = [...transcript, { role: "tech", content: input.trim() }];
    setTranscript(nextTranscript);
    setInput("");
    setSending(true);

    const res = await fetch("/api/scenario/reply", {
      method: "POST",
      body: JSON.stringify({ seed, transcript: nextTranscript }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("scenario/reply failed:", body.error);
      setTranscript([
        ...nextTranscript,
        { role: "enduser", content: `[System: ${friendlyError(body.error ?? "")}]` },
      ]);
      setSending(false);
      return;
    }

    const body = await res.json();
    setTranscript([...nextTranscript, { role: "enduser", content: body.message }]);
    setSending(false);
  }

  async function submitForGrading() {
    if (!seed || grading) return;
    setGrading(true);
    const res = await fetch("/api/scenario/grade", {
      method: "POST",
      body: JSON.stringify({ seed, transcript }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("scenario/grade failed:", body.error);
      setErrorMessage(friendlyError(body.error ?? ""));
      setGrading(false);
      return;
    }
    const body = await res.json();
    setGradeResult(body.result);
    setSeed({ ...seed, rootCause: body.rootCause });
    setGrading(false);
  }

  if (loadState === "loading") {
    return (
      <main className="mx-auto max-w-3xl p-8 font-mono text-sm" style={{ color: "var(--ink-muted)" }}>
        Pulling up the ticket…
      </main>
    );
  }

  if (loadState === "error" || !seed) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <div className="rounded-[10px] border p-5" style={{ background: "var(--warn-soft)", borderColor: "var(--warn-line)" }}>
          <p style={{ color: "var(--warn)" }}>{errorMessage}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-8">
      <TicketHeader
        category={seed.category}
        ticketId={getCategoryMeta(seed.category).ticketId}
        status={gradeResult ? "resolved" : "in-progress"}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
        <Sidebar seed={seed} rootCause={gradeResult ? seed.rootCause : null} />
        <div className="flex flex-col gap-4 rounded-[10px] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          {transcript.map((message, i) => (
            <ChatBubble key={i} message={message} name={message.role === "tech" ? "You" : seed.persona.name} />
          ))}
        </div>
      </div>

      {!gradeResult && (
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--ink)" }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            placeholder="Type your response…"
            disabled={sending}
          />
          <button
            className="cursor-pointer rounded-lg px-4 py-2 text-sm font-bold"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            onClick={sendMessage}
            disabled={sending || input.trim() === ""}
          >
            Send
          </button>
          <button
            className="cursor-pointer rounded-lg border px-4 py-2 text-sm font-bold"
            style={{ borderColor: "var(--good-line)", color: "var(--good)" }}
            onClick={submitForGrading}
            disabled={grading || transcript.length < 2}
          >
            {grading ? "Grading…" : "Resolve & Submit"}
          </button>
        </div>
      )}

      {gradeResult && <ResolutionBanner result={gradeResult} rootCause={seed.rootCause} />}
    </main>
  );
}
