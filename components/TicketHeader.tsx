import type { ScenarioCategory } from "@/lib/types";

const CATEGORY_LABELS: Record<ScenarioCategory, string> = {
  network: "Network / Wi-Fi",
  printer: "Printer",
  password: "Password / MFA",
  "app-crash": "Application Crash",
  malware: "Malware / Quarantine",
  hardware: "Hardware Failure",
};

export function TicketHeader({
  category,
  ticketId,
  status,
}: {
  category: ScenarioCategory;
  ticketId: string;
  status: "in-progress" | "resolved";
}) {
  return (
    <div className="rounded-[10px] border p-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-xs" style={{ color: "var(--accent)" }}>
            {ticketId} · {CATEGORY_LABELS[category].toUpperCase()}
          </div>
          <h1 className="font-display mt-1 text-2xl font-bold" style={{ color: "var(--ink)" }}>
            IT Playground Session
          </h1>
        </div>
        <span className={`pill ${status === "resolved" ? "pill-good" : "pill-warn"}`}>
          {status === "resolved" ? "Resolved" : "In progress"}
        </span>
      </div>
    </div>
  );
}
