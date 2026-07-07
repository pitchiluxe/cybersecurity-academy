"use client";

import { useEffect, useState } from "react";
import type { ScenarioCategory } from "@/lib/types";
import { SLA_TARGETS, getCategoryMeta } from "@/lib/scenarios";

const PRIORITY_PILL: Record<"P1" | "P2" | "P3", string> = {
  P1: "pill-danger",
  P2: "pill-warn",
  P3: "pill-accent",
};

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TicketHeader({
  category,
  ticketId,
  priority,
  status,
}: {
  category: ScenarioCategory;
  ticketId: string;
  priority: "P1" | "P2" | "P3";
  status: "in-progress" | "resolved";
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status === "resolved") return;
    const id = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-xs" style={{ color: "var(--accent)" }}>
            {ticketId} · {getCategoryMeta(category).label.toUpperCase()}
          </div>
          <h1 className="font-display mt-1 text-2xl font-bold" style={{ color: "var(--ink)" }}>
            Live support session
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 font-mono text-xs"
            style={{ color: "var(--ink-faint)" }}
            title="Time on ticket"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            {formatElapsed(elapsed)} · SLA respond {SLA_TARGETS[priority].respond} / resolve{" "}
            {SLA_TARGETS[priority].resolve}
          </span>
          <span className={`pill ${PRIORITY_PILL[priority]}`}>{priority}</span>
          <span className={`pill ${status === "resolved" ? "pill-good" : "pill-warn"}`}>
            {status === "resolved" ? "Resolved" : "In progress"}
          </span>
        </div>
      </div>
    </div>
  );
}
