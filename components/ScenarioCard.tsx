import Link from "next/link";
import type { ScenarioCategory } from "@/lib/types";

const PRIORITY_PILL: Record<"P1" | "P2" | "P3", string> = {
  P1: "pill-warn",
  P2: "pill-accent",
  P3: "pill-good",
};

export function ScenarioCard({
  category,
}: {
  category: { id: ScenarioCategory; label: string; blurb: string; ticketId: string; priority: "P1" | "P2" | "P3" };
}) {
  return (
    <Link
      href={`/play/${category.id}`}
      className="ticket-card block rounded-r-[10px] rounded-l-sm border border-l-0 p-5"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="ticket-id">{category.ticketId}</span>
        <span className={`pill ${PRIORITY_PILL[category.priority]}`}>{category.priority}</span>
      </div>
      <h2 className="font-display mt-2 text-lg font-bold" style={{ color: "var(--ink)" }}>
        {category.label}
      </h2>
      <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
        {category.blurb}
      </p>
    </Link>
  );
}
