import type { ScenarioSeed } from "@/lib/types";
import { REMOTE_TOOLS } from "@/lib/scenarios";

export function Sidebar({
  seed,
  rootCause,
  onRunDiagnostic,
  diagnosticsDisabled,
}: {
  seed: ScenarioSeed;
  rootCause: string | null;
  onRunDiagnostic?: (command: string) => void;
  diagnosticsDisabled?: boolean;
}) {
  return (
    <aside className="flex flex-col gap-4">
      <div className="panel p-4">
        <div className="panel-header mb-2">Requester</div>
        <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>
          {seed.persona.name}
        </div>
        <div className="text-sm" style={{ color: "var(--ink-muted)" }}>
          {seed.persona.department}
        </div>
      </div>

      <div className="panel p-4">
        <div className="panel-header mb-2">Asset</div>
        <dl className="space-y-1.5 text-sm">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
              OS
            </dt>
            <dd style={{ color: "var(--ink)" }}>{seed.environment.os}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
              Device
            </dt>
            <dd style={{ color: "var(--ink)" }}>{seed.environment.device}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
              Notes
            </dt>
            <dd style={{ color: "var(--ink-muted)" }}>{seed.environment.detail}</dd>
          </div>
        </dl>
      </div>

      {onRunDiagnostic && (
        <div className="panel p-4">
          <div className="panel-header mb-2">Remote toolkit</div>
          <p className="mb-2 text-xs" style={{ color: "var(--ink-muted)" }}>
            Run diagnostics on the user&apos;s machine. Output lands in the session log.
          </p>
          <div className="space-y-1.5">
            {REMOTE_TOOLS.map((tool) => (
              <button
                key={tool.command}
                type="button"
                className="tool-btn"
                disabled={diagnosticsDisabled}
                onClick={() => onRunDiagnostic(tool.command)}
              >
                {tool.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="panel p-4">
        <div className="panel-header mb-2">Root cause</div>
        <div className="text-sm" style={{ color: rootCause ? "var(--good)" : "var(--ink-faint)" }}>
          {rootCause ?? "Hidden until ticket is closed"}
        </div>
      </div>
    </aside>
  );
}
