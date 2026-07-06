"use client";

import { useEffect, useRef, useState } from "react";
import { notFound, useParams, useSearchParams } from "next/navigation";
import { isScenarioCategory, getCategoryMeta } from "@/lib/scenarios";
import { TicketHeader } from "@/components/TicketHeader";
import { Sidebar } from "@/components/Sidebar";
import { ChatBubble, isRunCommand } from "@/components/ChatBubble";
import { ResolutionBanner } from "@/components/ResolutionBanner";
import type { ScenarioSeed, TicketPreview, TranscriptMessage, GradeResult } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

function friendlyError(raw: string): string {
  if (raw.includes("Could not reach Ollama")) {
    return "Ollama isn't running on this machine. Start the Ollama app, or switch provider in Settings.";
  }
  if (raw.includes("Rate limit exceeded") || raw.includes("(429)")) {
    return "The AI provider's daily rate limit was reached. Try again after it resets, or switch to Ollama in Settings.";
  }
  if (raw.includes("ANTHROPIC_AUTH_TOKEN")) return "IT Playground isn't configured with an API key yet.";
  if (raw.includes("no message content") || raw.includes("OpenRouter request failed")) {
    return "The ticket system didn't respond. Try again.";
  }
  return "Something went wrong loading this ticket. Try again.";
}

function ticketStorageKey(ticketId: string): string {
  return `ticket:${ticketId}`;
}

export default function PlayPage() {
  const params = useParams<{ category: string }>();
  const category = params.category;
  const searchParams = useSearchParams();
  const ticketIdParam = searchParams.get("ticket");

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [seed, setSeed] = useState<ScenarioSeed | null>(null);
  const [priority, setPriority] = useState<"P1" | "P2" | "P3">("P2");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [closing, setClosing] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isScenarioCategory(category)) return;

    if (ticketIdParam) {
      const stored = sessionStorage.getItem(ticketStorageKey(ticketIdParam));
      if (stored) {
        const ticket = JSON.parse(stored) as TicketPreview;
        setSeed(ticket);
        setPriority(ticket.priority);
        setTicketId(ticket.ticketId);
        setTranscript([{ role: "enduser", content: ticket.openingMessage }]);
        setLoadState("ready");
        return;
      }
    }

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
      const meta = getCategoryMeta(category as ScenarioSeed["category"]);
      setSeed(body.seed);
      setPriority(meta.priority);
      setTicketId(ticketIdParam ?? meta.ticketId);
      setTranscript([{ role: "enduser", content: body.seed.openingMessage }]);
      setLoadState("ready");
    }
    start();
    return () => {
      cancelled = true;
    };
  }, [category, ticketIdParam]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [transcript, sending]);

  if (!isScenarioCategory(category)) {
    notFound();
  }

  async function dispatch(content: string) {
    if (!seed || sending) return;
    const nextTranscript: TranscriptMessage[] = [...transcript, { role: "tech", content }];
    setTranscript(nextTranscript);
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

  async function sendMessage() {
    if (input.trim() === "") return;
    const content = input.trim();
    setInput("");
    await dispatch(content);
  }

  async function submitForGrading() {
    if (!seed || grading || resolutionNotes.trim() === "") return;
    setGrading(true);
    const closedTranscript: TranscriptMessage[] = [
      ...transcript,
      { role: "tech", content: `Resolution notes: ${resolutionNotes.trim()}` },
    ];
    const res = await fetch("/api/scenario/grade", {
      method: "POST",
      body: JSON.stringify({ seed, transcript: closedTranscript }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("scenario/grade failed:", body.error);
      setErrorMessage(friendlyError(body.error ?? ""));
      setGrading(false);
      return;
    }
    const body = await res.json();
    setTranscript(closedTranscript);
    setGradeResult(body.result);
    setSeed({ ...seed, rootCause: body.rootCause });
    setGrading(false);
    setClosing(false);
  }

  if (loadState === "loading") {
    return (
      <main className="mx-auto max-w-5xl p-6 sm:p-8">
        <div className="h-24 animate-pulse rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border)" }} />
        <p className="mt-4 font-mono text-sm" style={{ color: "var(--ink-muted)" }}>
          Pulling up the ticket…
        </p>
      </main>
    );
  }

  if (loadState === "error" || !seed) {
    return (
      <main className="mx-auto max-w-5xl p-6 sm:p-8">
        <div className="rounded-xl border p-5" style={{ background: "var(--warn-soft)", borderColor: "var(--warn-line)" }}>
          <p style={{ color: "var(--warn)" }}>{errorMessage}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-6 sm:p-8">
      <TicketHeader
        category={seed.category}
        ticketId={ticketId ?? getCategoryMeta(seed.category).ticketId}
        priority={priority}
        status={gradeResult ? "resolved" : "in-progress"}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
        <Sidebar
          seed={seed}
          rootCause={gradeResult ? seed.rootCause : null}
          onRunDiagnostic={gradeResult ? undefined : (command) => dispatch(command)}
          diagnosticsDisabled={sending || grading}
        />
        <div className="panel flex flex-col gap-4 p-5">
          <div className="panel-header">Session log</div>
          {transcript.map((message, i) => {
            const prev = i > 0 ? transcript[i - 1] : null;
            const variant = isRunCommand(message)
              ? "command"
              : prev && isRunCommand(prev) && message.role === "enduser"
                ? "terminal"
                : "chat";
            return (
              <ChatBubble
                key={i}
                message={message}
                name={message.role === "tech" ? "You" : seed.persona.name}
                variant={variant}
              />
            );
          })}
          {sending && (
            <div className="font-mono text-xs" style={{ color: "var(--ink-faint)" }}>
              {isRunCommand(transcript[transcript.length - 1]) ? "Running remote diagnostic…" : `${seed.persona.name} is typing…`}
            </div>
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {!gradeResult && !closing && (
        <div className="flex flex-wrap gap-2">
          <input
            className="field-input w-full min-w-0 sm:w-auto sm:flex-1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
            placeholder="Reply to the user, or type /run <command> for remote diagnostics…"
            disabled={sending}
            aria-label="Message to end user"
          />
          <button className="btn-primary" onClick={sendMessage} disabled={sending || input.trim() === ""}>
            Send
          </button>
          <button className="btn-ghost" onClick={() => setClosing(true)} disabled={grading || transcript.length < 2}>
            Close ticket…
          </button>
        </div>
      )}

      {!gradeResult && closing && (
        <div className="panel p-5">
          <div className="panel-header mb-2">Close ticket — resolution notes</div>
          <p className="mb-3 text-sm" style={{ color: "var(--ink-muted)" }}>
            Document what was wrong and how you fixed it. Notes are part of your grade — real desks
            live and die by them.
          </p>
          <textarea
            className="field-input w-full"
            rows={3}
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            placeholder="e.g. Root cause: corrupted VPN adapter driver after Windows update. Reinstalled GlobalProtect, verified tunnel connects, user confirmed access restored."
            aria-label="Resolution notes"
          />
          <div className="mt-3 flex gap-2">
            <button className="btn-primary" onClick={submitForGrading} disabled={grading || resolutionNotes.trim() === ""}>
              {grading ? "Grading…" : "Resolve & submit for grading"}
            </button>
            <button className="btn-ghost" onClick={() => setClosing(false)} disabled={grading}>
              Back to session
            </button>
          </div>
        </div>
      )}

      {gradeResult && <ResolutionBanner result={gradeResult} rootCause={seed.rootCause} />}
    </main>
  );
}
