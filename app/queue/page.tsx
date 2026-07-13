"use client";

import { useCallback, useEffect, useState } from "react";
import { getCategoryMeta } from "@/lib/scenarios";
import { ScenarioCard } from "@/components/ScenarioCard";
import type { TicketPreview } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

function queueErrorMessage(raw: string): string {
  if (raw.includes("Rate limit exceeded") || raw.includes("(429)")) {
    return "The AI provider's daily rate limit was reached. The queue will work again once the limit resets.";
  }
  return "Couldn't generate today's ticket queue. Try refreshing.";
}

function ticketStorageKey(ticketId: string): string {
  return `ticket:${ticketId}`;
}

function countByPriority(tickets: TicketPreview[], priority: TicketPreview["priority"]): number {
  return tickets.filter((t) => t.priority === priority).length;
}

export default function Home() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [tickets, setTickets] = useState<TicketPreview[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [usingFallback, setUsingFallback] = useState(false);
  const [topic, setTopic] = useState("");

  // No count — the server rolls a random 10-20 ticket queue each load.
  const loadQueue = useCallback(async (requestTopic?: string) => {
    setLoadState("loading");
    const res = await fetch("/api/scenario/queue", {
      method: "POST",
      body: JSON.stringify(requestTopic ? { topic: requestTopic } : {}),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error("scenario/queue failed:", body.error);
      setErrorMessage(queueErrorMessage(String(body.error ?? "")));
      setLoadState("error");
      return;
    }
    const body = await res.json();
    setTickets(body.tickets);
    setUsingFallback(Boolean(body.fallback));
    setLoadState("ready");
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  return (
    <main className="mx-auto max-w-5xl p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-xs font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
            Tier 1 · Incoming queue
          </div>
          <h1 className="font-display mt-1 text-3xl font-bold" style={{ color: "var(--ink)" }}>
            Ticket queue
          </h1>
          <p className="mt-2 max-w-xl text-sm" style={{ color: "var(--ink-muted)" }}>
            You&apos;re the technician on shift. Accept a ticket, question the end-user, run remote
            diagnostics, fix the fault, then close with resolution notes for grading.
          </p>
          <div className="mt-3 flex max-w-xl flex-wrap gap-2">
            <input
              className="field-input min-w-0 flex-1"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder='Optional theme, e.g. "VPN problems" or "hospital network" — blank for a random mix'
              disabled={loadState === "loading"}
              aria-label="Ticket queue theme"
              onKeyDown={(e) => { if (e.key === "Enter") loadQueue(topic.trim() || undefined); }}
            />
            <button
              className="btn-primary"
              onClick={() => loadQueue(topic.trim() || undefined)}
              disabled={loadState === "loading"}
            >
              {loadState === "loading" ? "Generating…" : "✨ AI generate queue"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="stat-card">
            <div className="stat-value">{loadState === "ready" ? tickets.length : "—"}</div>
            <div className="stat-label">Open</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: "var(--danger)" }}>
              {loadState === "ready" ? countByPriority(tickets, "P1") : "—"}
            </div>
            <div className="stat-label">P1 critical</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: "var(--warn)" }}>
              {loadState === "ready" ? countByPriority(tickets, "P2") : "—"}
            </div>
            <div className="stat-label">P2 high</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: "var(--accent)" }}>
              {loadState === "ready" ? countByPriority(tickets, "P3") : "—"}
            </div>
            <div className="stat-label">P3 normal</div>
          </div>
        </div>
      </div>

      {loadState === "loading" && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl border"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            />
          ))}
        </div>
      )}
      {loadState === "loading" && (
        <p className="mt-4 font-mono text-sm" style={{ color: "var(--ink-muted)" }}>
          Generating today&apos;s queue…
        </p>
      )}

      {loadState === "error" && (
        <div
          className="mt-8 rounded-xl border p-5"
          style={{ background: "var(--warn-soft)", borderColor: "var(--warn-line)" }}
        >
          <p style={{ color: "var(--warn)" }}>{errorMessage}</p>
        </div>
      )}

      {loadState === "ready" && usingFallback && (
        <div
          className="mt-6 rounded-xl border px-4 py-3 text-sm"
          style={{ background: "var(--accent-soft)", borderColor: "var(--accent-line)", color: "var(--ink-muted)" }}
        >
          <span className="font-mono text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
            Offline scenario bank ·{" "}
          </span>
          The AI ticket generator is unavailable (rate limit or no API key), so you&apos;re seeing built-in
          practice tickets. Live chat replies still need the AI provider.
        </div>
      )}

      {loadState === "ready" && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tickets.map((ticket) => (
            <ScenarioCard
              key={ticket.ticketId}
              href={`/play/${ticket.category}?ticket=${ticket.ticketId}`}
              ticketId={ticket.ticketId}
              priority={ticket.priority}
              title={getCategoryMeta(ticket.category).label}
              requester={`${ticket.persona.name} · ${ticket.persona.department}`}
              blurb={ticket.openingMessage}
              onClick={() => sessionStorage.setItem(ticketStorageKey(ticket.ticketId), JSON.stringify(ticket))}
            />
          ))}
        </div>
      )}
    </main>
  );
}
