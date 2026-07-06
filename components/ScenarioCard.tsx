import Link from "next/link";
import { SLA_TARGETS } from "@/lib/scenarios";

const PRIORITY_PILL: Record<"P1" | "P2" | "P3", string> = {
  P1: "pill-danger",
  P2: "pill-warn",
  P3: "pill-accent",
};

const PRIORITY_STRIPE: Record<"P1" | "P2" | "P3", string> = {
  P1: "sev-p1",
  P2: "sev-p2",
  P3: "",
};

export function ScenarioCard({
  href,
  ticketId,
  priority,
  title,
  requester,
  blurb,
  onClick,
}: {
  href: string;
  ticketId: string;
  priority: "P1" | "P2" | "P3";
  title: string;
  requester: string;
  blurb: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`ticket-card block rounded-r-xl rounded-l-sm border border-l-0 p-4 ${PRIORITY_STRIPE[priority]}`}
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="ticket-id">{ticketId}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
            SLA {SLA_TARGETS[priority].respond}
          </span>
          <span className={`pill ${PRIORITY_PILL[priority]}`}>{priority}</span>
        </div>
      </div>
      <h2 className="font-display mt-2 text-base font-bold" style={{ color: "var(--ink)" }}>
        {title}
      </h2>
      <div className="mt-0.5 font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
        {requester}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm" style={{ color: "var(--ink-muted)" }}>
        {blurb}
      </p>
    </Link>
  );
}
