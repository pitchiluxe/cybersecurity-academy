import Link from "next/link";

const PRIORITY_PILL: Record<"P1" | "P2" | "P3", string> = {
  P1: "pill-warn",
  P2: "pill-accent",
  P3: "pill-good",
};

export function ScenarioCard({
  href,
  ticketId,
  priority,
  title,
  blurb,
  onClick,
}: {
  href: string;
  ticketId: string;
  priority: "P1" | "P2" | "P3";
  title: string;
  blurb: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="ticket-card block rounded-r-[10px] rounded-l-sm border border-l-0 p-5"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="ticket-id">{ticketId}</span>
        <span className={`pill ${PRIORITY_PILL[priority]}`}>{priority}</span>
      </div>
      <h2 className="font-display mt-2 text-lg font-bold" style={{ color: "var(--ink)" }}>
        {title}
      </h2>
      <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
        {blurb}
      </p>
    </Link>
  );
}
