import type { TranscriptMessage } from "@/lib/types";

export const RUN_COMMAND_PREFIX = "/run ";

export function isRunCommand(message: TranscriptMessage): boolean {
  return message.role === "tech" && message.content.startsWith(RUN_COMMAND_PREFIX);
}

export function ChatBubble({
  message,
  name,
  variant = "chat",
}: {
  message: TranscriptMessage;
  name: string;
  variant?: "chat" | "command" | "terminal";
}) {
  if (variant === "command") {
    return (
      <div className="bubble-in self-end" style={{ maxWidth: "88%" }}>
        <span className="cmd-chip">{message.content.slice(RUN_COMMAND_PREFIX.length)}</span>
      </div>
    );
  }

  if (variant === "terminal") {
    return (
      <div className="bubble-in w-full" style={{ maxWidth: "88%" }}>
        <div className="terminal-title">Remote diagnostic · {name}&apos;s machine</div>
        <pre className="terminal-block">{message.content}</pre>
      </div>
    );
  }

  const isTech = message.role === "tech";
  return (
    <div className={`bubble-in flex gap-3 ${isTech ? "flex-row-reverse self-end" : ""}`} style={{ maxWidth: "88%" }}>
      <div
        className="flex h-8 w-8 flex-none items-center justify-center rounded-full font-mono text-xs font-bold"
        style={
          isTech
            ? { background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-line)" }
            : { background: "var(--surface-2)", color: "var(--ink-muted)" }
        }
      >
        {name
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()}
      </div>
      <div
        className="rounded-xl border px-4 py-3 text-sm"
        style={
          isTech
            ? { background: "var(--accent-soft)", borderColor: "var(--accent-line)", color: "var(--ink)" }
            : { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--ink)" }
        }
      >
        {message.content}
      </div>
    </div>
  );
}
