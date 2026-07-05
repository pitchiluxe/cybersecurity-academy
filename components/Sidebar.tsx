import type { ScenarioSeed } from "@/lib/types";

export function Sidebar({ seed, rootCause }: { seed: ScenarioSeed; rootCause: string | null }) {
  return (
    <aside className="rounded-[10px] border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="mb-3">
        <div className="font-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
          Requester
        </div>
        <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>
          {seed.persona.name} · {seed.persona.department}
        </div>
      </div>
      <div className="mb-3">
        <div className="font-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
          Environment
        </div>
        <div className="text-sm" style={{ color: "var(--ink)" }}>
          {seed.environment.os} · {seed.environment.device}
        </div>
        <div className="text-sm" style={{ color: "var(--ink-muted)" }}>
          {seed.environment.detail}
        </div>
      </div>
      <div>
        <div className="font-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
          Root cause
        </div>
        <div className="text-sm" style={{ color: rootCause ? "var(--good)" : "var(--ink-faint)" }}>
          {rootCause ?? "Unresolved"}
        </div>
      </div>
    </aside>
  );
}
