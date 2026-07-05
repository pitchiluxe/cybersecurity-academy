import type { GradeResult } from "@/lib/types";

export function ResolutionBanner({ result, rootCause }: { result: GradeResult; rootCause: string }) {
  return (
    <div className="mt-5 rounded-[10px] border p-5" style={{ background: "var(--good-soft)", borderColor: "var(--good-line)" }}>
      <h2 className="font-display text-base font-bold" style={{ color: "var(--good)" }}>
        Score: {result.score}/100 — {result.resolved ? "Resolved" : "Not resolved"}
      </h2>
      <p className="mt-2 text-sm" style={{ color: "var(--ink)" }}>
        {result.feedback}
      </p>
      <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
        Actual root cause: {rootCause}
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
