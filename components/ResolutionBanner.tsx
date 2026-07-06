import type { GradeResult } from "@/lib/types";

export function ResolutionBanner({ result, rootCause }: { result: GradeResult; rootCause: string }) {
  const passed = result.resolved;
  return (
    <div
      className="mt-5 rounded-xl border p-5"
      style={{
        background: passed ? "var(--good-soft)" : "var(--warn-soft)",
        borderColor: passed ? "var(--good-line)" : "var(--warn-line)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-bold" style={{ color: passed ? "var(--good)" : "var(--warn)" }}>
          {passed ? "Ticket resolved" : "Ticket closed — unresolved"}
        </h2>
        <span className="font-mono text-2xl font-bold" style={{ color: passed ? "var(--good)" : "var(--warn)" }}>
          {result.score}
          <span className="text-sm font-normal" style={{ color: "var(--ink-faint)" }}>
            /100
          </span>
        </span>
      </div>
      <p className="mt-2 text-sm" style={{ color: "var(--ink)" }}>
        {result.feedback}
      </p>
      <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
        <span className="font-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
          Actual root cause:{" "}
        </span>
        {rootCause}
      </p>
      <ul className="mt-3 space-y-1">
        {result.rubric.map((item) => (
          <li key={item.item} className="font-mono text-xs" style={{ color: item.met ? "var(--good)" : "var(--warn)" }}>
            [{item.met ? "x" : " "}] {item.item} — {item.note}
          </li>
        ))}
      </ul>
    </div>
  );
}
