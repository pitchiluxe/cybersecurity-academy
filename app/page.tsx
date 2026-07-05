"use client";

import { useEffect, useState } from "react";
import { getCategoryMeta } from "@/lib/scenarios";
import { ScenarioCard } from "@/components/ScenarioCard";
import type { TicketPreview } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

function ticketStorageKey(ticketId: string): string {
  return `ticket:${ticketId}`;
}

export default function Home() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [tickets, setTickets] = useState<TicketPreview[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadQueue() {
      setLoadState("loading");
      const res = await fetch("/api/scenario/queue", { method: "POST", body: JSON.stringify({ count: 9 }) });
      if (cancelled) return;
      if (!res.ok) {
        setLoadState("error");
        return;
      }
      const body = await res.json();
      setTickets(body.tickets);
      setLoadState("ready");
    }
    loadQueue();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="font-mono text-xs font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
        Queue · {loadState === "ready" ? tickets.length : "…"} open tickets
      </div>
      <h1 className="font-display mt-1 text-3xl font-bold" style={{ color: "var(--ink)" }}>
        IT Playground
      </h1>
      <p className="mt-2" style={{ color: "var(--ink-muted)" }}>
        Pick a ticket. You&apos;ll play the technician against an end-user with a real (made-up) problem — ask
        questions, diagnose the fault, fix it, then submit for grading.
      </p>

      {loadState === "loading" && (
        <p className="mt-6 font-mono text-sm" style={{ color: "var(--ink-muted)" }}>
          Generating today&apos;s queue…
        </p>
      )}

      {loadState === "error" && (
        <div
          className="mt-6 rounded-[10px] border p-5"
          style={{ background: "var(--warn-soft)", borderColor: "var(--warn-line)" }}
        >
          <p style={{ color: "var(--warn)" }}>Couldn&apos;t generate today&apos;s ticket queue. Try refreshing.</p>
        </div>
      )}

      {loadState === "ready" && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {tickets.map((ticket) => (
            <ScenarioCard
              key={ticket.ticketId}
              href={`/play/${ticket.category}?ticket=${ticket.ticketId}`}
              ticketId={ticket.ticketId}
              priority={ticket.priority}
              title={`${ticket.persona.name} — ${getCategoryMeta(ticket.category).label}`}
              blurb={ticket.openingMessage}
              onClick={() => sessionStorage.setItem(ticketStorageKey(ticket.ticketId), JSON.stringify(ticket))}
            />
          ))}
        </div>
      )}
    </main>
  );
}
